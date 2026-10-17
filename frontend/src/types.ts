export interface ProviderConfig {
  api_key: string;
  base_url?: string;
  model: string;
  cached_models?: string[];
}

export interface AISettings {
  provider: 'openai' | 'openrouter' | 'gemini' | 'claude' | 'custom';
  api_key: string;
  base_url?: string;
  model: string;
  temperature: number;
  max_tokens: number;
  providers?: Record<string, ProviderConfig>;
}

export interface SubLocation {
  id: string;
  name: string;
  description: string;
}

export interface Location {
  id: string;
  name: string;
  description: string;
  sub_locations: SubLocation[];
}

export interface Character {
  id: string;
  name: string;
  role: string;
  gender?: string;
  age?: string;
  profile: string;
  appearance?: string;
  avatar_url?: string;
}

export interface LoreItem {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  content: string;
  is_constant: boolean;
  is_enabled: boolean;
}

export interface GameChoiceOption {
  id: string;
  text: string;
  hint?: string;
}

export interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  outline: string;
  selected_location_ids: string[];
  selected_sub_location_ids: string[];
  selected_character_ids: string[];
  selected_lore_item_ids?: string[];
  content: string;
  word_count: number;
  summary?: string;
  starting_plot?: string;
  starting_options?: GameChoiceOption[];
}

export interface Novel {
  id: string;
  title: string;
  genre: string;
  tone: string;
  main_plot: string;
  world_background: string;
  cover_url?: string;
  global_style_guide?: string;
  locations: Location[];
  characters: Character[];
  chapters: Chapter[];
  lore_items?: LoreItem[];
  game_rules?: GameRulesConfig;
  created_at?: string;
  updated_at?: string;
}

export interface NovelListItem {
  id: string;
  title: string;
  genre: string;
  tone: string;
  main_plot: string;
  cover_url?: string;
  locations_count: number;
  characters_count: number;
  chapters_count: number;
  total_word_count?: number;
  lore_items_count?: number;
  updated_at?: string;
}

export interface RecalledScene {
  id: string;
  chapter_number: number;
  chapter_title: string;
  text: string;
  score: number;
  reason: string;
  characters: string[];
}

// ==================== 獨立遊戲版與角色聊天版型別 ====================
export type SystemMode = 'novel' | 'game' | 'game_frontstage' | 'character' | 'character_frontstage';

export interface GameRulesConfig {
  rules_text: string;                  // 第一欄：自行輸入文字定義遊戲規則
  dialog_choices: number[];            // 第二欄：每回合對話選擇數 (3, 4, 5)
  allow_custom_input: boolean;         // 第三欄：是否允許玩家自行輸入劇情分歧
  strict_rule_enforcement: boolean;    // 第四欄：強硬遊戲規則防暴走(true) 或 劇情自由發展(false)
  enable_player_stats?: boolean;       // 第五欄：是否啟用玩家數值狀態
  initial_player_stats?: string;       // 玩家啟始數值狀態 (若啟用)
}

export interface GameProject extends Novel {
  game_rules?: GameRulesConfig;
}

export interface GameListItem extends NovelListItem {
  game_rules?: GameRulesConfig;
}

// ==================== 遊戲前台遊玩型別 ====================
export interface GameTurnHistoryItem {
  round: number;
  story_segment: string;
  player_action: string;
  choice_type?: 'preset' | 'custom';
}

export interface GameTurnRequest {
  game_id: string;
  current_action: string;
  action_type?: 'preset' | 'custom';
  history: GameTurnHistoryItem[];
  current_player_stats?: string;
  custom_instruction?: string;
}

export interface GameTurnResponse {
  story_continuation: string;
  choices: GameChoiceOption[];
  status_summary?: string;
  updated_player_stats?: string;
  stats_changes?: string;
  round: number;
  triggered_lore_items?: {
    id: string;
    title: string;
    category: string;
    trigger_reason?: string;
    keywords?: string[];
  }[];
}

// ==================== 角色聊天版本 (SillyTavern V2/V3 相容角色卡與對話型別) ====================
export interface CharacterCard {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  alternate_greetings: string[];
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  tags: string[];
  creator: string;
  character_version: string;
  avatar_url?: string;
  lore_items: LoreItem[];
  user_persona_name?: string;
  user_persona_desc?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CharacterCardListItem {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  creator_notes: string;
  tags: string[];
  creator: string;
  character_version: string;
  avatar_url?: string;
  lore_items_count: number;
  alternate_greetings_count: number;
  chat_sessions_count: number;
  total_messages_count: number;
  updated_at?: string;
}

export interface RecalledChatTurn {
  id: string;
  turn_index: number;
  text: string;
  score: number;
  reason: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  swipes: string[];
  swipe_id: number;
  timestamp?: string;
  triggered_lore?: {
    id: string;
    title: string;
    category: string;
    trigger_reason?: string;
    keywords?: string[];
    content?: string;
  }[];
  recalled_rag?: RecalledChatTurn[];
}

export interface ChatSession {
  id: string;
  character_id: string;
  title: string;
  user_name: string;
  user_persona: string;
  memory_summary: string;
  messages: ChatMessage[];
  created_at?: string;
  updated_at?: string;
}

export interface ChatSessionListItem {
  id: string;
  character_id: string;
  title: string;
  user_name: string;
  messages_count: number;
  last_message_preview: string;
  has_memory_summary: boolean;
  updated_at?: string;
}

export interface ChatReplyResponse {
  session: ChatSession;
  assistant_message: ChatMessage;
  triggered_lore_items: {
    id: string;
    title: string;
    category: string;
    trigger_reason?: string;
    keywords?: string[];
    content?: string;
  }[];
  recalled_rag_items: RecalledChatTurn[];
}
