import os
import uuid
import json
import urllib.parse
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import PlainTextResponse, StreamingResponse

from app.models import (
    AISettings, Novel, Location, Character, Chapter,
    GenerateOutlineRequest, GenerateLocationsRequest,
    GenerateCharactersRequest, GenerateChapterRequest,
    ContinueWritingRequest, GenerateChapterSummaryRequest
)
from app.config import get_settings, save_settings, UPLOADS_DIR
from app.db import (
    list_novels, get_novel, save_novel, delete_novel, create_sample_novel
)
from app.ai_service import AIService, clean_json_string, extract_json_data
from app import prompts

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
async def api_update_novel(novel_id: str, novel: Novel):
    novel.id = novel_id
    return save_novel(novel)

@app.delete("/api/novels/{novel_id}")
async def api_delete_novel(novel_id: str):
    success = delete_novel(novel_id)
    if not success:
        raise HTTPException(status_code=404, detail="找不到指定小說")
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
    novel = get_novel(req.novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="找不到小說專案")
    
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

    # 提取前一章摘要或結尾，確保前後呼應
    previous_context = ""
    sorted_chaps = sorted(novel.chapters, key=lambda c: c.chapter_number)
    curr_idx = next((i for i, c in enumerate(sorted_chaps) if c.id == chapter.id), 0)
    if curr_idx > 0:
        prev_chap = sorted_chaps[curr_idx - 1]
        prev_summary = prev_chap.summary or (prev_chap.content[-300:] if len(prev_chap.content) > 300 else prev_chap.content)
        previous_context = f"【上一章（第{prev_chap.chapter_number}章 《{prev_chap.title}》）情節回顧/結尾】：\n{prev_summary}\n"

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

{previous_context}
【當前章節資訊】
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
    novel = get_novel(req.novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="找不到小說專案")
    
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

    user_prompt = f"""{style_header}小說名稱：《{novel.title}》
風格基調：{novel.tone}
章節標題：{chapter.title if chapter else "未命名"}
【當前已有正文的結尾部分】：
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


# ==================== 5. SSE 串流創作 API (打字機即時顯示) ====================

@app.post("/api/ai/generate-chapter-stream")
async def api_ai_generate_chapter_stream(req: GenerateChapterRequest):
    novel = get_novel(req.novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="找不到小說專案")
    
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

    # 長時記憶：全書前情時間線 + 直前章節銜接
    timeline_text, immediate_context = build_timeline_context(novel, chapter.id)

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

{timeline_text}{immediate_context}【當前章節創作任務】
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
    novel = get_novel(req.novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="找不到小說專案")
    
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

    user_prompt = f"""{style_header}小說名稱：《{novel.title}》
風格基調：{novel.tone}
章節標題：{chapter.title if chapter else "未命名"}

{timeline_text}【當前已有正文的結尾部分】：
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
    novel = get_novel(req.novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="找不到小說專案")
        
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
        save_novel(novel)
        return {"summary": clean_summary, "novel": novel}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"提煉小結失敗: {str(e)}")


