import React, { useState, useRef } from 'react';
import type { CharacterCard, LoreItem } from '../types';
import { api } from '../api/client';
import {
  UserCircle2, Upload, Download, Sparkles, MessageSquareHeart, Plus, Trash2,
  BookOpen, Terminal, MessageCircle, Tag, Loader2, FileUp, Info, Brain
} from 'lucide-react';

interface Props {
  card: CharacterCard;
  onChange: (updated: CharacterCard) => void;
  onImportSuccess: (importedCard: CharacterCard) => void;
  onStartChat: (cardId: string) => void;
  activeSubTab: 'profile' | 'greetings' | 'character_book' | 'prompts';
}

export const CharacterStudioView: React.FC<Props> = ({
  card,
  onChange,
  onImportSuccess,
  onStartChat,
  activeSubTab
}) => {
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [importingCard, setImportingCard] = useState(false);
  const [newTagText, setNewTagText] = useState('');

  // AI 靈感生成角色卡彈窗狀態
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiNameHint, setAiNameHint] = useState('');
  const [aiRoughIdea, setAiRoughIdea] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const stImportInputRef = useRef<HTMLInputElement>(null);

  const updateField = <K extends keyof CharacterCard>(key: K, val: CharacterCard[K]) => {
    onChange({ ...card, [key]: val });
  };

  // 上傳一般角色立繪/頭像圖片
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const url = await api.uploadAvatar(file);
      updateField('avatar_url', url);
    } catch (err: any) {
      alert(err.message || '圖片上傳失敗');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // 匯入 SillyTavern (.png / .json) 角色卡
  const handleImportSTCard = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingCard(true);
    try {
      const imported = await api.importCharacterCard(file);
      onImportSuccess(imported);
    } catch (err: any) {
      alert(err.message || '匯入 SillyTavern 角色卡失敗');
    } finally {
      setImportingCard(false);
      if (stImportInputRef.current) stImportInputRef.current.value = '';
    }
  };

  // 匯出 SillyTavern V2 JSON
  const handleExportSTJson = () => {
    if (!card.id) return;
    window.open(api.getExportCharacterCardJsonUrl(card.id), '_blank');
  };

  // AI 一鍵生成 SillyTavern 角色卡內容
  const handleAiGenerateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiRoughIdea.trim()) return;
    setAiGenerating(true);
    try {
      const generated = await api.generateCharacterCardByAI({
        name_hint: aiNameHint.trim() || card.name,
        rough_idea: aiRoughIdea.trim(),
        include_lore: true
      });
      onChange({
        ...card,
        name: generated.name || card.name,
        description: generated.description || card.description,
        personality: generated.personality || card.personality,
        scenario: generated.scenario || card.scenario,
        first_mes: generated.first_mes || card.first_mes,
        alternate_greetings: generated.alternate_greetings || card.alternate_greetings || [],
        mes_example: generated.mes_example || card.mes_example,
        creator_notes: generated.creator_notes || card.creator_notes,
        system_prompt: generated.system_prompt || card.system_prompt,
        post_history_instructions: generated.post_history_instructions || card.post_history_instructions,
        tags: generated.tags || card.tags || [],
        lore_items: generated.lore_items || card.lore_items || []
      });
      setIsAiModalOpen(false);
      setAiRoughIdea('');
    } catch (err: any) {
      alert(err.message || 'AI 生成角色卡失敗');
    } finally {
      setAiGenerating(false);
    }
  };

  // 標籤管理
  const handleAddTag = () => {
    const t = newTagText.trim();
    if (!t) return;
    const currentTags = card.tags || [];
    if (!currentTags.includes(t)) {
      updateField('tags', [...currentTags, t]);
    }
    setNewTagText('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    updateField('tags', (card.tags || []).filter(t => t !== tagToRemove));
  };

  // 備選開場白管理
  const handleAddAlternateGreeting = () => {
    const current = card.alternate_greetings || [];
    updateField('alternate_greetings', [
      ...current,
      `*{{char}}看著走近的{{user}}，露出了耐人尋味的微笑。*\n「歡迎，這是一段新的相遇分支……」`
    ]);
  };

  const handleUpdateAlternateGreeting = (idx: number, val: string) => {
    const next = [...(card.alternate_greetings || [])];
    next[idx] = val;
    updateField('alternate_greetings', next);
  };

  const handleDeleteAlternateGreeting = (idx: number) => {
    const next = (card.alternate_greetings || []).filter((_, i) => i !== idx);
    updateField('alternate_greetings', next);
  };

  // 角色專屬世界書 (Character Book) 管理
  const handleAddLoreItem = () => {
    const newItem: LoreItem = {
      id: `lore-${Date.now().toString(36)}`,
      title: '新角色設定詞條',
      category: '角色秘密',
      keywords: [card.name],
      content: '',
      is_constant: false,
      is_enabled: true
    };
    updateField('lore_items', [newItem, ...(card.lore_items || [])]);
  };

  const handleUpdateLoreItem = (idx: number, patch: Partial<LoreItem>) => {
    const next = [...(card.lore_items || [])];
    next[idx] = { ...next[idx], ...patch };
    updateField('lore_items', next);
  };

  const handleDeleteLoreItem = (idx: number) => {
    const next = (card.lore_items || []).filter((_, i) => i !== idx);
    updateField('lore_items', next);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 頂部功能橫幅：SillyTavern 相容匯入/匯出 + AI 靈感生成 + 立即開始聊天 */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900/90 to-fuchsia-950/40 border border-rose-500/30 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
            <MessageSquareHeart className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-100">
                {card.name || '未命名角色'}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                SillyTavern V2/V3 相容
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              支援直接匯入 SillyTavern 的 <code className="text-rose-300">.png</code> 角色卡圖片（含內嵌世界書）與 <code className="text-rose-300">.json</code> 角色設定檔
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* 隱藏的匯入檔案 Input */}
          <input
            ref={stImportInputRef}
            type="file"
            accept=".png,.json"
            onChange={handleImportSTCard}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => stImportInputRef.current?.click()}
            disabled={importingCard}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600/80 text-xs font-bold text-slate-200 transition shadow-sm"
          >
            {importingCard ? <Loader2 className="w-4 h-4 animate-spin text-rose-400" /> : <FileUp className="w-4 h-4 text-rose-400" />}
            <span>匯入酒館角色卡 (.png / .json)</span>
          </button>

          <button
            type="button"
            onClick={handleExportSTJson}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600/80 text-xs font-bold text-slate-200 transition shadow-sm"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>匯出 V2 JSON</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAiNameHint(card.name);
              setIsAiModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-xs font-bold text-white shadow-md shadow-purple-600/20 transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI 靈感捏角</span>
          </button>

          <button
            type="button"
            onClick={() => onStartChat(card.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-xs font-extrabold text-white shadow-lg shadow-rose-600/30 transition transform hover:-translate-y-0.5"
          >
            <MessageCircle className="w-4 h-4" />
            <span>💬 與「{card.name}」開始聊天</span>
          </button>
        </div>
      </div>

      {/* ==================== 子頁籤 1：角色基本定義與立繪 (profile) ==================== */}
      {activeSubTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左側：角色立繪海報與基本元數據 */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <UserCircle2 className="w-4 h-4 text-rose-400" />
                  角色立繪 / 角色卡圖片
                </span>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1"
                >
                  {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>更換圖片</span>
                </button>
              </div>

              {/* 角色圖片展示框 */}
              <div
                onClick={() => avatarInputRef.current?.click()}
                className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-slate-950 border-2 border-dashed border-slate-800 hover:border-rose-500/60 transition cursor-pointer group flex items-center justify-center"
              >
                {card.avatar_url ? (
                  <>
                    <img
                      src={card.avatar_url}
                      alt={card.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs font-bold text-white">
                      點擊上傳更換立繪圖片
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6 space-y-2 text-slate-500">
                    <UserCircle2 className="w-14 h-14 mx-auto text-slate-700 group-hover:text-rose-400 transition" />
                    <p className="text-xs font-medium text-slate-400">點擊上傳角色立繪或頭像</p>
                    <p className="text-[11px] text-slate-600">
                      支援 PNG / JPG / WEBP，聊天時將自動作為沉浸式背景與頭像
                    </p>
                  </div>
                )}
              </div>

              {/* 圖片網址直接輸入 */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  或直接貼上圖片 URL
                </label>
                <input
                  type="text"
                  value={card.avatar_url || ''}
                  onChange={(e) => updateField('avatar_url', e.target.value)}
                  placeholder="https://... 或本地上傳路徑"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            {/* 創作者與標籤資訊 */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    創作者 (Creator)
                  </label>
                  <input
                    type="text"
                    value={card.creator || ''}
                    onChange={(e) => updateField('creator', e.target.value)}
                    placeholder="作者名稱"
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    角色卡版本 (Version)
                  </label>
                  <input
                    type="text"
                    value={card.character_version || ''}
                    onChange={(e) => updateField('character_version', e.target.value)}
                    placeholder="1.0"
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* 標籤 (Tags) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-rose-400" /> 角色分類標籤 (Tags)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(card.tags || []).map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-rose-950/60 text-rose-200 border border-rose-500/30"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="text-rose-400 hover:text-white ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newTagText}
                    onChange={(e) => setNewTagText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="輸入標籤後按 Enter..."
                    className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl"
                  >
                    新增
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 右側：SillyTavern 核心角色定義欄位 */}
          <div className="lg:col-span-8 space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">
                    角色名稱 (Name / <code className="text-rose-400">{'{{char}}'}</code>) *
                  </label>
                  <input
                    type="text"
                    value={card.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="例如：星見 汐音"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-slate-100 focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">
                    性格特質摘要 (Personality)
                  </label>
                  <input
                    type="text"
                    value={card.personality || ''}
                    onChange={(e) => updateField('personality', e.target.value)}
                    placeholder="例如：外冷內熱、優雅慵懶、毒舌卻溫柔..."
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* 角色核心描述 (Description) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-200">
                    角色核心定義與背景設定 (Description)
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500">快捷插入宏：</span>
                    <button
                      type="button"
                      onClick={() => updateField('description', (card.description || '') + '{{char}}')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 font-mono"
                    >
                      {'{{char}}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('description', (card.description || '') + '{{user}}')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono"
                    >
                      {'{{user}}'}
                    </button>
                  </div>
                </div>
                <textarea
                  rows={10}
                  value={card.description || ''}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="填寫角色的外貌特徵、穿搭、身世背景、能力設定、說話風格以及對 {{user}} 的態度（相容 SillyTavern W++ / PList / 自然語言格式）..."
                  className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 leading-relaxed focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* 創作者備註 (Creator Notes) */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  創作者備註 / 角色食用指南 (Creator Notes)
                </label>
                <textarea
                  rows={3}
                  value={card.creator_notes || ''}
                  onChange={(e) => updateField('creator_notes', e.target.value)}
                  placeholder="顯示於前台角色卡大廳的角色簡介、背景說明或推薦玩法提示（不會消耗對話 Token）..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 子頁籤 2：場景、開場白與對話範例 (greetings) ==================== */}
      {activeSubTab === 'greetings' && (
        <div className="space-y-6">
          {/* 場景設定 (Scenario) */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <label className="block text-xs font-bold text-slate-200">
              當前場景與互動情境 (Scenario)
            </label>
            <textarea
              rows={3}
              value={card.scenario || ''}
              onChange={(e) => updateField('scenario', e.target.value)}
              placeholder="描述 {{char}} 與 {{user}} 當前所處的環境、時間點與互動前提..."
              className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 leading-relaxed focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* 主開場白 (First Message) */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-rose-300">
                  主開場白 / 第一句話 (First Message)
                </label>
                <p className="text-[11px] text-slate-400">
                  開啟新對話時角色主動說出的第一段話。建議用 <code className="text-amber-300">*星號*</code> 描寫神態與環境，用 <code className="text-emerald-300">「引號」</code> 包裹台詞。
                </p>
              </div>
            </div>
            <textarea
              rows={7}
              value={card.first_mes || ''}
              onChange={(e) => updateField('first_mes', e.target.value)}
              placeholder="*{{char}}緩緩轉過身看向{{user}}...*&#10;「你終於來了。」"
              className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 leading-relaxed focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* 備選開場白列表 (Alternate Greetings) */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-200">
                  備選開場白分支 (Alternate Greetings) ({(card.alternate_greetings || []).length})
                </h3>
                <p className="text-[11px] text-slate-400">
                  相容 SillyTavern 多重開場白！玩家在前台開啟對話時，可自由左右切換不同情境的開場白。
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddAlternateGreeting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-xs font-bold text-rose-300 transition"
              >
                <Plus className="w-3.5 h-3.5" /> 新增備選開場白
              </button>
            </div>

            {(card.alternate_greetings || []).length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-500">
                目前尚無備選開場白，點擊右上角「新增備選開場白」可設計多種相遇情境。
              </div>
            ) : (
              <div className="space-y-3">
                {(card.alternate_greetings || []).map((greet, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-rose-400">
                        備選開場白 #{idx + 2}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteAlternateGreeting(idx)}
                        className="text-slate-500 hover:text-rose-400 text-xs flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> 刪除
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={greet}
                      onChange={(e) => handleUpdateAlternateGreeting(idx, e.target.value)}
                      className="w-full p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs sm:text-sm text-slate-200 leading-relaxed focus:outline-none focus:border-rose-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 對話範例 (Message Examples) */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-200">
                  角色語氣與對話範例 (Message Examples / <code className="text-rose-400">mes_example</code>)
                </label>
                <p className="text-[11px] text-slate-400">
                  用於示範角色的口癖、語氣與描寫習慣，以 <code className="text-cyan-300">&lt;START&gt;</code> 分隔每段範例。
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateField(
                    'mes_example',
                    (card.mes_example ? card.mes_example + '\n' : '') +
                      '<START>\n{{user}}: 你好。\n{{char}}: *{{char}}微微一笑*「你好呀，{{user}}。」'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-cyan-300"
              >
                + 插入 &lt;START&gt; 範本
              </button>
            </div>
            <textarea
              rows={6}
              value={card.mes_example || ''}
              onChange={(e) => updateField('mes_example', e.target.value)}
              placeholder="<START>&#10;{{user}}: ...&#10;{{char}}: *動作描寫*「台詞...」"
              className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono text-slate-200 leading-relaxed focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>
      )}

      {/* ==================== 子頁籤 3：角色專屬世界書 (character_book) ==================== */}
      {activeSubTab === 'character_book' && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                <Brain className="w-4 h-4 text-cyan-400" />
                角色專屬世界書 (Character Book / Lorebook) ({(card.lore_items || []).length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                相容 SillyTavern <code className="text-cyan-300">character_book</code>。當聊天提及關鍵字或設為「常駐生效」時，自動喚醒注入 AI 記憶！
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddLoreItem}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white shadow-md shadow-cyan-600/20 transition"
            >
              <Plus className="w-4 h-4" /> 新增世界書記憶詞條
            </button>
          </div>

          {(card.lore_items || []).length === 0 ? (
            <div className="p-10 text-center rounded-xl bg-slate-950/60 border border-slate-800 text-slate-500 space-y-2">
              <BookOpen className="w-8 h-8 mx-auto text-slate-700" />
              <p className="text-xs">目前此角色尚無專屬世界書詞條。匯入帶有內嵌世界書的酒館角色卡會自動載入，或點擊右上角手動新增。</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(card.lore_items || []).map((item, idx) => (
                <div
                  key={item.id || idx}
                  className={`p-4 rounded-xl border space-y-3 transition ${
                    item.is_enabled
                      ? 'bg-slate-950/90 border-slate-800 hover:border-cyan-500/40'
                      : 'bg-slate-950/40 border-slate-900 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => handleUpdateLoreItem(idx, { title: e.target.value })}
                      placeholder="詞條標題"
                      className="flex-1 bg-transparent border-b border-slate-800 focus:border-cyan-500 text-xs font-bold text-cyan-200 pb-1 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={item.category}
                      onChange={(e) => handleUpdateLoreItem(idx, { category: e.target.value })}
                      placeholder="分類"
                      className="w-24 px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-300 text-center"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteLoreItem(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-1">
                      觸發關鍵字 (以逗號分隔，聊天提到任一詞即自動喚醒)：
                    </label>
                    <input
                      type="text"
                      value={(item.keywords || []).join(', ')}
                      onChange={(e) =>
                        handleUpdateLoreItem(idx, {
                          keywords: e.target.value
                            .split(',')
                            .map((k) => k.trim())
                            .filter(Boolean)
                        })
                      }
                      placeholder="例如：古書堂, 懷錶, 秘密約定"
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <textarea
                    rows={3}
                    value={item.content}
                    onChange={(e) => handleUpdateLoreItem(idx, { content: e.target.value })}
                    placeholder="詳細設定內容..."
                    className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 leading-relaxed focus:outline-none focus:border-cyan-500"
                  />

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <label className="flex items-center gap-1.5 cursor-pointer text-emerald-300">
                      <input
                        type="checkbox"
                        checked={item.is_constant}
                        onChange={(e) => handleUpdateLoreItem(idx, { is_constant: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-emerald-500"
                      />
                      <span>📌 常駐全域生效 (Constant)</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-400">
                      <input
                        type="checkbox"
                        checked={item.is_enabled}
                        onChange={(e) => handleUpdateLoreItem(idx, { is_enabled: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-cyan-500"
                      />
                      <span>啟用此詞條</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== 子頁籤 4：進階系統提示詞與預設玩家人設 (prompts) ==================== */}
      {activeSubTab === 'prompts' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-purple-400" />
              SillyTavern 進階演繹提示詞設定
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1">
                角色專屬系統提示詞 (Character System Prompt)
              </label>
              <p className="text-[11px] text-slate-400 mb-2">
                定義 AI 扮演此角色時的敘事風格、視角規範與文筆要求。
              </p>
              <textarea
                rows={4}
                value={card.system_prompt || ''}
                onChange={(e) => updateField('system_prompt', e.target.value)}
                placeholder="例如：請全程以星見汐音的視角進行細膩的小說式對話描寫，動作與神態包裹在 *星號* 中..."
                className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 leading-relaxed focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1">
                歷史後置深度指令 (Post-History Instructions / Author&apos;s Note)
              </label>
              <p className="text-[11px] text-slate-400 mb-2">
                會被放置在最新對話紀錄的最末端、緊貼 AI 回覆之前，具有極高的指令優先權（可用於強調禁止搶話或特定狀態維持）。
              </p>
              <textarea
                rows={3}
                value={card.post_history_instructions || ''}
                onChange={(e) => updateField('post_history_instructions', e.target.value)}
                placeholder="例如：請緊密回應 {{user}} 的最新言行，嚴禁代替 {{user}} 說話或決定行動。"
                className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 leading-relaxed focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* 預設玩家人設 ({{user}} Persona) */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-emerald-400" />
              預設互動玩家人設 (<code className="text-emerald-300">{'{{user}}'}</code> Default Persona)
            </h3>
            <p className="text-[11px] text-slate-400">
              設定與此角色展開新對話時，預設代入的 <code className="text-emerald-300">{'{{user}}'}</code> 稱呼與身份背景（進入聊天室後仍可隨時針對單獨對話修改）。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  預設玩家稱呼 (<code className="text-emerald-300">{'{{user}}'}</code>)
                </label>
                <input
                  type="text"
                  value={card.user_persona_name || '你'}
                  onChange={(e) => updateField('user_persona_name', e.target.value)}
                  placeholder="例如：你、旅行者、學弟..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  預設玩家身份與外貌描述
                </label>
                <input
                  type="text"
                  value={card.user_persona_desc || ''}
                  onChange={(e) => updateField('user_persona_desc', e.target.value)}
                  placeholder="例如：偶然推開古書堂大門的年輕旅人，性格溫和..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI 靈感一鍵捏角彈窗 */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleAiGenerateCard}
            className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-rose-400" />
                AI 靈感一鍵生成 SillyTavern 角色卡
              </h3>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  角色名稱提示（選填，留空由 AI 命名）
                </label>
                <input
                  type="text"
                  value={aiNameHint}
                  onChange={(e) => setAiNameHint(e.target.value)}
                  placeholder="例如：白銀 莉莉絲、冷酷女武神..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  角色設定靈感與互動情境構想 *
                </label>
                <textarea
                  rows={4}
                  required
                  value={aiRoughIdea}
                  onChange={(e) => setAiRoughIdea(e.target.value)}
                  placeholder="例如：一位表面高冷嚴厲的學生會長，私底下卻非常喜歡貓咪與甜點。放學後在空教室被我撞見她正在偷餵小貓..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 leading-relaxed focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:bg-slate-800 rounded-xl"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={aiGenerating}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-fuchsia-600 hover:from-rose-500 hover:to-fuchsia-500 rounded-xl shadow-lg disabled:opacity-50"
              >
                {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{aiGenerating ? 'AI 正在構築角色靈魂與世界書...' : '立即生成完整設定'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
