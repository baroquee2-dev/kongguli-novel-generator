import os
import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import httpx

from app.config import DATA_DIR, get_settings
from app.models import Novel, Chapter, AISettings, RecalledScene

RAG_DB_FILE = DATA_DIR / "rag_index.db"

def init_rag_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(RAG_DB_FILE) as conn:
        cursor = conn.cursor()
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS chunks (
            id TEXT PRIMARY KEY,
            novel_id TEXT NOT NULL,
            chapter_id TEXT NOT NULL,
            chapter_number INTEGER NOT NULL,
            chapter_title TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            text TEXT NOT NULL,
            characters TEXT NOT NULL,
            vector BLOB,
            created_at TEXT NOT NULL
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_novel_chap ON chunks (novel_id, chapter_number);")
        conn.commit()

# 初始化資料庫表格
init_rag_db()


class RAGService:

    @staticmethod
    def chunk_chapter_content(
        chapter: Chapter, 
        character_names: List[str]
    ) -> List[Dict[str, Any]]:
        """
        將章節正文按照自然段落與場景邊界進行切塊 (每塊約 250 ~ 600 字)，附帶元數據
        """
        raw_text = (chapter.content or "").strip()
        if not raw_text:
            return []

        # 按雙換行或明顯的場景轉場符號切分段落
        raw_paras = [p.strip() for p in raw_text.split("\n\n") if p.strip()]
        if not raw_paras:
            raw_paras = [p.strip() for p in raw_text.split("\n") if p.strip()]

        chunks = []
        current_chunk = []
        current_len = 0

        for para in raw_paras:
            para_len = len(para)
            if current_len + para_len > 600 and current_chunk:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = [para]
                current_len = para_len
            else:
                current_chunk.append(para)
                current_len += para_len

        if current_chunk:
            chunks.append("\n\n".join(current_chunk))

        result = []
        for idx, chunk_text in enumerate(chunks):
            # 檢測該切塊中出現的登場角色
            present_chars = [name for name in character_names if name in chunk_text]
            result.append({
                "chunk_index": idx,
                "text": chunk_text,
                "characters": present_chars
            })

        return result

    @staticmethod
    async def get_embeddings(texts: List[str], settings: AISettings) -> List[Optional[np.ndarray]]:
        """
        依照當前 AI 設定取得文本 Embedding 向量。若失敗則優雅回退 None，採用文字與 BM25 檢索。
        """
        if not texts:
            return []

        provider = settings.provider
        cfg = settings.providers.get(provider) if settings.providers else None
        api_key = cfg.api_key if cfg and cfg.api_key else settings.api_key
        base_url = cfg.base_url if cfg and cfg.base_url else settings.base_url

        # 1. OpenAI 向量模型 (text-embedding-3-small)
        if provider == "openai" and api_key:
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(
                        "https://api.openai.com/v1/embeddings",
                        headers={"Authorization": f"Bearer {api_key}"},
                        json={
                            "input": texts,
                            "model": "text-embedding-3-small"
                        }
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        embeddings = []
                        for item in data.get("data", []):
                            vec = np.array(item["embedding"], dtype=np.float32)
                            embeddings.append(vec)
                        return embeddings
            except Exception as e:
                print(f"[RAG] OpenAI Embedding failed, falling back to keyword similarity: {e}")

        # 2. Gemini 向量模型 (text-embedding-004)
        elif provider == "gemini" and api_key:
            try:
                embeddings = []
                async with httpx.AsyncClient(timeout=15.0) as client:
                    for text in texts:
                        url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={api_key}"
                        resp = await client.post(
                            url,
                            json={
                                "model": "models/text-embedding-004",
                                "content": {"parts": [{"text": text[:2000]}]}
                            }
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            vec_vals = data.get("embedding", {}).get("values", [])
                            embeddings.append(np.array(vec_vals, dtype=np.float32) if vec_vals else None)
                        else:
                            embeddings.append(None)
                    return embeddings
            except Exception as e:
                print(f"[RAG] Gemini Embedding failed, falling back to keyword similarity: {e}")

        # 3. Custom / Ollama / OpenAI-compatible /v1/embeddings
        elif base_url and ("/v1" in base_url or "localhost" in base_url or "127.0.0.1" in base_url):
            try:
                embed_url = base_url.rstrip("/")
                if not embed_url.endswith("/embeddings"):
                    embed_url = f"{embed_url}/embeddings"

                headers = {}
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"

                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(
                        embed_url,
                        headers=headers,
                        json={
                            "input": texts,
                            "model": "nomic-embed-text" if "ollama" in base_url or "11434" in base_url else "text-embedding-3-small"
                        }
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        embeddings = []
                        for item in data.get("data", []):
                            vec = np.array(item["embedding"], dtype=np.float32)
                            embeddings.append(vec)
                        return embeddings
            except Exception as e:
                print(f"[RAG] Custom/Ollama Embedding failed, falling back: {e}")

        # 無可用向量 API 或呼叫失敗時，返回全 None (系統將自動以關鍵字與角色共現檢索處理)
        return [None] * len(texts)

    @staticmethod
    async def index_chapter(novel_id: str, chapter: Chapter, characters: List[str]):
        """
        為單個章節建立/更新語意向量索引
        """
        if not chapter.content or not chapter.content.strip():
            # 若無內容，清除舊有切塊即可
            with sqlite3.connect(RAG_DB_FILE) as conn:
                conn.cursor().execute("DELETE FROM chunks WHERE chapter_id = ?", (chapter.id,))
                conn.commit()
            return

        chunks_data = RAGService.chunk_chapter_content(chapter, characters)
        if not chunks_data:
            return

        settings = get_settings()
        chunk_texts = [
            f"[第{chapter.chapter_number}章《{chapter.title}》] {c['text']}" 
            for c in chunks_data
        ]
        
        # 批量獲取向量
        vectors = await RAGService.get_embeddings(chunk_texts, settings)

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        with sqlite3.connect(RAG_DB_FILE) as conn:
            cursor = conn.cursor()
            # 刪除舊切塊
            cursor.execute("DELETE FROM chunks WHERE chapter_id = ?", (chapter.id,))

            for c, vec in zip(chunks_data, vectors):
                chunk_id = f"chk-{chapter.id}-{c['chunk_index']}"
                vec_blob = vec.tobytes() if vec is not None else None
                cursor.execute("""
                INSERT INTO chunks (
                    id, novel_id, chapter_id, chapter_number, chapter_title,
                    chunk_index, text, characters, vector, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    chunk_id, novel_id, chapter.id, chapter.chapter_number, chapter.title,
                    c["chunk_index"], c["text"], json.dumps(c["characters"], ensure_ascii=False),
                    vec_blob, now_str
                ))
            conn.commit()

    @staticmethod
    async def index_novel(novel: Novel):
        """
        為整本小說重新建立 RAG 向量索引
        """
        char_names = [c.name for c in novel.characters]
        with sqlite3.connect(RAG_DB_FILE) as conn:
            conn.cursor().execute("DELETE FROM chunks WHERE novel_id = ?", (novel.id,))
            conn.commit()

        for chap in sorted(novel.chapters, key=lambda c: c.chapter_number):
            if chap.content and chap.content.strip():
                await RAGService.index_chapter(novel.id, chap, char_names)

    @staticmethod
    def delete_novel_index(novel_id: str):
        """
        清理刪除小說時的向量索引
        """
        with sqlite3.connect(RAG_DB_FILE) as conn:
            conn.cursor().execute("DELETE FROM chunks WHERE novel_id = ?", (novel_id,))
            conn.commit()

    @staticmethod
    async def query_historical_scenes(
        novel: Novel,
        current_chapter: Chapter,
        query_hint: str = "",
        top_k: int = 3
    ) -> List[RecalledScene]:
        """
        深海回撈歷史情節：嚴格限定檢索 chapter_number < current_chapter.chapter_number
        """
        current_chap_num = current_chapter.chapter_number
        if current_chap_num <= 1:
            return []

        # 登場人物姓名
        selected_chars = [c.name for c in novel.characters if c.id in current_chapter.selected_character_ids]
        
        # 組合查詢語意庫 (大綱 + 自訂提示 + 登場人物)
        query_text = f"{current_chapter.title} {current_chapter.outline} {query_hint} {' '.join(selected_chars)}".strip()
        if not query_text:
            return []

        # 檢索所有歷史候選切塊
        with sqlite3.connect(RAG_DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT id, chapter_number, chapter_title, chunk_index, text, characters, vector
            FROM chunks
            WHERE novel_id = ? AND chapter_number < ?
            ORDER BY chapter_number ASC, chunk_index ASC
            """, (novel.id, current_chap_num))
            rows = cursor.fetchall()

        if not rows:
            return []

        # 取得 Query 向量 (如有)
        settings = get_settings()
        query_vecs = await RAGService.get_embeddings([query_text], settings)
        query_vec = query_vecs[0] if query_vecs and query_vecs[0] is not None else None

        scored_candidates = []

        query_tokens = set([t.strip().lower() for t in query_text.replace("\n", " ").split() if len(t.strip()) >= 2])
        query_char_set = set(selected_chars)

        for row in rows:
            chk_id, ch_num, ch_title, chk_idx, text, chars_json, vec_blob = row
            chk_chars = json.loads(chars_json) if chars_json else []

            score = 0.0
            reasons = []

            # 1. 向量相似度評分 (如存在)
            if query_vec is not None and vec_blob is not None:
                stored_vec = np.frombuffer(vec_blob, dtype=np.float32)
                if stored_vec.shape == query_vec.shape:
                    norm_q = np.linalg.norm(query_vec)
                    norm_s = np.linalg.norm(stored_vec)
                    if norm_q > 1e-6 and norm_s > 1e-6:
                        sim = float(np.dot(query_vec, stored_vec) / (norm_q * norm_s))
                        score += sim * 0.75
                        if sim > 0.45:
                            reasons.append(f"語意關聯度高達 {int(sim * 100)}%")

            # 2. 登場角色共現加成 (同一群人物之間的對話/羈絆優先打撈)
            common_chars = query_char_set.intersection(set(chk_chars))
            if common_chars:
                bonus = len(common_chars) * 0.15
                score += bonus
                reasons.append(f"共同登場角色: {', '.join(common_chars)}")

            # 3. 關鍵字命中加成 (對白關鍵詞、特殊道具或地點名稱)
            lower_text = text.lower()
            hit_tokens = [tok for tok in query_tokens if tok in lower_text]
            if hit_tokens:
                bonus = min(len(hit_tokens) * 0.08, 0.3)
                score += bonus
                if len(hit_tokens) >= 2:
                    reasons.append(f"情節關鍵詞命中: {', '.join(hit_tokens[:3])}")

            # 4. 歷史距離衰減調整 (稍微偏向更有意義的轉折章節)
            score = max(0.0, score)

            if score > 0.15:
                reason_str = " · ".join(reasons) if reasons else "情境語意自然呼應"
                scored_candidates.append({
                    "id": chk_id,
                    "chapter_number": ch_num,
                    "chapter_title": ch_title,
                    "text": text,
                    "score": round(score, 3),
                    "reason": reason_str,
                    "characters": chk_chars
                })

        # 按分數降序排列，取前 top_k
        scored_candidates.sort(key=lambda x: x["score"], reverse=True)
        top_results = scored_candidates[:top_k]

        return [
            RecalledScene(
                id=c["id"],
                chapter_number=c["chapter_number"],
                chapter_title=c["chapter_title"],
                text=c["text"],
                score=c["score"],
                reason=c["reason"],
                characters=c["characters"]
            )
            for c in top_results
        ]

    @staticmethod
    def build_rag_prompt(recalled_scenes: List[RecalledScene]) -> str:
        """
        將回撈出的歷史情節片段格式化為 LLM 系統提示詞
        """
        if not recalled_scenes:
            return ""

        entries = []
        for s in recalled_scenes:
            clean_snippet = s.text.strip().replace("\n\n", " ")
            if len(clean_snippet) > 280:
                clean_snippet = clean_snippet[:280] + "..."
            entries.append(
                f"📌 [歷史回憶：來自第 {s.chapter_number} 章《{s.chapter_title}》] (關聯理由: {s.reason}):\n"
                f"   「{clean_snippet}」"
            )

        rag_prompt = (
            "【★★★★★ 長時記憶：深層歷史情節與昔日對話回扣 (RAG 回撈) ★★★★★】\n"
            "（系統自前面的歷史篇章中檢索出以下與本章情境高度呼應的過去片段。寫作時請在適當時機自然回扣這段往事、台詞或場景細節，強化長篇故事的宿命感與因果層次）：\n\n"
            + "\n\n".join(entries)
            + "\n\n"
        )
        return rag_prompt
