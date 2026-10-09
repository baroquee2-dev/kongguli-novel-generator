import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from app.config import NOVELS_DIR, GAMES_DIR
from app.models import Novel, GameProject, GameRulesConfig

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
