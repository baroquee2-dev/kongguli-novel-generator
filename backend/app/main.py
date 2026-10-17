import os
import uuid
import json
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import PlainTextResponse, StreamingResponse, JSONResponse

from app.models import (
    AISettings, Novel, GameProject, Location, Character, Chapter, LoreItem,
    GenerateOutlineRequest, GenerateLocationsRequest,
    GenerateCharactersRequest, GenerateChapterRequest,
    ContinueWritingRequest, GenerateChapterSummaryRequest,
    AnalyzeLoreItemsRequest, QueryRagRequest, RecalledScene,
    GameTurnRequest, GameTurnResponse, GameTurnHistoryItem,
    CharacterCard, ChatSession, ChatMessage, RecalledChatTurn,
    GenerateCharacterCardRequest, ChatReplyRequest, SummarizeChatMemoryRequest
)
from app.config import get_settings, save_settings, UPLOADS_DIR
from app.db import (
    list_novels, get_novel, save_novel, delete_novel, create_sample_novel,
    list_games, get_game, save_game, delete_game, create_sample_game,
    list_character_cards, get_character_card, save_character_card, delete_character_card,
    create_sample_character_card, extract_chara_from_png_bytes, parse_sillytavern_card_dict,
    export_sillytavern_v2_dict, list_chat_sessions, get_chat_session, save_chat_session,
    delete_chat_session, create_new_chat_session
)
from app.ai_service import AIService, clean_json_string, extract_json_data
from app.rag_service import RAGService
from app import prompts

def get_project_or_game(project_id: str):
    """查詢小說或遊戲專案 (優先查詢小說，若無則查詢遊戲)"""
    n = get_novel(project_id)
    if n:
        return n
    g = get_game(project_id)
    if g:
        return g
    return None

def save_project_or_game(project):
    """依據專案類型自動儲存至小說或遊戲資料夾"""
    if isinstance(project, GameProject):
        return save_game(project)
    return save_novel(project)

app = FastAPI(title="KongGuLi-孔固力自動小說生成器 API", version="1.0.0")

# CORS 設定，允許前端本地跨域呼叫
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 靜態檔案掛載 (用於上傳角色圖片)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


# ==================== 1. AI 設定 API ====================
@app.get("/api/settings", response_model=AISettings)
async def api_get_settings():
    return get_settings()

@app.post("/api/settings", response_model=AISettings)
async def api_save_settings(settings: AISettings):
    return save_settings(settings)

@app.post("/api/settings/test")
async def api_test_connection(settings: AISettings):
    result = await AIService.test_connection(settings)
    if result.get("success") and result.get("models"):
        try:
            curr = get_settings()
            prov = settings.provider
            if prov in curr.providers:
                curr.providers[prov].cached_models = result["models"]
                save_settings(curr)
        except Exception as e:
            print(f"Error caching models during test: {e}")
    return result

@app.post("/api/settings/models")
async def api_get_models(settings: AISettings):
    models = await AIService.fetch_models(settings)
    if models:
        try:
            curr = get_settings()
            prov = settings.provider
            if prov in curr.providers:
                curr.providers[prov].cached_models = models
                save_settings(curr)
        except Exception as e:
            print(f"Error caching models during fetch: {e}")
    return {"models": models}


# ==================== 2. 小說專案 CRUD API ====================
@app.get("/api/novels")
async def api_list_novels():
    novels = list_novels()
    if not novels:
        # 如果完全沒有小說，自動建立一個精美的範例作品供參考
        sample = create_sample_novel()
        novels = list_novels()
    return novels

@app.post("/api/novels", response_model=Novel)
async def api_create_novel(novel: Novel):
    if not novel.id:
        novel.id = str(uuid.uuid4())[:8]
    return save_novel(novel)

@app.get("/api/novels/{novel_id}", response_model=Novel)
async def api_get_novel(novel_id: str):
    n = get_novel(novel_id)
    if not n:
        raise HTTPException(status_code=404, detail="找不到指定小說")
    return n

@app.put("/api/novels/{novel_id}", response_model=Novel)
async def api_update_novel(novel_id: str, novel: Novel, background_tasks: BackgroundTasks):
    novel.id = novel_id
    saved = save_novel(novel)
    # 背景自動非同步重構/更新 RAG 向量索引
    background_tasks.add_task(RAGService.index_novel, saved)
    return saved

@app.delete("/api/novels/{novel_id}")
async def api_delete_novel(novel_id: str):
    success = delete_novel(novel_id)
    if not success:
        raise HTTPException(status_code=404, detail="找不到指定小說")
    RAGService.delete_novel_index(novel_id)
    return {"success": True}

@app.post("/api/novels/init-sample", response_model=Novel)
async def api_init_sample():
    return create_sample_novel()

@app.get("/api/novels/{novel_id}/export", response_class=PlainTextResponse)
async def api_export_novel(novel_id: str):
    """匯出小說全書為 Markdown / TXT 格式"""
    n = get_novel(novel_id)
    if not n:
        raise HTTPException(status_code=404, detail="找不到指定小說")
    
    lines = []
    lines.append(f"# {n.title}\n")
    lines.append(f"**題材**：{n.genre}  |  **基調**：{n.tone}\n")
    lines.append(f"## 【世界觀】\n{n.world_background}\n")
    lines.append(f"## 【核心主線架構】\n{n.main_plot}\n")
    lines.append("\n---\n")
    
    # 章節排序輸出
    sorted_chapters = sorted(n.chapters, key=lambda c: c.chapter_number)
    for chap in sorted_chapters:
        lines.append(f"\n## {chap.title}\n")
        if chap.outline:
            lines.append(f"> 【本章大綱】: {chap.outline}\n")
        lines.append(f"\n{chap.content}\n")
        lines.append("\n")
    
    content = "\n".join(lines)
    encoded_filename = urllib.parse.quote(f"{n.title}.md")
    return PlainTextResponse(
        content,
        headers={"Content-Disposition": f"attachment; filename*=utf-8''{encoded_filename}; filename=\"export.md\""}
    )

# ==================== 2.5 遊戲專案 CRUD API ====================
@app.get("/api/games")
async def api_list_games():
    games = list_games()
    if not games:
        create_sample_game()
        games = list_games()
    return games

@app.post("/api/games", response_model=GameProject)
async def api_create_game(game: GameProject):
    if not game.id:
        game.id = str(uuid.uuid4())[:8]
    return save_game(game)

@app.get("/api/games/{game_id}", response_model=GameProject)
async def api_get_game(game_id: str):
    g = get_game(game_id)
    if not g:
        raise HTTPException(status_code=404, detail="找不到指定遊戲專案")
    return g

@app.put("/api/games/{game_id}", response_model=GameProject)
async def api_update_game(game_id: str, game: GameProject):
    game.id = game_id
    saved = save_game(game)
    return saved

@app.delete("/api/games/{game_id}")
async def api_delete_game(game_id: str):
    success = delete_game(game_id)
    if not success:
        raise HTTPException(status_code=404, detail="找不到指定遊戲專案")
    return {"success": True}

@app.post("/api/games/init-sample", response_model=GameProject)
async def api_init_sample_game():
    return create_sample_game()

@app.get("/api/games/{game_id}/export", response_class=PlainTextResponse)
async def api_export_game(game_id: str):
    """匯出遊戲全書/流程為 Markdown / TXT 格式"""
    g = get_game(game_id)
    if not g:
        raise HTTPException(status_code=404, detail="找不到指定遊戲專案")
    
    lines = []
    lines.append(f"# {g.title} (遊戲專案文檔)\n")
    lines.append(f"**遊戲類型**：{g.genre}  |  **風格基調**：{g.tone}\n")
    lines.append(f"## 【遊戲世界舞台】\n{g.world_background}\n")
    lines.append(f"## 【主線劇情與目標】\n{g.main_plot}\n")
    lines.append("\n---\n")
    
    sorted_chapters = sorted(g.chapters, key=lambda c: c.chapter_number)
    for chap in sorted_chapters:
        lines.append(f"\n## 開局啟始情境：{chap.title}\n")
        if chap.outline:
            lines.append(f"> 【開局情境目標】: {chap.outline}\n")
        plot_text = chap.starting_plot or chap.content
        if plot_text:
            lines.append(f"\n### 【啟始劇情】\n{plot_text}\n")
        if chap.starting_options:
            lines.append("\n### 【開局啟始選項】\n")
            for idx, opt in enumerate(chap.starting_options, 1):
                hint_str = f" （分歧提示：{opt.hint}）" if opt.hint else ""
                lines.append(f"- 選項 {idx}：{opt.text}{hint_str}")
        lines.append("\n")
    
    content = "\n".join(lines)
    encoded_filename = urllib.parse.quote(f"{g.title}.md")
    return PlainTextResponse(
        content,
        headers={"Content-Disposition": f"attachment; filename*=utf-8''{encoded_filename}; filename=\"game_export.md\""}
    )

# ==================== 3. 圖片上傳 API ====================
@app.post("/api/upload-avatar")
async def api_upload_avatar(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower() or ".png"
    filename = f"{uuid.uuid4().hex[:12]}{ext}"
    target_path = UPLOADS_DIR / filename
    
    contents = await file.read()
    with open(target_path, "wb") as f:
        f.write(contents)
    
    return {"url": f"/uploads/{filename}"}


# ==================== 4. AI 輔助發想與生成 API ====================

# 【第 1 層輔助】AI 激盪小說大綱與世界觀
@app.post("/api/ai/generate-outline")
async def api_ai_generate_outline(req: GenerateOutlineRequest):
    style_clause = ""
    if req.global_style_guide and req.global_style_guide.strip():
        style_clause = f"\n【最高優先級·全域文字風格規範】：{req.global_style_guide.strip()}\n（請依據此風格制定世界觀與情節基調）"
    
    user_prompt = f"""請根據以下構想發想一部小說的主體架構：
【用戶靈感/構思】：{req.rough_idea}
【偏好題材】（如有）：{req.genre or "由你推薦"}
【偏好基調】（如有）：{req.tone or "由你推薦"}
【預期書名】（如有）：{req.title or "由你發想"}
{style_clause}
"""
    try:
        raw_resp = await AIService.call_llm(
            system_prompt=prompts.OUTLINE_SYSTEM,
            user_prompt=user_prompt
        )
        data = extract_json_data(raw_resp)
        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
            data = data[0]
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 發想失敗: {str(e)}")


# 【第 2 層輔助】AI 發想地點大項目與附屬細節
@app.post("/api/ai/generate-locations")
async def api_ai_generate_locations(req: GenerateLocationsRequest):
    sys_prompt = prompts.get_locations_prompt(req.count, req.global_style_guide or "")
    style_info = f"\n全域文字風格指引：{req.global_style_guide.strip()}" if req.global_style_guide and req.global_style_guide.strip() else ""
    user_prompt = f"""小說名稱：《{req.novel_title}》
題材類型：{req.genre}
核心主線：{req.main_plot or "暫未設定，請依題材自由發想"}
世界觀背景：{req.world_background or "暫未設定，請依題材自由發想"}{style_info}
補充要求或方向：{req.hint or "無特殊偏好，請符合世界觀與全域風格發想具有強烈冒險與衝突感的地點"}
"""
    try:
        raw_resp = await AIService.call_llm(
            system_prompt=sys_prompt,
            user_prompt=user_prompt
        )
        data = extract_json_data(raw_resp)
        
        # 若外層被 dict 包裝，自動解包出 list
        if isinstance(data, dict):
            for k in ["locations", "places", "items", "data", "list"]:
                if k in data and isinstance(data[k], list):
                    data = data[k]
                    break
            else:
                for v in data.values():
                    if isinstance(v, list):
                        data = v
                        break
                else:
                    data = [data]

        if not isinstance(data, list):
            data = [data]
        
        # 轉換為帶有 ID 的格式
        formatted_locations = []
        for loc in data:
            if not isinstance(loc, dict):
                continue
            loc_id = f"loc-{uuid.uuid4().hex[:6]}"
            sub_locs = []
            raw_subs = loc.get("sub_locations", [])
            if isinstance(raw_subs, list):
                for sub in raw_subs:
                    if isinstance(sub, dict):
                        sub_locs.append({
                            "id": f"subloc-{uuid.uuid4().hex[:6]}",
                            "name": sub.get("name", "未命名子場景"),
                            "description": sub.get("description", "")
                        })
            formatted_locations.append({
                "id": loc_id,
                "name": loc.get("name", "未命名地點"),
                "description": loc.get("description", ""),
                "sub_locations": sub_locs
            })
        return formatted_locations
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 地點發想失敗: {str(e)}")


# 【第 3 層輔助】AI 發想角色陣容
@app.post("/api/ai/generate-characters")
async def api_ai_generate_characters(req: GenerateCharactersRequest):
    sys_prompt = prompts.get_characters_prompt(req.count, req.global_style_guide or "")
    style_info = f"\n全域文字風格指引：{req.global_style_guide.strip()}" if req.global_style_guide and req.global_style_guide.strip() else ""
    user_prompt = f"""小說名稱：《{req.novel_title}》
題材類型：{req.genre}
核心主線：{req.main_plot or "暫未設定，請依題材自由發想"}
世界觀背景：{req.world_background or "暫未設定，請依題材自由發想"}{style_info}
補充偏好：{req.hint or "請符合全域文字風格，發想性格鮮明、彼此間有潛在張力或衝突的角色"}
"""
    try:
        raw_resp = await AIService.call_llm(
            system_prompt=sys_prompt,
            user_prompt=user_prompt
        )
        data = extract_json_data(raw_resp)
        
        # 若外層被 dict 包裝，自動解包出 list
        if isinstance(data, dict):
            for k in ["characters", "chars", "people", "items", "data", "list"]:
                if k in data and isinstance(data[k], list):
                    data = data[k]
                    break
            else:
                for v in data.values():
                    if isinstance(v, list):
                        data = v
                        break
                else:
                    data = [data]

        if not isinstance(data, list):
            data = [data]
        
        formatted_chars = []
        for c in data:
            if not isinstance(c, dict):
                continue
            formatted_chars.append({
                "id": f"char-{uuid.uuid4().hex[:6]}",
                "name": c.get("name", "無名角色"),
                "role": c.get("role", "配角"),
                "gender": str(c.get("gender", "")),
                "age": str(c.get("age", "")),
                "appearance": c.get("appearance", ""),
                "profile": c.get("profile", ""),
                "avatar_url": ""
            })
        return formatted_chars
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 角色發想失敗: {str(e)}")


# 【第 4 層核心】融合全部設定，一鍵生成章節正文
@app.post("/api/ai/generate-chapter")
async def api_ai_generate_chapter(req: GenerateChapterRequest):
    novel = get_project_or_game(req.novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="找不到指定小說或遊戲專案")
    
    chapter = next((c for c in novel.chapters if c.id == req.chapter_id), None)
    if not chapter:
        raise HTTPException(status_code=404, detail="找不到指定章節")
    
    # 提取關聯的登場角色資訊
    selected_chars = [c for c in novel.characters if c.id in chapter.selected_character_ids]
    # 若章節未特別勾選，但全書有角色，則提供主要角色作參考
    if not selected_chars and novel.characters:
        selected_chars = novel.characters[:2]
    
    chars_text = ""
    if selected_chars:
        chars_text = "\n".join([
            f"- 【{c.name}】({c.role}, {c.gender or '未知'}, {c.age or '未知岁'})\n  外貌穿著: {c.appearance}\n  性格身世: {c.profile}"
            for c in selected_chars
        ])
    else:
        chars_text = "（本章未特別指派特定主角，由 AI 依劇情自創登場人物或從旁敘事）"

    # 提取關聯的發生地點與子細節資訊
    selected_locs = [l for l in novel.locations if l.id in chapter.selected_location_ids]
    locs_text = ""
    if selected_locs:
        loc_parts = []
        for l in selected_locs:
            # 檢查是否有勾選該地點下的特定子地點
            sub_matches = [s for s in l.sub_locations if s.id in chapter.selected_sub_location_ids]
            sub_text = ""
            if sub_matches:
                sub_text = "  附屬子場景細節:\n" + "\n".join([f"    * {s.name}: {s.description}" for s in sub_matches])
            elif l.sub_locations:
                sub_text = "  參考子場景:\n" + "\n".join([f"    * {s.name}: {s.description}" for s in l.sub_locations[:2]])
            
            loc_parts.append(f"- 【{l.name}】: {l.description}\n{sub_text}")
        locs_text = "\n".join(loc_parts)
    else:
        locs_text = "（由 AI 依劇情流動自由發揮所屬場景）"

    # 長時記憶：全書前情時間線 + 直前章節銜接 + 世界書伏筆記憶庫 + RAG 歷史情節深海回撈
    timeline_text, immediate_context = build_timeline_context(novel, chapter.id)
    lore_text, _ = build_lorebook_context(novel, chapter, req.custom_instruction)
    recalled_scenes = await RAGService.query_historical_scenes(
        novel, chapter, query_hint=req.rag_hint or req.custom_instruction or "", top_k=3
    )
    rag_text = RAGService.build_rag_prompt(recalled_scenes)

    target_words = req.target_words or 2000
    global_style = novel.global_style_guide.strip() if novel.global_style_guide else ""
    sys_prompt = prompts.get_chapter_prompt(target_words, global_style)

    style_header = ""
    if global_style:
        style_header = f"""【★★★★★ 最高優先級·全域 AI 文字風格與行文規範 ★★★★★】
「{global_style}」
（最高約束：請在全章每一句敘述、環境氛圍、心理活動與角色對話中嚴格貫徹此風格！）

"""

    user_prompt = f"""{style_header}請為小說《{novel.title}》撰寫章節正文：

【小說整體背景】
題材類型：{novel.genre}
風格基調：{novel.tone}
核心世界觀：{novel.world_background}
主要劇情主線：{novel.main_plot}

{timeline_text}{lore_text}{rag_text}{immediate_context}【當前章節創作任務】
章節標題：{chapter.title} (第 {chapter.chapter_number} 章)
本章核心大綱與目標事件：
{chapter.outline or "請根據主線推進引人入勝的關鍵事件與衝突"}

【本章發生地點與環境場景】：
{locs_text}

【本章登場角色與特徵】：
{chars_text}

【特別指示】（如有）：
{req.custom_instruction or "無"}

請直接創作引人入勝的正文，發揮細膩生動的文筆：
"""
    try:
        content = await AIService.call_llm(
            system_prompt=sys_prompt,
            user_prompt=user_prompt
        )
        return {"content": content.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"章節正文生成失敗: {str(e)}")


# 【續寫 API】
@app.post("/api/ai/continue-writing")
async def api_ai_continue_writing(req: ContinueWritingRequest):
    novel = get_project_or_game(req.novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="找不到指定小說或遊戲專案")
    
    chapter = next((c for c in novel.chapters if c.id == req.chapter_id), None)
    
    # 截取前文最後 1200 字以提供精準上下文
    prev_text = req.current_content[-1200:] if len(req.current_content) > 1200 else req.current_content
    global_style = novel.global_style_guide.strip() if novel.global_style_guide else ""
    sys_prompt = prompts.get_continue_prompt(req.target_words or 800, global_style)

    style_header = ""
    if global_style:
        style_header = f"""【★★★★★ 最高優先級·全域 AI 文字風格與行文規範 ★★★★★】
「{global_style}」
（續寫文字必須高度吻合此風格規約！）

"""

    timeline_text, _ = build_timeline_context(novel, req.chapter_id)
    lore_text, _ = build_lorebook_context(novel, chapter, req.instruction, prev_text) if chapter else ("", [])
    rag_text = ""
    if chapter:
        recalled_scenes = await RAGService.query_historical_scenes(
            novel, chapter, query_hint=req.rag_hint or req.instruction or "", top_k=2
        )
        rag_text = RAGService.build_rag_prompt(recalled_scenes)

    user_prompt = f"""{style_header}小說名稱：《{novel.title}》
風格基調：{novel.tone}
章節標題：{chapter.title if chapter else "未命名"}

{timeline_text}{lore_text}{rag_text}【當前已有正文的結尾部分】：
...
{prev_text}

【續寫指示】：{req.instruction}
請接續上方文字繼續往下寫：
"""
    try:
        added_content = await AIService.call_llm(
            system_prompt=sys_prompt,
            user_prompt=user_prompt
        )
        return {"added_content": added_content.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"續寫失敗: {str(e)}")


# ==================== 4.45 遊戲長時記憶輔助模組 ====================
def build_game_timeline_context(history: List[GameTurnHistoryItem]) -> tuple[str, str]:
    """
    遊戲模式第一層長時記憶：
    將早期歷史回合 (第 1 至 第 N-4 回合) 提煉為高密度大事記時間線 (Adventure Timeline Chain)；
    最近 4 回合保留完整情境 (Immediate Context)。
    如果總回合數 <= 4，則大事記時間線為空，所有歷史歸為即時情境。
    """
    if not history:
        return ("", "（這是遊戲的第一個分歧決策點，尚無歷史紀錄）")

    total_turns = len(history)
    
    # 若回合數 <= 4，全部保留為即時詳細情境
    if total_turns <= 4:
        recent_lines = []
        for h in history:
            act_type_tag = "【玩家自由鍵入行動】" if h.choice_type == 'custom' else "【玩家選擇之選項】"
            recent_lines.append(f"--- [第 {h.round} 回合] ---\n情境描述：{h.story_segment}\n{act_type_tag}：{h.player_action}")
        recent_block = "\n\n".join(recent_lines)
        return ("", recent_block)

    # 若回合數 > 4：前 1 ~ N-4 回合提煉為大事記時間線
    early_history = history[:-4]
    recent_history = history[-4:]

    timeline_entries = []
    for h in early_history:
        clean_story = (h.story_segment or "").strip().replace("\n", " ")
        story_synopsis = clean_story[:120] + "..." if len(clean_story) > 120 else clean_story
        act_desc = (h.player_action or "").strip()
        timeline_entries.append(
            f"* 【第 {h.round} 回合大事記】：玩家做出抉擇「{act_desc}」-> 局勢發展：{story_synopsis}"
        )

    timeline_text = (
        "【★★★★★ 長時記憶：冒險全歷程大事記時間線 (Adventure Timeline Chain) ★★★★★】\n"
        "（以下是自第 1 回合起累積的大事記因果鏈，請嚴格前後呼應，維持長線因果閉環，杜絕吃書矛盾）：\n\n"
        + "\n\n".join(timeline_entries)
        + "\n\n"
    )

    recent_lines = []
    for h in recent_history:
        act_type_tag = "【玩家自由鍵入行動】" if h.choice_type == 'custom' else "【玩家選擇之選項】"
        recent_lines.append(f"--- [第 {h.round} 回合] ---\n情境描述：{h.story_segment}\n{act_type_tag}：{h.player_action}")
    recent_block = "\n\n".join(recent_lines)

    return (timeline_text, recent_block)


def build_game_lorebook_context(game: Novel, current_action: str, recent_history_text: str, custom_instruction: str = "") -> tuple[str, list[dict]]:
    """
    遊戲模式第二層長時記憶：世界書與關鍵伏筆庫 (Lorebook) 智慧關鍵字掃描與常駐激活機制
    掃描遊戲專案背景、當前玩家行動、直前情境脈絡與額外指示，智慧喚醒符合的世界書卡片。
    """
    if not hasattr(game, 'lore_items') or not game.lore_items:
        return ("", [])

    scan_corpus = f"{game.title} {game.world_background or ''} {current_action} {recent_history_text} {custom_instruction}".lower()

    triggered_items = []
    for item in game.lore_items:
        if not item.is_enabled:
            continue

        trigger_reason = None
        # 1. 常駐全域生效
        if item.is_constant:
            trigger_reason = "常駐生效"
        # 2. 標題完全命中
        elif item.title and item.title.lower() in scan_corpus:
            trigger_reason = f"命中詞條標題「{item.title}」"
        # 3. 關鍵字觸發
        else:
            for kw in (item.keywords or []):
                kw_clean = kw.strip().lower()
                if kw_clean and kw_clean in scan_corpus:
                    trigger_reason = f"命中關鍵字「{kw.strip()}」"
                    break

        if trigger_reason:
            triggered_items.append({
                "id": item.id,
                "title": item.title,
                "category": item.category,
                "trigger_reason": trigger_reason,
                "keywords": item.keywords or [],
                "content": item.content.strip()
            })

    if not triggered_items:
        return ("", [])

    entries_text = []
    for item in triggered_items:
        kw_display = f" [喚醒原因: {item['trigger_reason']}]" if item.get('trigger_reason') else ""
        entries_text.append(
            f"📌【{item['title']}】 (類別: {item['category']}{kw_display}):\n"
            f"   設定真相與因果法則：{item['content']}"
        )

    lore_text = (
        "【★★★★★ 長時記憶：動態喚醒之世界書記憶與關鍵伏筆庫 (Active Lorebook) ★★★★★】\n"
        "（以下世界觀法則與伏筆因符合當前情境或常駐規則已被喚醒，請務必自然融入情節推演或分歧選項）：\n\n"
        + "\n\n".join(entries_text)
        + "\n\n"
    )

    return (lore_text, triggered_items)


# ==================== 4.5 遊戲前台互動遊玩機制 API ====================
@app.post("/api/ai/game-turn", response_model=GameTurnResponse)
async def api_ai_game_turn(req: GameTurnRequest):
    """
    遊戲前台每輪對話與抉擇推演 API：
    根據玩家選擇的選項或自由輸入之行動，結合世界觀設定、登場NPC、地點、大事記時間線、世界書記憶庫與頂層遊戲規則，
    自動推演下一段劇情正文與新的命運選項。
    """
    game = get_project_or_game(req.game_id)
    if not game:
        raise HTTPException(status_code=404, detail="找不到指定遊戲專案")

    # 1. 取得遊戲頂層規則設定
    game_rules = getattr(game, 'game_rules', None)
    rules_text = game_rules.rules_text if game_rules else ""
    choices_list = game_rules.dialog_choices if (game_rules and game_rules.dialog_choices) else [3]
    target_choice_count = choices_list[0] if choices_list else 3
    if target_choice_count not in [3, 4, 5]:
        target_choice_count = 3

    strict_enforcement = game_rules.strict_rule_enforcement if game_rules else True
    global_style = game.global_style_guide.strip() if (hasattr(game, 'global_style_guide') and game.global_style_guide) else ""
    enable_player_stats = getattr(game_rules, 'enable_player_stats', False) if game_rules else False
    initial_stats = getattr(game_rules, 'initial_player_stats', '') if game_rules else ''
    current_player_stats = (req.current_player_stats or initial_stats or '生命值: 100/100, 狀態: [正常]').strip()

    # 2. 彙整世界觀與設定資訊
    chars_text = ""
    if game.characters:
        chars_text = "\n".join([
            f"- 【{c.name}】({c.role}, {c.profile}) 外貌: {c.appearance}"
            for c in game.characters[:6]
        ])
    else:
        chars_text = "（暫無預設NPC，由AI配合情境自由引導）"

    locs_text = ""
    if game.locations:
        locs_text = "\n".join([
            f"- 【{l.name}】: {l.description}"
            for l in game.locations[:5]
        ])
    else:
        locs_text = "（依世界舞台自由展開）"

    # 3. 構建第一層長時記憶：大事記時間線與直前情境 (Adventure Timeline Chain)
    timeline_text, recent_history_block = build_game_timeline_context(req.history)

    # 4. 構建第二層長時記憶：世界書與伏筆庫智慧喚醒 (Dynamic Lorebook Trigger)
    lore_text, triggered_lore_items = build_game_lorebook_context(
        game=game,
        current_action=req.current_action,
        recent_history_text=recent_history_block,
        custom_instruction=req.custom_instruction or ""
    )

    curr_action_tag = "【玩家自創行動】" if req.action_type == 'custom' else "【玩家點選之選項】"

    sys_prompt = prompts.get_game_turn_prompt(
        choice_count=target_choice_count,
        strict_rule_enforcement=strict_enforcement,
        rules_text=rules_text,
        global_style_guide=global_style,
        enable_player_stats=enable_player_stats,
        current_player_stats=current_player_stats if enable_player_stats else ""
    )

    player_stats_block = f"""\n【玩家當前數值狀態（常駐固定記憶）】：\n{current_player_stats}\n（重要：請依據此回合發生的具體事件、受創或消耗，在 JSON 的 updated_player_stats 中更新此數值狀態，並在 stats_changes 簡述變更）\n""" if enable_player_stats else ""

    user_prompt = f"""【遊戲專案基本資訊】
遊戲名稱：《{game.title}》
遊戲類型：{game.genre}
風格基調：{game.tone}
世界觀舞台：{game.world_background or "未特別定義，依類型發揮"}
核心主線目標：{game.main_plot or "推進探索與解謎冒險"}
{player_stats_block}
【登場NPC角色庫】：
{chars_text}

【主要探索場景】：
{locs_text}

{lore_text if lore_text else "【世界書記憶與關鍵伏筆庫】：\n（當前暫無喚醒的特定伏筆條目，請依世界觀常態演繹）\n\n"}{timeline_text}【直前最新回合情境脈絡】：
{recent_history_block}

【當前玩家最新行動】：
{curr_action_tag}：{req.current_action}

請根據上述遊戲設定、長時記憶因果鏈以及頂層規則約束，推演接下來發生的劇情，並產出下一輪恰好 {target_choice_count} 個選項：
"""

    try:
        raw_resp = await AIService.call_llm(
            system_prompt=sys_prompt,
            user_prompt=user_prompt,
            max_tokens=2500
        )
        if not raw_resp or not raw_resp.strip():
            raise HTTPException(status_code=502, detail="AI 模型回傳內容為空白，請檢查 API Key 設定或網路連線")

        data = extract_json_data(raw_resp)
        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
            data = data[0]

        if not isinstance(data, dict):
            raise HTTPException(status_code=502, detail="AI 模型未回傳有效的 JSON 劇情格式")

        story_continuation = (data.get("story_continuation") or data.get("story") or "").strip()
        if not story_continuation:
            raise HTTPException(status_code=502, detail="AI 模型未能產出劇情正文（回傳文字為空白）")

        raw_choices = data.get("choices") or []
        formatted_choices = []
        if isinstance(raw_choices, list):
            for i, opt in enumerate(raw_choices, 1):
                if isinstance(opt, dict):
                    formatted_choices.append({
                        "id": opt.get("id") or f"opt-{uuid.uuid4().hex[:6]}",
                        "text": opt.get("text", f"行動決策 {i}"),
                        "hint": opt.get("hint", "")
                    })
                elif isinstance(opt, str):
                    formatted_choices.append({
                        "id": f"opt-{uuid.uuid4().hex[:6]}",
                        "text": opt,
                        "hint": ""
                    })

        while len(formatted_choices) < target_choice_count:
            idx = len(formatted_choices) + 1
            formatted_choices.append({
                "id": f"opt-{uuid.uuid4().hex[:6]}",
                "text": f"選項 {idx}：審慎觀察周遭並決定下一步",
                "hint": "保持謹慎與警惕"
            })

        status_summary = data.get("status_summary", "")
        updated_player_stats = data.get("updated_player_stats", "") if enable_player_stats else ""
        stats_changes = data.get("stats_changes", "") if enable_player_stats else ""
        current_round = len(req.history) + 1

        return {
            "story_continuation": story_continuation,
            "choices": formatted_choices[:target_choice_count],
            "status_summary": status_summary,
            "updated_player_stats": updated_player_stats.strip() if updated_player_stats else current_player_stats,
            "stats_changes": stats_changes.strip(),
            "round": current_round,
            "triggered_lore_items": triggered_lore_items
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"遊戲回合推演失敗: {str(e)}")


def build_timeline_context(novel: Novel, current_chapter_id: str) -> tuple[str, str]:
    """
    第一階段長時記憶：構建全書前情大事記時間線 (Timeline Chain) 與直前章節結尾銜接點 (Immediate Transition)
    """
    sorted_chaps = sorted(novel.chapters, key=lambda c: c.chapter_number)
    curr_idx = next((i for i, c in enumerate(sorted_chaps) if c.id == current_chapter_id), 0)
    
    if curr_idx <= 0:
        return ("", "")
        
    char_map = {c.id: c.name for c in novel.characters if c.id}
    timeline_entries = []
    
    # 取當前章節之前的所有歷史章節 (0 到 curr_idx - 1)
    for c in sorted_chaps[:curr_idx]:
        synopsis = ""
        if c.summary and c.summary.strip():
            synopsis = c.summary.strip()
        elif c.outline and c.outline.strip():
            synopsis = f"【本章大綱推進】{c.outline.strip()}"
        elif c.content and c.content.strip():
            clean_c = c.content.strip().replace("\n", " ")
            synopsis = clean_c[:150] + "..." if len(clean_c) > 150 else clean_c
        else:
            synopsis = "（情節順利推展）"
            
        cast = [char_map[cid] for cid in c.selected_character_ids if cid in char_map]
        cast_str = f" [登場角色: {', '.join(cast)}]" if cast else ""
        
        timeline_entries.append(
            f"* 第 {c.chapter_number} 章《{c.title}》{cast_str}：\n  {synopsis}"
        )
        
    timeline_text = (
        f"【★★★★★ 長時記憶：全書前情大事記時間線 (Story Timeline) ★★★★★】\n"
        f"（以下是自第 1 章至第 {sorted_chaps[curr_idx-1].chapter_number} 章已經歷的所有前情大事件與因果脈絡，請嚴格前後呼應，杜絕矛盾吃書）：\n\n"
        + "\n\n".join(timeline_entries)
        + "\n\n"
    )
    
    # 直前上一章的詳細結尾銜接點 (Immediate Transition)
    prev_chap = sorted_chaps[curr_idx - 1]
    prev_tail = ""
    if prev_chap.content and prev_chap.content.strip():
        content_stripped = prev_chap.content.strip()
        prev_tail = content_stripped[-500:] if len(content_stripped) > 500 else content_stripped
    elif prev_chap.summary:
        prev_tail = prev_chap.summary
    else:
        prev_tail = prev_chap.outline or "前章順利落幕"
        
    immediate_context = (
        f"【直前章節（第 {prev_chap.chapter_number} 章 《{prev_chap.title}》）最新進展與正文結尾銜接點】：\n"
        f"...\n{prev_tail}\n"
        f"（重要：本章正文開頭請自然流暢地緊密接續上述情境與人物動態，展開本章新的衝突與冒險）\n\n"
    )
    
    return (timeline_text, immediate_context)


def build_lorebook_context(novel: Novel, chapter: Chapter, custom_instruction: str = "", current_tail: str = "") -> tuple[str, list[dict]]:
    """
    第二階段長時記憶：世界書與關鍵伏筆 (Lorebook) 智慧關鍵字掃描與常駐激活機制
    """
    if not hasattr(novel, 'lore_items') or not novel.lore_items:
        return ("", [])
        
    char_names = [c.name for c in novel.characters if c.id in chapter.selected_character_ids]
    loc_names = [l.name for l in novel.locations if l.id in chapter.selected_location_ids]
    
    # 組合待掃描的文本池 (標題 + 大綱 + 特別指示 + 登場角色 + 登場地點 + 最新正文末尾)
    scan_corpus = f"{chapter.title} {chapter.outline or ''} {custom_instruction or ''} {' '.join(char_names)} {' '.join(loc_names)} {current_tail}".lower()
    
    manual_ids = set(chapter.selected_lore_item_ids or [])
    triggered_items = []
    
    for item in novel.lore_items:
        if not item.is_enabled:
            continue
            
        trigger_reason = None
        
        # 1. 作者手動指定
        if item.id and item.id in manual_ids:
            trigger_reason = "作者手動指定勾選"
        # 2. 常駐全域生效
        elif item.is_constant:
            trigger_reason = "常駐生效"
        # 3. 標題完全命中
        elif item.title and item.title.lower() in scan_corpus:
            trigger_reason = f"命中詞條標題「{item.title}」"
        # 4. 關鍵字觸發
        else:
            for kw in item.keywords:
                kw_clean = kw.strip().lower()
                if kw_clean and kw_clean in scan_corpus:
                    trigger_reason = f"命中關鍵字「{kw.strip()}」"
                    break
                    
        if trigger_reason:
            triggered_items.append({
                "id": item.id,
                "title": item.title,
                "category": item.category,
                "trigger_reason": trigger_reason,
                "keywords": item.keywords,
                "content": item.content.strip()
            })
            
    if not triggered_items:
        return ("", [])
        
    entries_text = []
    for item in triggered_items:
        kw_display = f" [觸發原因: {item['trigger_reason']}]" if item.get('trigger_reason') else ""
        entries_text.append(
            f"📌【{item['title']}】 (類別: {item['category']}{kw_display}):\n"
            f"   詳細設定與真相：{item['content']}"
        )
        
    lore_text = (
        f"【★★★★★ 長時記憶：觸發之關鍵伏筆與世界書記憶庫 (Lorebook) ★★★★★】\n"
        f"（以下是本章情節/人物/關鍵字喚醒的重要設定、重大伏筆與秘密真相，創作時請嚴格遵守，務必與之呼應且不得推翻衝突）：\n\n"
        + "\n\n".join(entries_text)
        + "\n\n"
    )
    
    return (lore_text, triggered_items)


# ==================== 5. SSE 串流創作 API (打字機即時顯示) ====================

@app.post("/api/ai/generate-chapter-stream")
async def api_ai_generate_chapter_stream(req: GenerateChapterRequest):
    novel = get_project_or_game(req.novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="找不到指定小說或遊戲專案")
    
    chapter = next((c for c in novel.chapters if c.id == req.chapter_id), None)
    if not chapter:
        raise HTTPException(status_code=404, detail="找不到指定章節")
    
    selected_chars = [c for c in novel.characters if c.id in chapter.selected_character_ids]
    if not selected_chars and novel.characters:
        selected_chars = novel.characters[:2]
    
    if selected_chars:
        chars_text = "\n".join([
            f"- 【{c.name}】({c.role}, {c.gender or '未知'}, {c.age or '未知岁'})\n  外貌穿著: {c.appearance}\n  性格身世: {c.profile}"
            for c in selected_chars
        ])
    else:
        chars_text = "（本章未特別指派特定主角，由 AI 依劇情自創登場人物或從旁敘事）"

    selected_locs = [l for l in novel.locations if l.id in chapter.selected_location_ids]
    if selected_locs:
        loc_parts = []
        for l in selected_locs:
            sub_matches = [s for s in l.sub_locations if s.id in chapter.selected_sub_location_ids]
            sub_text = ""
            if sub_matches:
                sub_text = "  附屬子場景細節:\n" + "\n".join([f"    * {s.name}: {s.description}" for s in sub_matches])
            elif l.sub_locations:
                sub_text = "  參考子場景:\n" + "\n".join([f"    * {s.name}: {s.description}" for s in l.sub_locations[:2]])
            loc_parts.append(f"- 【{l.name}】: {l.description}\n{sub_text}")
        locs_text = "\n".join(loc_parts)
    else:
        locs_text = "（由 AI 依劇情流動自由發揮所屬場景）"

    # 長時記憶：全書前情時間線 + 直前章節銜接 + 世界書伏筆記憶庫 + RAG 歷史情節深海回撈
    timeline_text, immediate_context = build_timeline_context(novel, chapter.id)
    lore_text, _ = build_lorebook_context(novel, chapter, req.custom_instruction)
    recalled_scenes = await RAGService.query_historical_scenes(
        novel, chapter, query_hint=req.rag_hint or req.custom_instruction or "", top_k=3
    )
    rag_text = RAGService.build_rag_prompt(recalled_scenes)

    target_words = req.target_words or 2000
    global_style = novel.global_style_guide.strip() if novel.global_style_guide else ""
    sys_prompt = prompts.get_chapter_prompt(target_words, global_style)

    style_header = ""
    if global_style:
        style_header = f"""【★★★★★ 最高優先級·全域 AI 文字風格與行文規範 ★★★★★】
「{global_style}」
（最高約束：請在全章每一句敘述、環境氛圍、心理活動與角色對話中嚴格貫徹此風格！）

"""

    user_prompt = f"""{style_header}請為小說《{novel.title}》撰寫章節正文：

【小說整體背景】
題材類型：{novel.genre}
風格基調：{novel.tone}
核心世界觀：{novel.world_background}
主要劇情主線：{novel.main_plot}

{timeline_text}{lore_text}{rag_text}{immediate_context}【當前章節創作任務】
章節標題：{chapter.title} (第 {chapter.chapter_number} 章)
本章核心大綱與目標事件：
{chapter.outline or "請根據主線推進引人入勝的關鍵事件與衝突"}

【本章發生地點與環境場景】：
{locs_text}

【本章登場角色與特徵】：
{chars_text}

【特別指示】（如有）：
{req.custom_instruction or "無"}

請直接創作引人入勝的正文，發揮細膩生動的文筆：
"""

    async def event_generator():
        has_yielded = False
        try:
            async for chunk in AIService.call_llm_stream(
                system_prompt=sys_prompt,
                user_prompt=user_prompt
            ):
                if chunk:
                    has_yielded = True
                    yield f"data: {json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
            if not has_yielded:
                yield f"data: {json.dumps({'error': 'AI 生成已結束，但未輸出任何文字內容（AI 回傳空白）。可能是模型未響應或觸發安全審查。'}, ensure_ascii=False)}\n\n"
            else:
                yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/ai/continue-writing-stream")
async def api_ai_continue_writing_stream(req: ContinueWritingRequest):
    novel = get_project_or_game(req.novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="找不到指定小說或遊戲專案")
    
    chapter = next((c for c in novel.chapters if c.id == req.chapter_id), None)
    prev_text = req.current_content[-1200:] if len(req.current_content) > 1200 else req.current_content
    global_style = novel.global_style_guide.strip() if novel.global_style_guide else ""
    sys_prompt = prompts.get_continue_prompt(req.target_words or 800, global_style)

    style_header = ""
    if global_style:
        style_header = f"""【★★★★★ 最高優先級·全域 AI 文字風格與行文規範 ★★★★★】
「{global_style}」
（續寫文字必須高度吻合此風格規約！）

"""

    timeline_text, _ = build_timeline_context(novel, req.chapter_id)
    lore_text, _ = build_lorebook_context(novel, chapter, req.instruction, prev_text) if chapter else ("", [])
    rag_text = ""
    if chapter:
        recalled_scenes = await RAGService.query_historical_scenes(
            novel, chapter, query_hint=req.rag_hint or req.instruction or "", top_k=2
        )
        rag_text = RAGService.build_rag_prompt(recalled_scenes)

    user_prompt = f"""{style_header}小說名稱：《{novel.title}》
風格基調：{novel.tone}
章節標題：{chapter.title if chapter else "未命名"}

{timeline_text}{lore_text}{rag_text}【當前已有正文的結尾部分】：
...
{prev_text}

【續寫指示】：{req.instruction}
請接續上方文字繼續往下寫：
"""

    async def event_generator():
        has_yielded = False
        try:
            async for chunk in AIService.call_llm_stream(
                system_prompt=sys_prompt,
                user_prompt=user_prompt
            ):
                if chunk:
                    has_yielded = True
                    yield f"data: {json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
            if not has_yielded:
                yield f"data: {json.dumps({'error': 'AI 續寫已結束，但未輸出任何文字內容（AI 回傳空白）。可能是模型未響應或觸發安全審查。'}, ensure_ascii=False)}\n\n"
            else:
                yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# ==================== 6. 長時記憶：AI 提煉章節紀要小結 API ====================

@app.post("/api/ai/generate-chapter-summary")
async def api_ai_generate_chapter_summary(req: GenerateChapterSummaryRequest):
    novel = get_project_or_game(req.novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="找不到指定小說或遊戲專案")
        
    chapter = next((c for c in novel.chapters if c.id == req.chapter_id), None)
    if not chapter:
        raise HTTPException(status_code=404, detail="找不到指定章節")
        
    content_to_summarize = (chapter.content or "").strip()
    if not content_to_summarize:
        raise HTTPException(status_code=400, detail="本章尚無正文內容，請先撰寫或由 AI 生成正文後再提煉小結")
        
    sample_text = content_to_summarize[:6000]
    global_style = novel.global_style_guide.strip() if novel.global_style_guide else ""
    sys_prompt = prompts.get_summary_prompt(global_style)
    
    user_prompt = f"""請為小說《{novel.title}》的第 {chapter.chapter_number} 章《{chapter.title}》提煉本章大事紀事小結：

【本章大綱】：
{chapter.outline or "無"}

【本章正文節錄】：
{sample_text}

請提煉出 60~120 字的本章大事紀事小結（交代核心推進、重要人物關係與關鍵伏筆）："""

    try:
        summary = await AIService.call_llm(
            system_prompt=sys_prompt,
            user_prompt=user_prompt,
            temperature=0.3,
            max_tokens=300
        )
        clean_summary = summary.strip().replace("\n", " ")
        chapter.summary = clean_summary
        save_project_or_game(novel)
        return {"summary": clean_summary, "novel": novel}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"提煉小結失敗: {str(e)}")


# ==================== 7. 長時記憶：AI 深度分析提煉伏筆與世界書卡片 ====================

@app.post("/api/ai/analyze-lore-items")
async def api_ai_analyze_lore_items(req: AnalyzeLoreItemsRequest):
    novel = get_project_or_game(req.novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="找不到指定小說或遊戲專案")
        
    global_style = novel.global_style_guide.strip() if novel.global_style_guide else ""
    sys_prompt = prompts.get_lore_analyze_prompt(req.count or 4, global_style)
    
    # 組合小說現有精華資訊
    char_summaries = [f"- {c.name} ({c.role}): {c.profile}" for c in novel.characters[:6]]
    char_info = "\n".join(char_summaries) if char_summaries else "暫無角色資料"
    
    chapter_summaries = []
    for c in sorted(novel.chapters, key=lambda x: x.chapter_number)[:8]:
        s = c.summary or c.outline or ""
        chapter_summaries.append(f"- 第 {c.chapter_number} 章《{c.title}》: {s[:100]}")
    chaps_info = "\n".join(chapter_summaries) if chapter_summaries else "暫無章節資料"
    
    existing_lore_titles = [f"【{item.title}】({item.category})" for item in (novel.lore_items or [])]
    existing_info = "、".join(existing_lore_titles) if existing_lore_titles else "目前尚未建立任何伏筆卡片"
    
    user_prompt = f"""請為這部小說深度分析並提煉出 {req.count or 4} 個關鍵的世界書與伏筆記憶卡片：
【書名】：{novel.title}
【題材與基調】：{novel.genre} / {novel.tone}
【世界觀背景】：{novel.world_background}
【主要核心主線】：{novel.main_plot}

【已有角色設定】：
{char_info}

【目前章節劇情推展】：
{chaps_info}

【已存在的記憶條目（請勿重複提煉相同設定）】：
{existing_info}

【作者補充指引】：{req.hint or "無特殊指引，請從主線伏筆、關鍵道具、誓約或世界特殊法則著手"}
"""

    try:
        raw_resp = await AIService.call_llm(
            system_prompt=sys_prompt,
            user_prompt=user_prompt,
            temperature=0.75,
            max_tokens=2500
        )
        extracted = extract_json_data(raw_resp)
        if isinstance(extracted, list):
            items = []
            for d in extracted:
                if isinstance(d, dict) and d.get("title"):
                    items.append({
                        "id": f"lore-{uuid.uuid4().hex[:8]}",
                        "title": d.get("title", "未命名詞條"),
                        "category": d.get("category", "伏筆秘密"),
                        "keywords": d.get("keywords", []),
                        "content": d.get("content", ""),
                        "is_constant": bool(d.get("is_constant", False)),
                        "is_enabled": True
                    })
            return {"items": items}
        return {"items": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"提煉世界書伏筆卡片失敗: {str(e)}")


@app.get("/api/novels/{novel_id}/chapters/{chapter_id}/preview-lore")
@app.get("/api/games/{novel_id}/chapters/{chapter_id}/preview-lore")
async def api_preview_chapter_lore(novel_id: str, chapter_id: str):
    novel = get_project_or_game(novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="找不到小說或遊戲專案")
    chapter = next((c for c in novel.chapters if c.id == chapter_id), None)
    if not chapter:
        raise HTTPException(status_code=404, detail="找不到指定章節")
        
    lore_text, triggered = build_lorebook_context(novel, chapter)
    return {
        "triggered_items": triggered,
        "all_items": [item.model_dump() for item in (novel.lore_items or [])],
        "lore_prompt_text": lore_text
    }


# ==================== 8. 長時記憶：RAG 歷史深海回撈與索引維護 API ====================

@app.post("/api/ai/rag/query", response_model=List[RecalledScene])
async def api_query_rag(req: QueryRagRequest):
    novel = get_project_or_game(req.novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="找不到小說或遊戲專案")
    chapter = next((c for c in novel.chapters if c.id == req.chapter_id), None)
    if not chapter:
        raise HTTPException(status_code=404, detail="找不到指定章節")
    
    return await RAGService.query_historical_scenes(
        novel=novel,
        current_chapter=chapter,
        query_hint=req.hint or "",
        top_k=req.top_k or 3
    )


@app.get("/api/novels/{novel_id}/chapters/{chapter_id}/preview-rag")
@app.get("/api/games/{novel_id}/chapters/{chapter_id}/preview-rag")
async def api_preview_chapter_rag(novel_id: str, chapter_id: str, hint: Optional[str] = ""):
    novel = get_project_or_game(novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="找不到小說或遊戲專案")
    chapter = next((c for c in novel.chapters if c.id == chapter_id), None)
    if not chapter:
        raise HTTPException(status_code=404, detail="找不到指定章節")
        
    scenes = await RAGService.query_historical_scenes(
        novel=novel,
        current_chapter=chapter,
        query_hint=hint or "",
        top_k=3
    )
    rag_prompt_text = RAGService.build_rag_prompt(scenes)
    return {
        "recalled_scenes": [s.model_dump() for s in scenes],
        "rag_prompt_text": rag_prompt_text
    }


@app.post("/api/ai/rag/reindex/{novel_id}")
async def api_reindex_novel_rag(novel_id: str, background_tasks: BackgroundTasks):
    novel = get_project_or_game(novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="找不到小說或遊戲專案")
        
    background_tasks.add_task(RAGService.index_novel, novel)
    return {
        "status": "ok",
        "message": f"已在背景排程重構《{novel.title}》的全域 RAG 向量索引庫"
    }


# ==================== 9. 角色聊天版本 API (SillyTavern 相容角色卡 & 對話長時記憶/RAG) ====================

@app.get("/api/character-cards")
async def api_list_character_cards():
    cards = list_character_cards()
    if not cards:
        sample = create_sample_character_card()
        cards = list_character_cards()
    return cards


@app.post("/api/character-cards/init-sample", response_model=CharacterCard)
async def api_init_sample_character_card():
    return create_sample_character_card()


@app.get("/api/character-cards/{card_id}", response_model=CharacterCard)
async def api_get_character_card(card_id: str):
    card = get_character_card(card_id)
    if not card:
        raise HTTPException(status_code=404, detail="找不到指定角色卡")
    return card


@app.post("/api/character-cards", response_model=CharacterCard)
async def api_create_character_card(card: CharacterCard):
    card.id = f"charcard-{uuid.uuid4().hex[:8]}"
    if not card.first_mes:
        card.first_mes = f"*{{{{char}}}}微笑著看向{{{{user}}}}。*\n「你好，我是{card.name}，很高興認識你。」"
    return save_character_card(card)


@app.put("/api/character-cards/{card_id}", response_model=CharacterCard)
async def api_update_character_card(card_id: str, card: CharacterCard):
    card.id = card_id
    return save_character_card(card)


@app.delete("/api/character-cards/{card_id}")
async def api_delete_character_card(card_id: str):
    ok = delete_character_card(card_id)
    if not ok:
        raise HTTPException(status_code=404, detail="刪除失敗，找不到指定角色卡")
    return {"status": "deleted"}


@app.post("/api/character-cards/import", response_model=CharacterCard)
async def api_import_character_card(file: UploadFile = File(...)):
    """
    匯入 SillyTavern 角色卡：
    支援 .json (V1 / V2 / V3) 以及 .png (內嵌 tEXt/zTXt/iTXt chara/ccv3 Base64 JSON 的角色卡圖片，同時將圖片設為角色立繪)
    """
    filename = (file.filename or "").lower()
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="上傳的檔案內容為空")

    if filename.endswith(".png") or raw_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        # 1. 先將 PNG 儲存至 uploads 作為角色立繪圖片
        img_name = f"stcard-{uuid.uuid4().hex[:10]}.png"
        img_path = UPLOADS_DIR / img_name
        with open(img_path, "wb") as f:
            f.write(raw_bytes)
        avatar_url = f"/uploads/{img_name}"

        # 2. 解析 PNG chunk 中的 SillyTavern metadata
        st_dict = extract_chara_from_png_bytes(raw_bytes)
        if st_dict:
            return parse_sillytavern_card_dict(st_dict, avatar_url=avatar_url)
        else:
            # 若是一般無內嵌 metadata 的 PNG 圖片，建立一張以該圖片為立繪的角色卡
            base_title = Path(file.filename or "新角色").stem
            new_card = CharacterCard(
                id=f"charcard-{uuid.uuid4().hex[:8]}",
                name=base_title,
                avatar_url=avatar_url,
                description=f"{base_title} 的角色設定。",
                first_mes=f"*{{{{char}}}}看向{{{{user}}}}。*\n「你好，我是{base_title}。」",
                creator_notes="由 PNG 圖片建立（未偵測到內嵌 SillyTavern metadata，已自動設為角色立繪）"
            )
            return save_character_card(new_card)

    # JSON 格式角色卡解析
    try:
        text_content = raw_bytes.decode("utf-8-sig")
        json_data = json.loads(text_content)
        if not isinstance(json_data, dict):
            raise ValueError("JSON 根節點必須為物件")
        return parse_sillytavern_card_dict(json_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"無法解析 SillyTavern 角色卡檔案：{str(e)}")


@app.get("/api/character-cards/{card_id}/export-json")
async def api_export_character_card_json(card_id: str):
    card = get_character_card(card_id)
    if not card:
        raise HTTPException(status_code=404, detail="找不到指定角色卡")
    st_data = export_sillytavern_v2_dict(card)
    safe_name = urllib.parse.quote(f"{card.name}_SillyTavern_V2.json")
    content_bytes = json.dumps(st_data, ensure_ascii=False, indent=2).encode("utf-8")
    return StreamingResponse(
        iter([content_bytes]),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{safe_name}"}
    )


@app.post("/api/ai/generate-character-card")
async def api_ai_generate_character_card(req: GenerateCharacterCardRequest):
    user_prompt = f"""【角色名稱提示】：{req.name_hint or "請自行命名富有魅力的名字"}
【角色核心靈感與設定構想】：
{req.rough_idea}

請根據上述構想，生成一張完整的 SillyTavern V2 相容角色卡設定（含開場白、備選開場白、對話範例與角色專屬世界書詞條）：
"""
    try:
        raw_resp = await AIService.call_llm(
            system_prompt=prompts.GENERATE_CHARACTER_CARD_SYSTEM,
            user_prompt=user_prompt,
            temperature=0.8,
            max_tokens=3000
        )
        data = extract_json_data(raw_resp)
        if not isinstance(data, dict):
            raise ValueError("AI 未回傳有效的 JSON 角色卡結構")

        lore_list = []
        if req.include_lore and isinstance(data.get("lore_items"), list):
            for item in data["lore_items"]:
                if isinstance(item, dict) and item.get("title") and item.get("content"):
                    lore_list.append({
                        "id": f"lore-{uuid.uuid4().hex[:8]}",
                        "title": str(item.get("title", "設定詞條")),
                        "category": str(item.get("category", "角色設定")),
                        "keywords": item.get("keywords") if isinstance(item.get("keywords"), list) else [],
                        "content": str(item.get("content", "")),
                        "is_constant": bool(item.get("is_constant", False)),
                        "is_enabled": True
                    })

        data["lore_items"] = lore_list
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 生成角色卡失敗: {str(e)}")


# ==================== 9.5 角色聊天對話紀錄與三層長時記憶 + RAG 推演 API ====================

@app.get("/api/character-chats")
async def api_list_chat_sessions(character_id: Optional[str] = None):
    return list_chat_sessions(character_id=character_id)


@app.post("/api/character-chats", response_model=ChatSession)
async def api_create_chat_session(payload: dict):
    card_id = payload.get("character_id", "")
    user_name = payload.get("user_name", "你")
    greeting_index = int(payload.get("greeting_index", 0) or 0)
    card = get_character_card(card_id)
    if not card:
        raise HTTPException(status_code=404, detail="找不到指定角色卡")
    return create_new_chat_session(card, user_name=user_name, greeting_index=greeting_index)


@app.get("/api/character-chats/{session_id}", response_model=ChatSession)
async def api_get_chat_session(session_id: str):
    session = get_chat_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="找不到指定對話紀錄")
    return session


@app.put("/api/character-chats/{session_id}", response_model=ChatSession)
async def api_update_chat_session(session_id: str, session: ChatSession, background_tasks: BackgroundTasks):
    session.id = session_id
    saved = save_chat_session(session)
    card = get_character_card(session.character_id)
    if card:
        background_tasks.add_task(RAGService.index_chat_session, saved, card.name)
    return saved


@app.delete("/api/character-chats/{session_id}")
async def api_delete_chat_session(session_id: str):
    ok = delete_chat_session(session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="找不到指定對話紀錄")
    RAGService.delete_chat_session_index(session_id)
    return {"status": "deleted"}


def build_chat_timeline_and_recent_context(
    session: ChatSession,
    char_name: str,
    recent_limit: int = 8
) -> tuple[str, str]:
    """
    角色聊天第一層長時記憶：
    結合核心記憶摘要 (memory_summary) + 早期對話壓縮時間線 (Early Chat Timeline) + 最近 N 則完整對話脈絡 (Immediate Context)
    """
    uname = session.user_name or "你"
    blocks = []

    if session.memory_summary and session.memory_summary.strip():
        summary_clean = prompts.replace_st_macros(session.memory_summary.strip(), char_name, uname)
        blocks.append(
            "【★★★★★ 長時記憶核心摘要 (双方關係與重要往事總結) ★★★★★】：\n"
            f"{summary_clean}\n"
        )

    msgs = session.messages or []
    if len(msgs) > recent_limit:
        early_msgs = msgs[:-recent_limit]
        timeline_lines = []
        turn_no = 1
        idx = 0
        while idx < len(early_msgs):
            m = early_msgs[idx]
            c_txt = prompts.replace_st_macros(m.content.strip(), char_name, uname).replace("\n", " ")
            c_short = c_txt[:90] + "..." if len(c_txt) > 90 else c_txt
            if m.role == "user" and (idx + 1) < len(early_msgs) and early_msgs[idx + 1].role == "assistant":
                a_txt = prompts.replace_st_macros(early_msgs[idx + 1].content.strip(), char_name, uname).replace("\n", " ")
                a_short = a_txt[:100] + "..." if len(a_txt) > 100 else a_txt
                timeline_lines.append(f"* [第 {turn_no} 輪] {uname}: 「{c_short}」 -> {char_name}: 「{a_short}」")
                idx += 2
            else:
                speaker = uname if m.role == "user" else char_name
                timeline_lines.append(f"* [早期紀錄] {speaker}: 「{c_short}」")
                idx += 1
            turn_no += 1

        # 取最近 25 條早期濃縮時間線避免超長，更久遠的細節由 RAG 深海回撈負責
        if len(timeline_lines) > 25:
            timeline_lines = timeline_lines[-25:]

        blocks.append(
            "【★★★★★ 長時記憶：早期對話大事記時間線 (Early Conversation Timeline) ★★★★★】：\n"
            + "\n".join(timeline_lines)
            + "\n"
        )

    recent_msgs = msgs[-recent_limit:] if len(msgs) > recent_limit else msgs
    recent_lines = []
    for m in recent_msgs:
        speaker = uname if m.role == "user" else char_name
        txt = prompts.replace_st_macros(m.content.strip(), char_name, uname)
        recent_lines.append(f"{speaker}: {txt}")

    timeline_block = "\n".join(blocks) + "\n" if blocks else ""
    recent_block = "\n\n".join(recent_lines)
    return (timeline_block, recent_block)


def build_chat_lorebook_context(
    card: CharacterCard,
    char_name: str,
    user_name: str,
    scan_text: str
) -> tuple[str, list[dict]]:
    """
    角色聊天第二層長時記憶：角色專屬世界書 (Character Book / Lorebook) 智慧關鍵字掃描與常駐激活
    """
    if not card.lore_items:
        return ("", [])

    corpus = scan_text.lower()
    triggered = []

    for item in card.lore_items:
        if not item.is_enabled:
            continue

        reason = None
        if item.is_constant:
            reason = "常駐生效"
        elif item.title and item.title.lower() in corpus:
            reason = f"命中標題「{item.title}」"
        else:
            for kw in (item.keywords or []):
                kw_clean = kw.strip().lower()
                if kw_clean and kw_clean in corpus:
                    reason = f"命中關鍵字「{kw.strip()}」"
                    break

        if reason:
            clean_content = prompts.replace_st_macros(item.content.strip(), char_name, user_name)
            triggered.append({
                "id": item.id,
                "title": item.title,
                "category": item.category,
                "trigger_reason": reason,
                "keywords": item.keywords or [],
                "content": clean_content
            })

    if not triggered:
        return ("", [])

    lines = []
    for t in triggered:
        lines.append(f"📌【{t['title']}】({t['category']} - {t['trigger_reason']}):\n   {t['content']}")

    lore_prompt = (
        "【★★★★★ 長時記憶：喚醒之角色專屬世界書 (Character Book) ★★★★★】\n"
        + "\n\n".join(lines)
        + "\n\n"
    )
    return (lore_prompt, triggered)


@app.post("/api/ai/character-chat/reply")
async def api_character_chat_reply(req: ChatReplyRequest, background_tasks: BackgroundTasks):
    card = get_character_card(req.character_id)
    if not card:
        raise HTTPException(status_code=404, detail="找不到指定角色卡")
    session = get_chat_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="找不到指定對話紀錄")

    char_name = card.name
    user_name = (session.user_name or card.user_persona_name or "你").strip()

    # 若為一般發送訊息，先把玩家的訊息加入 session.messages
    if not req.is_regenerate:
        user_msg_text = (req.user_message or "").strip()
        if not user_msg_text:
            raise HTTPException(status_code=400, detail="訊息內容不可為空")
        new_user_msg = ChatMessage(
            id=f"msg-{uuid.uuid4().hex[:8]}",
            role="user",
            content=user_msg_text,
            swipes=[user_msg_text],
            swipe_id=0,
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )
        session.messages.append(new_user_msg)

    # 準備用於檢索與推演的上下文（若為重新生成且最後一則是 assistant，先排除最後一則 assistant 以便重新回答）
    context_messages = list(session.messages)
    target_regen_msg: Optional[ChatMessage] = None
    if req.is_regenerate and context_messages and context_messages[-1].role == "assistant":
        target_regen_msg = context_messages.pop()

    # 找出最後一則玩家的發言作為查詢核心
    latest_user_text = ""
    for m in reversed(context_messages):
        if m.role == "user":
            latest_user_text = m.content
            break

    temp_session_for_ctx = ChatSession(
        id=session.id,
        character_id=session.character_id,
        title=session.title,
        user_name=user_name,
        user_persona=session.user_persona,
        memory_summary=session.memory_summary,
        messages=context_messages
    )

    # 1. 第一層長時記憶：核心摘要 + 早期大事記時間線 + 直前對話脈絡
    timeline_block, recent_block = build_chat_timeline_and_recent_context(
        temp_session_for_ctx, char_name=char_name, recent_limit=8
    )

    # 2. 第二層長時記憶：角色世界書 (Character Book) 智慧掃描
    scan_text = f"{latest_user_text} {recent_block[-600:] if recent_block else ''}"
    lore_block, triggered_lore = build_chat_lorebook_context(
        card=card, char_name=char_name, user_name=user_name, scan_text=scan_text
    )

    # 3. 第三層長時記憶：RAG 深海歷史對話語意回撈
    recalled_turns = await RAGService.query_chat_history_rag(
        session=temp_session_for_ctx,
        char_name=char_name,
        query_text=f"{latest_user_text} {req.custom_instruction or ''}".strip(),
        recent_window_messages=8,
        top_k=3
    )
    rag_block = RAGService.build_chat_rag_prompt(recalled_turns)
    recalled_rag_dicts = [r.model_dump() for r in recalled_turns]

    # 4. 組裝 System Prompt 與 User Prompt
    sys_prompt = prompts.get_character_chat_system_prompt(
        char_name=char_name,
        user_name=user_name,
        description=card.description,
        personality=card.personality,
        scenario=card.scenario,
        mes_example=card.mes_example,
        system_prompt=card.system_prompt,
        user_persona=session.user_persona or card.user_persona_desc or ""
    )

    post_inst = prompts.replace_st_macros(card.post_history_instructions or "", char_name, user_name)
    post_block = f"\n【角色深度指令 (Post-History Instructions)】：\n{post_inst}\n" if post_inst else ""
    custom_block = f"\n【單次導演特別指示】：{req.custom_instruction.strip()}\n" if (req.custom_instruction and req.custom_instruction.strip()) else ""

    user_prompt = f"""{lore_block}{rag_block}{timeline_block}【直前最新對話脈絡 (Immediate Context)】：
{recent_block or "（對話剛開始）"}
{post_block}{custom_block}
請以「{char_name}」的身份，自然且生動地接續回覆「{user_name}」（直接輸出 {char_name} 的動作描寫與台詞，不要加上 `{char_name}:` 前綴）：
"""

    try:
        raw_reply = await AIService.call_llm(
            system_prompt=sys_prompt,
            user_prompt=user_prompt,
            max_tokens=1500
        )
        clean_reply = (raw_reply or "").strip()
        if not clean_reply:
            raise HTTPException(status_code=502, detail="AI 模型回傳內容為空白，請重試或檢查 API 設定")

        # 去除可能多餘的角色名稱前綴
        for prefix in [f"{char_name}：", f"{char_name}:"]:
            if clean_reply.startswith(prefix):
                clean_reply = clean_reply[len(prefix):].strip()

        clean_reply = prompts.replace_st_macros(clean_reply, char_name, user_name)

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if target_regen_msg is not None:
            # 重新生成 (Swipe)：加入 swipes 陣列並切換至最新生成的版本
            swipes = list(target_regen_msg.swipes or ([target_regen_msg.content] if target_regen_msg.content else []))
            swipes.append(clean_reply)
            target_regen_msg.content = clean_reply
            target_regen_msg.swipes = swipes
            target_regen_msg.swipe_id = len(swipes) - 1
            target_regen_msg.timestamp = now_str
            target_regen_msg.triggered_lore = triggered_lore
            target_regen_msg.recalled_rag = recalled_rag_dicts
            assistant_msg = target_regen_msg
        else:
            assistant_msg = ChatMessage(
                id=f"msg-{uuid.uuid4().hex[:8]}",
                role="assistant",
                content=clean_reply,
                swipes=[clean_reply],
                swipe_id=0,
                timestamp=now_str,
                triggered_lore=triggered_lore,
                recalled_rag=recalled_rag_dicts
            )
            session.messages.append(assistant_msg)

        saved_session = save_chat_session(session)
        # 在背景自動更新該對話的 RAG 向量索引庫
        background_tasks.add_task(RAGService.index_chat_session, saved_session, char_name)

        return {
            "session": saved_session,
            "assistant_message": assistant_msg,
            "triggered_lore_items": triggered_lore,
            "recalled_rag_items": recalled_rag_dicts
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"角色對話生成失敗: {str(e)}")


@app.post("/api/ai/character-chat/summarize-memory", response_model=ChatSession)
async def api_summarize_chat_memory(req: SummarizeChatMemoryRequest):
    card = get_character_card(req.character_id)
    if not card:
        raise HTTPException(status_code=404, detail="找不到指定角色卡")
    session = get_chat_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="找不到指定對話紀錄")

    char_name = card.name
    user_name = session.user_name or "你"

    convo_lines = []
    for m in session.messages[-30:]:
        speaker = user_name if m.role == "user" else char_name
        txt = prompts.replace_st_macros(m.content.strip(), char_name, user_name)
        convo_lines.append(f"{speaker}: {txt}")

    user_prompt = f"""【角色名稱】：{char_name}
【互動玩家名稱】：{user_name}
【既有長時記憶摘要】：
{session.memory_summary or "（尚無既有摘要）"}

【近期對話紀錄】：
{chr(10).join(convo_lines)}

請根據上述資訊，整合並更新這場對話的「長時記憶核心摘要」：
"""
    try:
        summary_text = await AIService.call_llm(
            system_prompt=prompts.SUMMARIZE_CHAT_MEMORY_SYSTEM,
            user_prompt=user_prompt,
            temperature=0.5,
            max_tokens=1000
        )
        session.memory_summary = (summary_text or "").strip()
        return save_chat_session(session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"提煉長時記憶摘要失敗: {str(e)}")


@app.post("/api/ai/character-chat/reindex-rag/{session_id}")
async def api_reindex_chat_rag(session_id: str, background_tasks: BackgroundTasks):
    session = get_chat_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="找不到指定對話紀錄")
    card = get_character_card(session.character_id)
    char_name = card.name if card else "角色"
    background_tasks.add_task(RAGService.index_chat_session, session, char_name)
    return {
        "status": "ok",
        "message": f"已在背景排程重構「{session.title}」的對話 RAG 語意索引"
    }




