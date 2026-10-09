from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# ==================== AI 設定 ====================
class ProviderConfig(BaseModel):
    api_key: str = Field(default="", description="專屬 API Key")
    base_url: Optional[str] = Field(default="", description="專屬 Base URL")
    model: str = Field(default="", description="專屬選定模型")
    cached_models: List[str] = Field(default_factory=list, description="快取已獲取的完整可用模型清單")

class AISettings(BaseModel):
    provider: str = Field(default="openai", description="當前生效平台: openai | openrouter | gemini | claude | custom")
    api_key: str = Field(default="", description="當前生效 API Key")
    base_url: Optional[str] = Field(default="", description="當前生效 Base URL")
    model: str = Field(default="gpt-4o", description="當前生效模型名稱")
    temperature: float = Field(default=0.75, description="創作自由度")
    max_tokens: int = Field(default=4000, description="最大輸出 Token 數")
    providers: Dict[str, ProviderConfig] = Field(
        default_factory=lambda: {
            "openai": ProviderConfig(api_key="", base_url="https://api.openai.com/v1", model="gpt-4o"),
            "openrouter": ProviderConfig(api_key="", base_url="https://openrouter.ai/api/v1", model="anthropic/claude-3.5-sonnet"),
            "gemini": ProviderConfig(api_key="", base_url="", model="gemini-2.5-flash"),
            "claude": ProviderConfig(api_key="", base_url="", model="claude-3-5-sonnet-20241022"),
            "custom": ProviderConfig(api_key="", base_url="http://localhost:11434/v1", model="llama3"),
        },
        description="各平台各自獨立保存的專屬設定"
    )

# ==================== 第 2 層：地點系統 ====================
class SubLocation(BaseModel):
    id: Optional[str] = Field(default="", description="子地點 ID")
    name: str = Field(..., description="子地點名稱 (如：皇家學園圖書館、貧民窟小酒館)")
    description: str = Field(default="", description="詳細描寫、內部結構、氛圍與特殊設定")

class Location(BaseModel):
    id: Optional[str] = Field(default="", description="主地點 ID")
    name: str = Field(..., description="主地點名稱 (如：艾斯特王國、新東京、阿爾法星系)")
    description: str = Field(default="", description="地理環境、氣候、整體風貌與背景")
    sub_locations: List[SubLocation] = Field(default_factory=list, description="附屬細節/子地點列表")

# ==================== 第 3 層：角色系統 ====================
class Character(BaseModel):
    id: Optional[str] = Field(default="", description="角色 ID")
    name: str = Field(..., description="角色姓名")
    role: str = Field(default="主角", description="定位 (主角 / 配角 / 反派 / 導師等)")
    gender: Optional[str] = Field(default="", description="性別")
    age: Optional[str] = Field(default="", description="年齡")
    profile: str = Field(default="", description="性格特質、背景身世、核心動機")
    appearance: Optional[str] = Field(default="", description="外貌與穿著描寫")
    avatar_url: Optional[str] = Field(default="", description="角色圖片 URL 或 Base64 或本地路徑")

# ==================== 第 4 層：世界書與伏筆記憶庫 (Lorebook) ====================
class LoreItem(BaseModel):
    id: Optional[str] = Field(default="", description="記憶詞條 ID")
    title: str = Field(..., description="詞條名稱 (如：九霄龍佩、太古血盟、黑市神秘商號)")
    category: str = Field(default="伏筆秘密", description="分類 (伏筆秘密 | 關鍵物品 | 誓言契約 | 組織勢力 | 歷史傳說 | 特殊設定)")
    keywords: List[str] = Field(default_factory=list, description="觸發關鍵字列表，如 ['龍佩', '玉佩', '信物']")
    content: str = Field(default="", description="記憶與伏筆詳情、真相、限制或來歷")
    is_constant: bool = Field(default=False, description="是否常駐生效 (無需關鍵字，每一章均注入)")
    is_enabled: bool = Field(default=True, description="是否啟用")

# ==================== 第 5 層：章節與關卡系統 ====================
class GameChoiceOption(BaseModel):
    id: str = Field(default="", description="選項 ID")
    text: str = Field(default="", description="選項內容")
    hint: Optional[str] = Field(default="", description="選項後續引導或預期後果說明")

class Chapter(BaseModel):
    id: Optional[str] = Field(default="", description="章節 ID")
    chapter_number: int = Field(default=1, description="章節序號")
    title: str = Field(..., description="章節標題")
    outline: str = Field(default="", description="本章目標 / 情節大綱 / 關鍵衝突")
    selected_location_ids: List[str] = Field(default_factory=list, description="本章發生的地點 ID 列表")
    selected_sub_location_ids: List[str] = Field(default_factory=list, description="本章發生的子地點 ID 列表")
    selected_character_ids: List[str] = Field(default_factory=list, description="本章登場的角色 ID 列表")
    selected_lore_item_ids: Optional[List[str]] = Field(default_factory=list, description="本章手動指定的特定記憶伏筆 ID (預設由系統自動根據關鍵字掃描命中)")
    content: str = Field(default="", description="正文內容")
    word_count: int = Field(default=0, description="章節字數")
    summary: Optional[str] = Field(default="", description="章節後續劇情小結 (供後續章節銜接)")
    starting_plot: Optional[str] = Field(default="", description="遊戲關卡啟始劇情")
    starting_options: Optional[List[GameChoiceOption]] = Field(default_factory=list, description="遊戲關卡啟始選項列表")

# ==================== 第 1 層：小說主體 ====================
class Novel(BaseModel):
    id: Optional[str] = Field(default="", description="小說 ID")
    title: str = Field(default="未命名小說", description="小說名稱")
    genre: str = Field(default="奇幻冒險", description="題材類型 (如：玄幻、科幻、懸疑、都市、武俠)")
    tone: str = Field(default="熱血激昂", description="寫作風格與基調 (如：幽默詼諧、黑暗壓抑、史詩磅礴)")
    main_plot: str = Field(default="", description="主要劇情架構 / 核心主線 / 衝突與目標")
    world_background: str = Field(default="", description="世界觀概述與時代背景")
    cover_url: Optional[str] = Field(default="", description="小說封面圖片 URL (支援本地上傳或外部連結)")
    global_style_guide: Optional[str] = Field(
        default="", 
        description="全域 AI 文字風格與行文規範 (最高優先級，約束全域小說、角色、地點與正文生成)"
    )
    locations: List[Location] = Field(default_factory=list, description="第 2 層：地點大項目與附屬細節")
    characters: List[Character] = Field(default_factory=list, description="第 3 層：角色清單與頭像")
    lore_items: List[LoreItem] = Field(default_factory=list, description="第 4 層：長時記憶庫 / 關鍵伏筆與世界書卡片 (Lorebook)")
    chapters: List[Chapter] = Field(default_factory=list, description="第 5 層：章節創作清單")
    game_rules: Optional["GameRulesConfig"] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

# ==================== 獨立遊戲版規則與專案模型 ====================
class GameRulesConfig(BaseModel):
    rules_text: str = Field(default="", description="第一欄：自訂遊戲規則文字")
    dialog_choices: List[int] = Field(default_factory=lambda: [3], description="第二欄：每回合對話選項數量 (3, 4, 5)")
    allow_custom_input: bool = Field(default=True, description="第三欄：是否允許玩家自行輸入劇情分歧")
    strict_rule_enforcement: bool = Field(default=True, description="第四欄：強硬遊戲規則防暴走(True) 或 劇情自由發展(False)")

class GameProject(BaseModel):
    id: Optional[str] = Field(default="", description="遊戲專案 ID")
    title: str = Field(default="未命名遊戲專案", description="遊戲名稱")
    genre: str = Field(default="文字冒險RPG", description="遊戲類型 (如：文字冒險、互動RPG、視覺小說、地牢冒險)")
    tone: str = Field(default="沉浸互動", description="遊戲風格與基調 (如：探索冒險、緊張懸疑、輕鬆幽默)")
    main_plot: str = Field(default="", description="主要劇情架構 / 主線任務與目標")
    world_background: str = Field(default="", description="世界觀概述與遊戲舞台設定")
    cover_url: Optional[str] = Field(default="", description="遊戲封面/海報圖片 URL (支援本地上傳或外部連結)")
    global_style_guide: Optional[str] = Field(
        default="", 
        description="全域 AI 文字風格與對話行文規範"
    )
    game_rules: Optional[GameRulesConfig] = Field(
        default_factory=GameRulesConfig,
        description="第 1 層頂部：遊戲規則定義 (4 欄位：規則文字、選項數、玩家自訂、強硬/自由約束)"
    )
    locations: List[Location] = Field(default_factory=list, description="第 2 層：世界場景與地圖清單")
    characters: List[Character] = Field(default_factory=list, description="第 3 層：NPC角色與立繪清單")
    lore_items: List[LoreItem] = Field(default_factory=list, description="第 4 層：記憶伏筆與世界書卡片")
    chapters: List[Chapter] = Field(default_factory=list, description="第 5 層：章節流程與關卡清單")
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

# ==================== AI 請求模型 ====================
class GenerateOutlineRequest(BaseModel):
    title: Optional[str] = ""
    genre: Optional[str] = ""
    tone: Optional[str] = ""
    rough_idea: str = Field(default="", description="用戶手寫的粗略靈感或構想")
    global_style_guide: Optional[str] = ""

class GenerateLocationsRequest(BaseModel):
    novel_title: Optional[str] = "未命名小說"
    genre: Optional[str] = "奇幻冒險"
    main_plot: Optional[str] = ""
    world_background: Optional[str] = ""
    global_style_guide: Optional[str] = ""
    count: int = 3
    hint: Optional[str] = ""

class GenerateCharactersRequest(BaseModel):
    novel_title: Optional[str] = "未命名小說"
    genre: Optional[str] = "奇幻冒險"
    main_plot: Optional[str] = ""
    world_background: Optional[str] = ""
    global_style_guide: Optional[str] = ""
    count: int = 3
    hint: Optional[str] = ""

class GenerateChapterRequest(BaseModel):
    novel_id: str
    chapter_id: str
    target_words: Optional[int] = 2000
    custom_instruction: Optional[str] = ""
    rag_hint: Optional[str] = ""

class ContinueWritingRequest(BaseModel):
    novel_id: str
    chapter_id: str
    current_content: str
    instruction: Optional[str] = "順著當前情節繼續生動地描寫下去"
    target_words: Optional[int] = 800
    rag_hint: Optional[str] = ""

class GenerateChapterSummaryRequest(BaseModel):
    novel_id: str
    chapter_id: str

class AnalyzeLoreItemsRequest(BaseModel):
    novel_id: str
    count: Optional[int] = 4
    hint: Optional[str] = ""

class QueryRagRequest(BaseModel):
    novel_id: str
    chapter_id: str
    hint: Optional[str] = ""
    top_k: Optional[int] = 3

class RecalledScene(BaseModel):
    id: str
    chapter_number: int
    chapter_title: str
    text: str
    score: float
    reason: str
    characters: List[str] = Field(default_factory=list)



