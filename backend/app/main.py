import os
import uuid
import json
import urllib.parse
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import PlainTextResponse, StreamingResponse

from app.models import (
    AISettings, Novel, GameProject, Location, Character, Chapter, LoreItem,
    GenerateOutlineRequest, GenerateLocationsRequest,
    GenerateCharactersRequest, GenerateChapterRequest,
    ContinueWritingRequest, GenerateChapterSummaryRequest,
    AnalyzeLoreItemsRequest, QueryRagRequest, RecalledScene,
    GameTurnRequest, GameTurnResponse, GameTurnHistoryItem
)
from app.config import get_settings, save_settings, UPLOADS_DIR
from app.db import (
    list_novels, get_novel, save_novel, delete_novel, create_sample_novel,
    list_games, get_game, save_game, delete_game, create_sample_game
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


# ==================== 4.5 遊戲前台互動遊玩機制 API ====================
@app.post("/api/ai/game-turn", response_model=GameTurnResponse)
async def api_ai_game_turn(req: GameTurnRequest):
    """
    遊戲前台每輪對話與抉擇推演 API：
    根據玩家選擇的選項或自由輸入之行動，結合世界觀設定、登場NPC、地點、世界書記憶庫與頂層遊戲規則，
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

    lore_text = ""
    if hasattr(game, 'lore_items') and game.lore_items:
        lore_items_enabled = [item for item in game.lore_items if item.is_enabled]
        if lore_items_enabled:
            lore_text = "\n".join([
                f"- 📌【{item.title}】({item.category}): {item.content}"
                for item in lore_items_enabled[:5]
            ])

    # 3. 彙整歷史遊玩推進歷程 (最多取最近 4 回合)
    history_lines = []
    for h in req.history[-4:]:
        act_type_tag = "【玩家自由鍵入行動】" if h.choice_type == 'custom' else "【玩家選擇之選項】"
        history_lines.append(f"--- [第 {h.round} 回合] ---\n情境描述：{h.story_segment}\n{act_type_tag}：{h.player_action}")

    history_block = "\n\n".join(history_lines) if history_lines else "（這是遊戲的第一個分歧決策點）"

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

【世界書記憶與關鍵伏筆庫】：
{lore_text or "無特殊常駐伏筆"}

【歷次回合冒險進展脈絡】：
{history_block}

【當前玩家最新行動】：
{curr_action_tag}：{req.current_action}

請根據上述遊戲設定、歷史脈絡以及頂層規則約束，推演接下來發生的劇情，並產出下一輪恰好 {target_choice_count} 個選項：
"""

    try:
        raw_resp = await AIService.call_llm(
            system_prompt=sys_prompt,
            user_prompt=user_prompt,
            max_tokens=1500
        )
        data = extract_json_data(raw_resp)
        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
            data = data[0]

        story_continuation = data.get("story_continuation") or data.get("story") or "情節繼續推進中..."
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
            "story_continuation": story_continuation.strip(),
            "choices": formatted_choices[:target_choice_count],
            "status_summary": status_summary,
            "updated_player_stats": updated_player_stats.strip() if updated_player_stats else current_player_stats,
            "stats_changes": stats_changes.strip(),
            "round": current_round
        }
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




