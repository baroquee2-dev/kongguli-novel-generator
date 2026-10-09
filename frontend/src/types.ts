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

// ==================== 獨立遊戲版型別 ====================
export type SystemMode = 'novel' | 'game';

export interface GameRulesConfig {
  rules_text: string;                  // 第一欄：自行輸入文字定義遊戲規則
  dialog_choices: number[];            // 第二欄：每回合對話選擇數 (3, 4, 5)
  allow_custom_input: boolean;         // 第三欄：是否允許玩家自行輸入劇情分歧
  strict_rule_enforcement: boolean;    // 第四欄：強硬遊戲規則防暴走(true) 或 劇情自由發展(false)
}

export interface GameProject extends Novel {
  game_rules?: GameRulesConfig;
}

export interface GameListItem extends NovelListItem {
  // 遊戲版專案列表項目
}
