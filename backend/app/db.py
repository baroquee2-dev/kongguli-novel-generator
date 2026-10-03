import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from app.config import NOVELS_DIR
from app.models import Novel

def list_novels() -> List[dict]:
    novels = []
    for file in NOVELS_DIR.glob("*.json"):
        try:
            with open(file, "r", encoding="utf-8") as f:
                data = json.load(f)
                novels.append({
                    "id": data.get("id"),
                    "title": data.get("title"),
                    "genre": data.get("genre"),
                    "tone": data.get("tone"),
                    "main_plot": data.get("main_plot", ""),
                    "cover_url": data.get("cover_url", ""),
                    "locations_count": len(data.get("locations", [])),
                    "characters_count": len(data.get("characters", [])),
                    "chapters_count": len(data.get("chapters", [])),
                    "lore_items_count": len(data.get("lore_items", [])),
                    "updated_at": data.get("updated_at")
                })
        except Exception as e:
            print(f"Error reading novel {file}: {e}")
    # 按照更新時間降序排列
    novels.sort(key=lambda x: x.get("updated_at") or "", reverse=True)
    return novels

def get_novel(novel_id: str) -> Optional[Novel]:
    file_path = NOVELS_DIR / f"{novel_id}.json"
    if not file_path.exists():
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return Novel(**data)
    except Exception as e:
        print(f"Error reading novel {novel_id}: {e}")
        return None

def save_novel(novel: Novel) -> Novel:
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if not novel.created_at:
        novel.created_at = now_str
    novel.updated_at = now_str
    
    file_path = NOVELS_DIR / f"{novel.id}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(novel.model_dump(), f, ensure_ascii=False, indent=2)
    return novel

def delete_novel(novel_id: str) -> bool:
    file_path = NOVELS_DIR / f"{novel_id}.json"
    if file_path.exists():
        file_path.unlink()
        return True
    return False

def create_sample_novel() -> Novel:
    """初始化一個示範範例，展示 5 層式立體創作架構"""
    novel_id = str(uuid.uuid4())[:8]
    novel = Novel(
        id=novel_id,
        title="蒼穹星軌：遺落的以太之心",
        genre="奇幻蒸氣龐克",
        tone="探索冒險、磅礴神秘",
        main_plot="在懸浮於萬米高空的雲海帝國中，古老能源「以太之心」突然熄滅，導致浮空群島逐漸墜落。主角團必須深入被迷霧籠罩的禁忌下界地表，尋找失傳的以太工匠與重啟星軌的古老鑰匙，同時對抗企圖趁亂統治浮空城的執政官殘部。",
        world_background="世界分為兩層：上界是由以太動力引擎支撐的「雲中諸島」，科技融合蒸氣機械與以太符文；下界是千年前遭遇大災變被遺棄的原始荒原與機械廢墟，充斥著危險的以太畸變生物。",
        global_style_guide="電影感沉浸描寫，善用五感細節（氣壓嘶鳴、潤滑油焦香、金屬震顫）營造蒸氣龐克工業質感；對話精準帶出人物性格，情節推進充滿冒險懸疑張力。",
        locations=[
            {
                "id": "loc-1",
                "name": "天穹城・阿爾卡迪亞",
                "description": "浮空群島中最大的政治與商業核心，由七座巨大的反重力以太輪盤支撐，空中穿梭著蒸氣飛艇與以太導軌。",
                "sub_locations": [
                    {
                        "id": "subloc-1-1",
                        "name": "星軌發動機核心室",
                        "description": "位於浮空城最底層的巨大機械穹頂，齒輪如摩天輪般運轉，中央是以太之心的底座，如今已泛起冰冷暗光。"
                    },
                    {
                        "id": "subloc-1-2",
                        "name": "銹蝕齒輪酒館",
                        "description": "黑市飛艇手與賞金獵人聚集的地下酒吧，瀰漫著重油、麥酒與銅銹的氣味，情報流通極快。"
                    }
                ]
            },
            {
                "id": "loc-2",
                "name": "下界迷霧廢墟・舊都倫威治",
                "description": "千年前沉入地表的遠古蒸氣都市，終年籠罩在深紫色的以太毒霧中，被茂密的發光蕨類與金屬殘骸覆蓋。",
                "sub_locations": [
                    {
                        "id": "subloc-2-1",
                        "name": "大鐘樓地下避難所",
                        "description": "傾斜半塌的巨型鐘樓下方，以太工匠學會最後的秘密研究室，保留著古老機關與防衛發條傀儡。"
                    }
                ]
            }
        ],
        characters=[
            {
                "id": "char-1",
                "name": "萊恩・沃克 (Ryan Walker)",
                "role": "主角",
                "gender": "男",
                "age": "24",
                "profile": "浮空城的頂尖機械整備士，父親曾是以太之心的首席工程師，在十年前下界探險時失蹤。性格堅毅果斷，對機械結構有近乎直覺的敏銳感。",
                "appearance": "棕色短髮，戴著單邊護目鏡，身著耐磨的深皮革工裝與裝配有微型抓鉤的機械護臂。",
                "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80"
            },
            {
                "id": "char-2",
                "name": "薇薇安・諾瓦 (Vivian Nova)",
                "role": "女主角 / 以太學者",
                "gender": "女",
                "age": "22",
                "profile": "王立以太學院的異端學者，專研失落的古代符文語。外冷內熱，行事謹慎周密，擅長調配以太抑制劑與破解古代密碼。",
                "appearance": "銀白色長髮束在腦後，佩戴細框銀眼鏡，身著靛藍色學者風衣，手持一本鑲有以太晶石的解碼日誌。",
                "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80"
            }
        ],
        chapters=[
            {
                "id": "chap-1",
                "chapter_number": 1,
                "title": "第一章：熄滅的以太之光",
                "outline": "在浮空城例行檢修日，以太之心的轉速無預警暴跌，全城燈火驟滅。萊恩在銹蝕齒輪酒館偶遇被執政官警衛追捕的薇薇安，兩人陰錯陽差聯手啟動緊急備用引擎，卻發現以太之心的核心部件遭人秘密拆卸奪走。",
                "selected_location_ids": ["loc-1"],
                "selected_sub_location_ids": ["subloc-1-2", "subloc-1-1"],
                "selected_character_ids": ["char-1", "char-2"],
                "content": "阿爾卡迪亞的黃昏總是帶著一股燃燒以太後的微甜焦香。\n\n在浮空城第三迴旋區的下層，『銹蝕齒輪酒館』的銅製門扉被粗暴地推開。氣壓管道發出尖銳的嘶嘶聲，混雜著粗劣黑麥酒與高溫潤滑油的氣味迎面撲來。\n\n萊恩・沃克正咬著一根未點燃的草葉，手中握著一把微型扳手，全神貫注地調整著客人送修的發條懷錶。突然，頭頂上傳來一陣沉悶而奇異的共鳴——那不是普通齒輪脫節的雜音，而像是整座浮空城的骨骼都在呻吟。\n\n「喂，萊恩小子，你看天上！」酒保老托馬斯猛地停下手裡的酒杯，望向天花板的採光天窗。\n\n原本在雲海暮色中散發著璀璨藍芒的『星軌發動機核心室』，光芒正在急速衰退。一道肉眼可見的能量漣漪擴散開來，緊接著，酒館內的以太燈管發出一陣劈啪爆響，整座繁華的天穹城瞬間陷入一片駭人的死寂與黑暗……",
                "word_count": 350,
                "summary": "以太之心停擺，萊恩與薇薇安在酒館初識，揭發核心失竊的重大陰謀。"
            }
        ],
        lore_items=[
            {
                "id": "lore-1",
                "title": "以太之心核心殘片",
                "category": "關鍵物品",
                "keywords": ["以太之心", "核心", "殘片", "暗光", "能源"],
                "content": "千年前維持天穹城懸浮的古代科技核心，熄滅後崩裂為三枚神秘殘片。其中一枚被秘密藏匿於下界迷霧廢墟中，據傳散發微弱紫芒，能短暫驅散毒霧並激活古老防衛發條傀儡。",
                "is_constant": False,
                "is_enabled": True
            },
            {
                "id": "lore-2",
                "title": "血霧誓約",
                "category": "誓言契約",
                "keywords": ["誓約", "血盟", "承諾", "秘密協定"],
                "content": "萊恩與薇薇安在地下酒吧逃脫時立下的不破約定：在找回被盜核心之前，絕不向浮空城執政官及其警衛透露下界的任何入口座標與古代符文研究成果。",
                "is_constant": False,
                "is_enabled": True
            },
            {
                "id": "lore-3",
                "title": "以太畸變法則",
                "category": "特殊設定",
                "keywords": ["畸變", "毒霧", "結晶", "以太反噬"],
                "content": "生物長時間暴露於未過濾的高濃縮以太氣體中，皮膚與血液會逐漸產生紫水晶狀結晶，精神陷入狂暴瘋狂。唯有佩戴薇薇安研製的以太純化過濾面罩或服用特殊抑制劑方可延緩症狀。",
                "is_constant": True,
                "is_enabled": True
            }
        ]
    )
    return save_novel(novel)
