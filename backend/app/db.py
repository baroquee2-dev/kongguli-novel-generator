import json
import uuid
import base64
import struct
import zlib
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from app.config import NOVELS_DIR, GAMES_DIR, CHAR_CARDS_DIR, CHAR_CHATS_DIR
from app.models import Novel, GameProject, GameRulesConfig, CharacterCard, ChatSession, ChatMessage, LoreItem

def list_novels() -> List[dict]:
    novels = []
    for file in NOVELS_DIR.glob("*.json"):
        try:
            with open(file, "r", encoding="utf-8") as f:
                data = json.load(f)
                chapters = data.get("chapters", [])
                total_word_count = sum(c.get("word_count") or len(c.get("content", "").replace(" ", "").replace("\n", "")) for c in chapters)
                novels.append({
                    "id": data.get("id"),
                    "title": data.get("title"),
                    "genre": data.get("genre"),
                    "tone": data.get("tone"),
                    "main_plot": data.get("main_plot", ""),
                    "cover_url": data.get("cover_url", ""),
                    "locations_count": len(data.get("locations", [])),
                    "characters_count": len(data.get("characters", [])),
                    "chapters_count": len(chapters),
                    "total_word_count": total_word_count,
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

# ==================== 獨立遊戲版資料庫存取 ====================
def list_games() -> List[dict]:
    # 若遊戲資料夾為空，自動產生一個示範遊戲專案
    if not any(GAMES_DIR.glob("*.json")):
        create_sample_game()

    games = []
    for file in GAMES_DIR.glob("*.json"):
        try:
            with open(file, "r", encoding="utf-8") as f:
                data = json.load(f)
                chapters = data.get("chapters", [])
                total_word_count = sum(c.get("word_count") or len(c.get("content", "").replace(" ", "").replace("\n", "")) for c in chapters)
                games.append({
                    "id": data.get("id"),
                    "title": data.get("title", "未命名遊戲專案"),
                    "genre": data.get("genre", "文字冒險RPG"),
                    "tone": data.get("tone", "沉浸互動"),
                    "main_plot": data.get("main_plot", ""),
                    "cover_url": data.get("cover_url", ""),
                    "locations_count": len(data.get("locations", [])),
                    "characters_count": len(data.get("characters", [])),
                    "chapters_count": len(chapters),
                    "total_word_count": total_word_count,
                    "lore_items_count": len(data.get("lore_items", [])),
                    "game_rules": data.get("game_rules"),
                    "updated_at": data.get("updated_at")
                })
        except Exception as e:
            print(f"Error reading game {file}: {e}")
    # 按照更新時間降序排列
    games.sort(key=lambda x: x.get("updated_at") or "", reverse=True)
    return games

def get_game(game_id: str) -> Optional[GameProject]:
    file_path = GAMES_DIR / f"{game_id}.json"
    if not file_path.exists():
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return GameProject(**data)
    except Exception as e:
        print(f"Error reading game {game_id}: {e}")
        return None

def save_game(game: GameProject) -> GameProject:
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if not game.created_at:
        game.created_at = now_str
    game.updated_at = now_str
    
    file_path = GAMES_DIR / f"{game.id}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(game.model_dump(), f, ensure_ascii=False, indent=2)
    return game

def delete_game(game_id: str) -> bool:
    file_path = GAMES_DIR / f"{game_id}.json"
    if file_path.exists():
        file_path.unlink()
        return True
    return False

def create_sample_game() -> GameProject:
    """初始化一個示範遊戲作品，展示遊戲版獨立架構"""
    game_id = str(uuid.uuid4())[:8]
    game = GameProject(
        id=game_id,
        title="時空迴廊：命運的七重抉擇",
        genre="日系科幻互動RPG",
        tone="時空穿梭、因果律抉擇、情感冒險",
        main_plot="在2142年新東京地下深處的『克羅諾斯時空觀測所』，時空信標突然出現逆流崩潰。身為第七執行官的主角必須穿越至七個不同的歷史分歧點，在多位具有特殊異能的同伴協助下，修復時空因果線，並在最後揭發觀測所所長企圖重塑全人類記憶的黑暗真相。",
        world_background="世界由『量子因果律網絡』維持穩定，少數覺醒者能感知世界線變動率。時空穿梭裝置由『反重力晶核』與『虛數神經連接器』驅動。",
        global_style_guide="電影感臨場體驗，對話具備強烈性格色彩，關鍵選項與分支抉擇富有戲劇張力；場景渲染科技神秘質感。",
        game_rules=GameRulesConfig(
            rules_text="1. 每次時空跳躍消耗 1 枚反重力晶核，能量耗盡無法跳躍。\n2. 歷史分歧點的重大抉擇具有不可逆性，無法讀檔重置。\n3. 主角若遭遇因果律崩潰，將陷入時空迴廊迷失狀態。\n4. 禁止憑空創造超因果武器，所有行動遵循物理守恆法則。",
            dialog_choices=[3],
            allow_custom_input=True,
            strict_rule_enforcement=True
        ),
        locations=[
            {
                "id": "loc-g1",
                "name": "克羅諾斯中央樞紐觀測所",
                "description": "懸浮於地下千米的量子超導環狀研究所，藍白冷光在金屬牆面流轉，中心懸浮著巨大的因果律回環儀。",
                "sub_locations": [
                    {
                        "id": "subloc-g1-1",
                        "name": "第七因果中樞控制室",
                        "description": "無數全息螢幕閃爍著世界線變動指數，赤紅色的錯誤警告字樣在半空中狂暴跳動。"
                    },
                    {
                        "id": "subloc-g1-2",
                        "name": "虛數躍遷整備艙",
                        "description": "排列整齊的浸入式神經冷卻艙，周圍瀰漫著液氮霧氣與低頻嗡鳴。"
                    }
                ]
            },
            {
                "id": "loc-g2",
                "name": "雨幕之街・新澀谷下層區",
                "description": "永無止境的霓虹酸雨都市，賽博義體改造黑市與地下反抗軍據點藏匿在交錯的高架管道下方。",
                "sub_locations": [
                    {
                        "id": "subloc-g2-1",
                        "name": "白夜黑客秘密地下室",
                        "description": "堆滿各型號拆解終端與全息鏡頭的凌亂密室，空氣中充斥著焊錫與速溶咖啡的苦味。"
                    }
                ]
            }
        ],
        characters=[
            {
                "id": "char-g1",
                "name": "神崎 綾乃",
                "role": "女主角 / 量子觀測員",
                "gender": "女性",
                "age": "19",
                "appearance": "及肩深藍短髮，眼眸帶著微弱淡金微光，身著白色觀測官制服與高領防護風衣。",
                "profile": "克羅諾斯研究所的天才觀測員。擁有罕見的「因果直覺感知」天賦，性格表面冷靜理性，內心重視伙伴勝過一切。",
                "avatar_url": ""
            },
            {
                "id": "char-g2",
                "name": "黑羽 雷恩",
                "role": "戰術遊俠 / 破行者",
                "gender": "男性",
                "age": "24",
                "appearance": "黑色短髮帶有凌亂碎髮，左臂為軍用型高頻電磁義肢，黑色戰術防彈風衣。",
                "profile": "原特勤作戰隊尖兵，因反對所長的非人道重塑實驗而叛逃。行事果決凌厲，關鍵時刻最可靠的前線護衛。",
                "avatar_url": ""
            }
        ],
        lore_items=[
            {
                "id": "lore-g1",
                "title": "因果律變動率計 (Divergence Gauge)",
                "category": "核心神兵",
                "keywords": ["變動率", "世界線", "指針", "數值", "因果"],
                "content": "神崎綾乃隨身佩戴的黃銅量子計數儀。當數值超過1.000000%時，代表成功突破當前世界線的既定滅絕命運。",
                "is_constant": True,
                "is_enabled": True
            },
            {
                "id": "lore-g2",
                "title": "虛數記憶格式化協議",
                "category": "最高機密",
                "keywords": ["格式化", "洗腦", "重塑", "記憶抹除"],
                "content": "克羅諾斯所長私自啟動的黑箱程序，能藉由時空回流洗去全人類對災厄的記憶，以虛假的平靜換取絕對統治。",
                "is_constant": False,
                "is_enabled": True
            }
        ],
        chapters=[
            {
                "id": "chap-g1",
                "chapter_number": 1,
                "title": "序章：紅光警報下的第 0 號分歧點",
                "outline": "第七因果觀測室警報大作，變動率跌落至危險臨界點。綾乃在儀表板前驚呼，主角必須在時空崩解前選擇攜帶核心資料逃生或啟動手動穩定閥...",
                "selected_location_ids": ["loc-g1"],
                "selected_sub_location_ids": ["subloc-g1-1"],
                "selected_character_ids": ["char-g1", "char-g2"],
                "content": "刺耳的防空級警報撕裂了克羅諾斯觀測所的死寂。\n\n全息中樞環上的數值正以恐怖的速度向下跌落——「0.4819%... 0.3120%...」紅芒將第七因果控制室映照得猶如血海。\n\n「執行官！主因果線正在崩潰！」神崎綾乃纖細的手指在虛擬光鍵上疾風般敲擊，及肩深藍短髮隨氣流飛舞，淡金色的瞳孔中倒映著劇烈顫抖的波形，「有人在外部錨點切斷了世界線鏈路... 如果變動率跌破零，整個新東京將被虛數空間徹底吞噬！」\n\n『別慌，綾乃。』黑羽雷恩冷冽的嗓音從厚重合金防爆門後傳來。他單手甩開電磁刃，幽藍的高頻粒子在刀尖嗡嗡作響，『外圍防線已經被不明武裝者攻破，他們不是衝著研究員來的——目標是中央發動機裡的變動率計！』\n\n腳下的超導地板劇烈震動，管線中噴湧出刺骨的液氮白霧。命運的十字路口已然展開，留給執行官抉擇的時間，僅剩最後三十秒。",
                "word_count": 395,
                "summary": "第七觀測室遭遇未知武裝襲擊，因果線變動率暴跌，主角、綾乃與雷恩面臨緊急撤離或啟動手動閥的生死抉擇。",
                "starting_plot": "刺耳的防空級警報撕裂了克羅諾斯觀測所的死寂。\n\n全息中樞環上的數值正以恐怖的速度向下跌落——「0.4819%... 0.3120%...」紅芒將第七因果控制室映照得猶如血海。\n\n「執行官！主因果線正在崩潰！」神崎綾乃纖細的手指在虛擬光鍵上疾風般敲擊，及肩深藍短髮隨氣流飛舞，淡金色的瞳孔中倒映著劇烈顫抖的波形，「有人在外部錨點切斷了世界線鏈路... 如果變動率跌破零，整個新東京將被虛數空間徹底吞噬！」\n\n『別慌，綾乃。』黑羽雷恩冷冽的嗓音從厚重合金防爆門後傳來。他單手甩開電磁刃，幽藍的高頻粒子在刀尖嗡嗡作響，『外圍防線已經被不明武裝者攻破，他們不是衝著研究員來的——目標是中央發動機裡的變動率計！』\n\n腳下的超導地板劇烈震動，管線中噴湧出刺骨的液氮白霧。命運的十字路口已然展開，留給執行官抉擇的時間，僅剩最後三十秒。",
                "starting_options": [
                    {
                        "id": "opt-1",
                        "text": "【果斷強行錨定】立即衝向中央主機，消耗 1 枚反重力晶核強行重載量子信標",
                        "hint": "嘗試在時空崩解前鎖定世界線，但過載反噬可能引爆控制台，並吸引門外傀儡注意力"
                    },
                    {
                        "id": "opt-2",
                        "text": "【協同前線迎敵】拔出虛數手槍配合雷恩突圍，優先殲滅入侵的武裝傀儡",
                        "hint": "確保人員生還與武器控制權，但會耗費寶貴的 30 秒重置時間"
                    },
                    {
                        "id": "opt-3",
                        "text": "【掩護天才學者】指揮綾乃立刻下載變動率核心算法，並手動熔斷資料庫以絕後患",
                        "hint": "阻止敵人獲取核心機密，但觀測所將失去對其他世界線的探測能力"
                    }
                ]
            }
        ]
    )
    return save_game(game)


# ==================== 3. 角色聊天版本：角色卡 (CharacterCard) 與 SillyTavern 相容引擎 ====================

def list_character_cards() -> List[dict]:
    cards = []
    # 統計各個角色的對話紀錄數與總訊息數
    chat_counts: Dict[str, dict] = {}
    for cfile in CHAR_CHATS_DIR.glob("*.json"):
        try:
            with open(cfile, "r", encoding="utf-8") as cf:
                cdata = json.load(cf)
                cid = cdata.get("character_id", "")
                if cid:
                    if cid not in chat_counts:
                        chat_counts[cid] = {"sessions": 0, "messages": 0}
                    chat_counts[cid]["sessions"] += 1
                    chat_counts[cid]["messages"] += len(cdata.get("messages", []))
        except Exception:
            pass

    for file in CHAR_CARDS_DIR.glob("*.json"):
        try:
            with open(file, "r", encoding="utf-8") as f:
                data = json.load(f)
                cid = data.get("id")
                stats = chat_counts.get(cid, {"sessions": 0, "messages": 0})
                cards.append({
                    "id": cid,
                    "name": data.get("name", "未命名角色"),
                    "description": data.get("description", ""),
                    "personality": data.get("personality", ""),
                    "scenario": data.get("scenario", ""),
                    "first_mes": data.get("first_mes", ""),
                    "creator_notes": data.get("creator_notes", ""),
                    "tags": data.get("tags", []),
                    "creator": data.get("creator", ""),
                    "character_version": data.get("character_version", "1.0"),
                    "avatar_url": data.get("avatar_url", ""),
                    "lore_items_count": len(data.get("lore_items", [])),
                    "alternate_greetings_count": len(data.get("alternate_greetings", [])),
                    "chat_sessions_count": stats["sessions"],
                    "total_messages_count": stats["messages"],
                    "updated_at": data.get("updated_at")
                })
        except Exception as e:
            print(f"Error reading character card {file}: {e}")
    cards.sort(key=lambda x: x.get("updated_at") or "", reverse=True)
    return cards


def get_character_card(card_id: str) -> Optional[CharacterCard]:
    file_path = CHAR_CARDS_DIR / f"{card_id}.json"
    if not file_path.exists():
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return CharacterCard(**data)
    except Exception as e:
        print(f"Error reading character card {card_id}: {e}")
        return None


def save_character_card(card: CharacterCard) -> CharacterCard:
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if not card.id:
        card.id = f"charcard-{uuid.uuid4().hex[:8]}"
    if not card.created_at:
        card.created_at = now_str
    card.updated_at = now_str

    file_path = CHAR_CARDS_DIR / f"{card.id}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(card.model_dump(), f, ensure_ascii=False, indent=2)
    return card


def delete_character_card(card_id: str) -> bool:
    file_path = CHAR_CARDS_DIR / f"{card_id}.json"
    if file_path.exists():
        file_path.unlink()
        # 同步清理該角色的所有對話檔案
        for cfile in CHAR_CHATS_DIR.glob("*.json"):
            try:
                with open(cfile, "r", encoding="utf-8") as cf:
                    cdata = json.load(cf)
                if cdata.get("character_id") == card_id:
                    cfile.unlink()
            except Exception:
                pass
        return True
    return False


def extract_chara_from_png_bytes(png_bytes: bytes) -> Optional[dict]:
    """
    從 SillyTavern V2/V3 的 PNG 角色卡圖片二進位資料中提取內嵌之 Base64 JSON 角色設定 (tEXt / zTXt / iTXt chunk: 'chara' 或 'ccv3')
    """
    if len(png_bytes) < 8 or png_bytes[:8] != b"\x89PNG\r\n\x1a\n":
        return None

    offset = 8
    found_json_dict = None

    while offset + 8 <= len(png_bytes):
        length = struct.unpack(">I", png_bytes[offset:offset + 4])[0]
        chunk_type = png_bytes[offset + 4:offset + 8].decode("latin1", errors="ignore")
        chunk_data = png_bytes[offset + 8:offset + 8 + length]
        offset += 12 + length

        if chunk_type in ("tEXt", "zTXt", "iTXt"):
            try:
                null_idx = chunk_data.find(b"\x00")
                if null_idx != -1:
                    keyword = chunk_data[:null_idx].decode("latin1", errors="ignore").strip().lower()
                    if keyword in ("chara", "ccv3"):
                        raw_payload = chunk_data[null_idx + 1:]
                        if chunk_type == "zTXt" and len(raw_payload) > 1:
                            # 第一個 byte 為壓縮方法 (0 = zlib)
                            raw_payload = zlib.decompress(raw_payload[1:])
                        elif chunk_type == "iTXt":
                            # iTXt: comp_flag(1B) + comp_method(1B) + lang\0 + trans_key\0 + text
                            parts = raw_payload[2:].split(b"\x00", 2)
                            if len(parts) == 3:
                                raw_payload = parts[2]
                        b64_str = raw_payload.decode("utf-8", errors="ignore").strip()
                        decoded_bytes = base64.b64decode(b64_str)
                        parsed = json.loads(decoded_bytes.decode("utf-8"))
                        if isinstance(parsed, dict):
                            found_json_dict = parsed
                            if keyword == "ccv3":
                                break
            except Exception as e:
                print(f"Error decoding PNG chunk {chunk_type}: {e}")

        if chunk_type == "IEND":
            break

    return found_json_dict


def parse_sillytavern_card_dict(raw_data: dict, avatar_url: str = "") -> CharacterCard:
    """
    將 SillyTavern V1 / V2 / V3 角色卡 JSON 結構解析並轉換為本系統之 CharacterCard 模型（含 character_book -> lore_items）
    """
    # 判斷是否為 V2 / V3 包裹在 data 欄位中
    data_obj = raw_data.get("data") if isinstance(raw_data.get("data"), dict) else raw_data

    def pick_str(key: str, default: str = "") -> str:
        val = data_obj.get(key)
        if val is None and data_obj is not raw_data:
            val = raw_data.get(key)
        return str(val).strip() if val is not None else default

    def pick_list(key: str) -> list:
        val = data_obj.get(key)
        if val is None and data_obj is not raw_data:
            val = raw_data.get(key)
        if isinstance(val, list):
            return [str(x).strip() for x in val if str(x).strip()]
        if isinstance(val, str) and val.strip():
            return [x.strip() for x in val.split(",") if x.strip()]
        return []

    # 解析 character_book 為 lore_items
    lore_items: List[LoreItem] = []
    char_book = data_obj.get("character_book") or raw_data.get("character_book")
    if isinstance(char_book, dict):
        entries = char_book.get("entries")
        entry_list = []
        if isinstance(entries, list):
            entry_list = entries
        elif isinstance(entries, dict):
            entry_list = list(entries.values())

        for idx, ent in enumerate(entry_list):
            if not isinstance(ent, dict):
                continue
            content = str(ent.get("content") or "").strip()
            if not content:
                continue
            keys = ent.get("keys") or ent.get("key") or []
            if isinstance(keys, str):
                keys = [k.strip() for k in keys.split(",") if k.strip()]
            elif isinstance(keys, list):
                keys = [str(k).strip() for k in keys if str(k).strip()]
            else:
                keys = []

            title = str(ent.get("comment") or ent.get("name") or (keys[0] if keys else f"設定詞條 {idx + 1}")).strip()
            is_const = bool(ent.get("constant", False))
            is_enab = bool(ent.get("enabled", True))
            lore_items.append(
                LoreItem(
                    id=f"lore-{uuid.uuid4().hex[:8]}",
                    title=title or f"詞條 {idx + 1}",
                    category="世界書設定",
                    keywords=keys,
                    content=content,
                    is_constant=is_const,
                    is_enabled=is_enab
                )
            )

    # 若本身已是我們系統匯出的格式，也直接支援 lore_items
    raw_lore = data_obj.get("lore_items") or raw_data.get("lore_items")
    if not lore_items and isinstance(raw_lore, list):
        for item in raw_lore:
            if isinstance(item, dict) and item.get("content"):
                lore_items.append(LoreItem(**item))

    card = CharacterCard(
        id=f"charcard-{uuid.uuid4().hex[:8]}",
        name=pick_str("name", "未命名角色"),
        description=pick_str("description", ""),
        personality=pick_str("personality", ""),
        scenario=pick_str("scenario", ""),
        first_mes=pick_str("first_mes", ""),
        alternate_greetings=pick_list("alternate_greetings"),
        mes_example=pick_str("mes_example", ""),
        creator_notes=pick_str("creator_notes", "") or pick_str("creatorcomment", ""),
        system_prompt=pick_str("system_prompt", ""),
        post_history_instructions=pick_str("post_history_instructions", ""),
        tags=pick_list("tags"),
        creator=pick_str("creator", ""),
        character_version=pick_str("character_version", "1.0"),
        avatar_url=avatar_url or pick_str("avatar_url", ""),
        lore_items=lore_items,
        user_persona_name=pick_str("user_persona_name", "你"),
        user_persona_desc=pick_str("user_persona_desc", "")
    )
    return save_character_card(card)


def export_sillytavern_v2_dict(card: CharacterCard) -> dict:
    """
    將本系統之 CharacterCard 匯出為完全相容 SillyTavern Character Card V2 (chara_card_v2) 標準之 JSON 結構
    """
    st_entries = []
    for idx, item in enumerate(card.lore_items or []):
        st_entries.append({
            "id": idx,
            "keys": item.keywords or [item.title],
            "secondary_keys": [],
            "comment": item.title,
            "content": item.content,
            "constant": item.is_constant,
            "selective": False,
            "insertion_order": 100,
            "enabled": item.is_enabled,
            "position": "before_char",
            "extensions": {}
        })

    data_block = {
        "name": card.name,
        "description": card.description,
        "personality": card.personality,
        "scenario": card.scenario,
        "first_mes": card.first_mes,
        "mes_example": card.mes_example,
        "creator_notes": card.creator_notes,
        "system_prompt": card.system_prompt,
        "post_history_instructions": card.post_history_instructions,
        "alternate_greetings": card.alternate_greetings or [],
        "tags": card.tags or [],
        "creator": card.creator or "KongGuLi Studio",
        "character_version": card.character_version or "1.0",
        "character_book": {
            "name": f"{card.name} 的世界書",
            "entries": st_entries
        },
        "extensions": {
            "kongguli": {
                "avatar_url": card.avatar_url or "",
                "user_persona_name": card.user_persona_name or "你",
                "user_persona_desc": card.user_persona_desc or ""
            }
        }
    }

    return {
        "spec": "chara_card_v2",
        "spec_version": "2.0",
        "name": card.name,
        "description": card.description,
        "personality": card.personality,
        "scenario": card.scenario,
        "first_mes": card.first_mes,
        "mes_example": card.mes_example,
        "creatorcomment": card.creator_notes,
        "tags": card.tags or [],
        "data": data_block
    }


def create_sample_character_card() -> CharacterCard:
    """
    建立一張高品質 SillyTavern V2 標準示範角色卡：《星見 汐音 (Hoshimi Shion) - 午夜舊書店的守秘魔女》
    """
    sample = CharacterCard(
        id=f"charcard-{uuid.uuid4().hex[:8]}",
        name="星見 汐音",
        description=(
            "{{char}}（星見 汐音，Hoshimi Shion）是隱匿於現代都市巷弄深處「月影古書堂」的年輕店主，真實身份為執掌『記憶與星象』的見習守秘魔女。\n"
            "【外貌特徵】：擁有如夜空般傾瀉而下的銀白色長髮，髮尾微帶星空藍漸層；琥珀色的眼眸在暗處會泛起微光。平時喜歡穿著復古深藍天鵝絨長裙，外搭寬鬆的針織披肩，指尖常沾有淡淡的舊書頁與玫瑰伯爵茶香氣。\n"
            "【背景故事】：她收集人們遺落或不敢面對的記憶碎片，並將其封存於古書之中。表面上有些慵懶、愛開無傷大雅的玩笑，實際上觀察力極其敏銳，對誤入古書堂的{{user}}抱有強烈的好奇與溫柔的包容。"
        ),
        personality="慵懶優雅、神秘毒舌卻內心溫柔、觀察細膩、偶爾會展現小惡魔般的捉弄感",
        scenario="雨夜的都市巷弄，{{user}}為了躲避突如其來的傾盆大雨，推開了一間地圖上並不存在的『月影古書堂』木門。店內點著溫暖的黃銅煤油燈，{{char}}正坐在高腳梯上擦拭一本散發微光的羊皮古籍。",
        first_mes=(
            "*清脆的黃銅門鈴在寂靜的雨夜裡響起，帶著潮濕水氣的夜風吹動了書架間懸掛的星象風鈴。*\n\n"
            "*坐在胡桃木高腳梯上的銀髮少女緩緩垂下眼簾，琥珀色的眸子透過搖曳的燈火落在{{user}}身上。她合上手中泛著微光的古籍，裙擺隨著她輕盈躍下梯子的動作在空中劃出一道優雅的弧線。*\n\n"
            "「哎呀，今夜的雨，竟然把一位不在預言名冊上的客人吹進來了呢。」\n\n"
            "*{{char}}微微偏過頭，唇角勾起一抹似笑非笑的弧度，將一杯剛泡好、冒著熱氣的玫瑰伯爵茶推到吧台邊緣。*\n\n"
            "「歡迎來到『月影古書堂』，渾身濕透的迷途者。在把我的波斯地毯弄濕之前……要不要先喝口熱茶，告訴我你是為了尋找某本書，還是為了尋找某段被遺忘的記憶而來的？」"
        ),
        alternate_greetings=[
            "*午後的陽光穿過彩繪玻璃窗，在堆滿古籍的地板上投下斑斕的光影。{{char}}正趴在吧台軟墊上打著小盹，銀白色的長髮鋪散在翻開的星象圖上。聽到{{user}}靠近的腳步聲，她迷迷糊糊地揉了揉琥珀色的眼睛。*\n\n「唔……還沒到打烊時間嗎？啊，是{{user}}呀。既然來了，幫我把最頂層那本藍皮魔導書拿下來好不好？作為報酬，今天允許你問我一個關於未來的秘密喔。」",
            "*午夜十二點的鐘聲剛過，古書堂內所有的蠟燭同時變成了幽邃的星藍色。{{char}}站在星盤中央，指尖纏繞著一縷銀色光絲，神情比平時認真了許多。*\n\n「{{user}}，你來得正好。剛才星盤捕捉到了一段與你過去有關的記憶波動……過來這邊，把手放在水晶上，別害怕，我會陪著你一起看清它的模樣。」"
        ],
        mes_example=(
            "<START>\n"
            "{{user}}: 這裡的書看起來都很古老，真的可以隨便翻閱嗎？\n"
            "{{char}}: *{{char}}修長的食指輕輕抵在唇邊，琥珀色的眼眸眨了眨，發出一聲輕柔的笑聲。*\n"
            "「左邊書架上的普通古籍請隨意；不過右邊那些鎖著銀鍊的書冊嘛……如果你不怕被吸進別人的夢境裡，我也不會阻止你就是了。」\n"
            "<START>\n"
            "{{user}}: 謝謝妳的熱茶，味道很香。\n"
            "{{char}}: *聽到讚美，她滿意地瞇起眼睛，雙手托著下巴坐在吧台對面靜靜端詳著{{user}}。*\n"
            "「算你有品味，這可是用清晨第一滴露水與夜綻玫瑰烘焙的茶葉。看在你這麼誠實的份上，今晚的茶資就用你的一個故事來抵銷吧？」"
        ),
        creator_notes="示範 SillyTavern V2 相容角色卡。內含 3 組開場白、角色專屬世界書（古書堂法則、記憶封存術、使魔黑貓）以及完整的角色演繹提示。",
        system_prompt="請全程以『星見 汐音 ({{char}})』的第一人稱或第三人稱小說敘事視角與 {{user}} 進行深度角色扮演對話。動作與神態描寫請包裹在 *星號* 中，說話台詞請使用「引號」。維持她神秘、優雅、略帶捉弄卻溫柔的魔女店主性格。",
        post_history_instructions="請緊密回應 {{user}} 的最新話語與動作，每次回覆自然推進兩人的互動氛圍，切勿代替 {{user}} 說話或做決定。",
        tags=["奇幻", "魔女", "日常療癒", "微懸疑", "SillyTavern相容"],
        creator="KongGuLi Studio",
        character_version="1.2",
        avatar_url="",
        lore_items=[
            LoreItem(
                id="lore-shion-1",
                title="月影古書堂的空間法則",
                category="場景法則",
                keywords=["古書堂", "書店", "門口", "離開", "地址"],
                content="月影古書堂位於現實與星界夾縫的半位面，只有心中懷有「未解執念」或「遺失記憶」的人才能在雨夜看見它的大門。",
                is_constant=True,
                is_enabled=True
            ),
            LoreItem(
                id="lore-shion-2",
                title="記憶封存之書 (Soul Grimoire)",
                category="關鍵設定",
                keywords=["古籍", "羊皮書", "記憶", "封存", "秘密", "過去"],
                content="汐音能將人們痛苦或珍貴的記憶抽離並化為書頁文字。若有人想取回記憶，必須以另一段真實的情感體驗作為等價交換。",
                is_constant=False,
                is_enabled=True
            ),
            LoreItem(
                id="lore-shion-3",
                title="星象使魔「諾克斯 (Nox)」",
                category="使魔夥伴",
                keywords=["貓", "黑貓", "使魔", "諾克斯", "寵物"],
                content="平時趴在書架頂端睡覺的雙尾黑貓，瞳孔是星空色。能聽懂人話，喜歡吃小魚乾，偶爾會叼來關鍵的書籤。",
                is_constant=False,
                is_enabled=True
            )
        ],
        user_persona_name="你",
        user_persona_desc="偶然在雨夜推開月影古書堂大門的訪客，似乎在尋找某段重要的往事。"
    )
    return save_character_card(sample)


# ==================== 4. 角色聊天紀錄 (ChatSession) CRUD ====================

def list_chat_sessions(character_id: Optional[str] = None) -> List[dict]:
    sessions = []
    for file in CHAR_CHATS_DIR.glob("*.json"):
        try:
            with open(file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if character_id and data.get("character_id") != character_id:
                    continue
                msgs = data.get("messages", [])
                last_msg = msgs[-1].get("content", "")[:80] if msgs else ""
                sessions.append({
                    "id": data.get("id"),
                    "character_id": data.get("character_id"),
                    "title": data.get("title", "對話紀錄"),
                    "user_name": data.get("user_name", "你"),
                    "messages_count": len(msgs),
                    "last_message_preview": last_msg,
                    "has_memory_summary": bool(data.get("memory_summary", "").strip()),
                    "updated_at": data.get("updated_at")
                })
        except Exception as e:
            print(f"Error reading chat session {file}: {e}")
    sessions.sort(key=lambda x: x.get("updated_at") or "", reverse=True)
    return sessions


def get_chat_session(session_id: str) -> Optional[ChatSession]:
    file_path = CHAR_CHATS_DIR / f"{session_id}.json"
    if not file_path.exists():
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return ChatSession(**data)
    except Exception as e:
        print(f"Error reading chat session {session_id}: {e}")
        return None


def save_chat_session(session: ChatSession) -> ChatSession:
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if not session.id:
        session.id = f"chat-{uuid.uuid4().hex[:8]}"
    if not session.created_at:
        session.created_at = now_str
    session.updated_at = now_str

    file_path = CHAR_CHATS_DIR / f"{session.id}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(session.model_dump(), f, ensure_ascii=False, indent=2)
    return session


def delete_chat_session(session_id: str) -> bool:
    file_path = CHAR_CHATS_DIR / f"{session_id}.json"
    if file_path.exists():
        file_path.unlink()
        return True
    return False


def create_new_chat_session(card: CharacterCard, user_name: str = "", greeting_index: int = 0) -> ChatSession:
    uname = (user_name or card.user_persona_name or "你").strip()
    upersona = (card.user_persona_desc or "").strip()

    # 組合所有開場白候選 (主開場白 + 備選開場白)
    all_greetings = []
    if card.first_mes and card.first_mes.strip():
        all_greetings.append(card.first_mes.strip())
    for alt in (card.alternate_greetings or []):
        if alt and alt.strip():
            all_greetings.append(alt.strip())

    messages: List[ChatMessage] = []
    if all_greetings:
        idx = max(0, min(greeting_index, len(all_greetings) - 1))
        chosen_text = all_greetings[idx]
        messages.append(
            ChatMessage(
                id=f"msg-{uuid.uuid4().hex[:8]}",
                role="assistant",
                content=chosen_text,
                swipes=all_greetings,
                swipe_id=idx,
                timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            )
        )

    session = ChatSession(
        id=f"chat-{uuid.uuid4().hex[:8]}",
        character_id=card.id or "",
        title=f"與 {card.name} 的對話 ({datetime.now().strftime('%m/%d %H:%M')})",
        user_name=uname,
        user_persona=upersona,
        memory_summary="",
        messages=messages
    )
    return save_chat_session(session)
