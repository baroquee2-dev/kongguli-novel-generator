import React, { useState, useMemo } from 'react';
import type { Novel, LoreItem } from '../types';
import { api } from '../api/client';
import { 
  Brain, Plus, Trash2, Edit3, Sparkles, Search,
  Tag, CheckCircle2, Bookmark, Copy, X, 
  ShieldCheck, Loader2
} from 'lucide-react';

interface Props {
  novel: Novel;
  onChange: (updated: Novel) => void;
}

const CATEGORIES = [
  { id: 'all', label: '全部' },
  { id: '伏筆秘密', label: '伏筆秘密', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { id: '關鍵物品', label: '關鍵物品', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  { id: '誓言契約', label: '誓言契約', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  { id: '組織勢力', label: '組織勢力', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  { id: '歷史傳說', label: '歷史傳說', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
  { id: '特殊設定', label: '特殊設定', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
];

export const LorebookTab: React.FC<Props> = ({ novel, onChange }) => {
  const loreItems: LoreItem[] = novel.lore_items || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // 編輯 / 新增 Modal 狀態
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<LoreItem> | null>(null);
  const [keywordInput, setKeywordInput] = useState('');

  // AI 分析 Modal 狀態
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiHint, setAiHint] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<LoreItem[]>([]);
  const [addedAiIds, setAddedAiIds] = useState<Set<string>>(new Set());

  // 篩選條目
  const filteredItems = useMemo(() => {
    return loreItems.filter(item => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      if (!matchCat) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inTitle = item.title.toLowerCase().includes(q);
      const inContent = item.content.toLowerCase().includes(q);
      const inKeywords = (item.keywords || []).some(k => k.toLowerCase().includes(q));
      return inTitle || inContent || inKeywords;
    });
  }, [loreItems, selectedCategory, searchQuery]);

  // 統計數據
  const totalCount = loreItems.length;
  const constantCount = loreItems.filter(i => i.is_constant && i.is_enabled).length;
  const enabledCount = loreItems.filter(i => i.is_enabled).length;

  // 開啟新增 Modal
  const handleOpenAddModal = () => {
    setEditingItem({
      id: `lore-${Date.now().toString(36)}`,
      title: '',
      category: '伏筆秘密',
      keywords: [],
      content: '',
      is_constant: false,
      is_enabled: true
    });
    setKeywordInput('');
    setIsEditModalOpen(true);
  };

  // 開啟編輯 Modal
  const handleOpenEditModal = (item: LoreItem) => {
    setEditingItem({ ...item, keywords: [...(item.keywords || [])] });
    setKeywordInput('');
    setIsEditModalOpen(true);
  };

  // 複製條目
  const handleDuplicateItem = (item: LoreItem) => {
    const newItem: LoreItem = {
      ...item,
      id: `lore-${Date.now().toString(36)}`,
      title: `${item.title} (副本)`,
      keywords: [...item.keywords]
    };
    const updated = [...loreItems, newItem];
    onChange({ ...novel, lore_items: updated });
  };

  // 刪除條目
  const handleDeleteItem = (id: string) => {
    if (!confirm('確定要刪除這張記憶卡片嗎？')) return;
    const updated = loreItems.filter(i => i.id !== id);
    onChange({ ...novel, lore_items: updated });
  };

  // 切換啟用狀態
  const handleToggleEnabled = (id: string) => {
    const updated = loreItems.map(item => {
      if (item.id === id) {
        return { ...item, is_enabled: !item.is_enabled };
      }
      return item;
    });
    onChange({ ...novel, lore_items: updated });
  };

  // 儲存編輯/新增
  const handleSaveItem = () => {
    if (!editingItem) return;
    if (!editingItem.title?.trim()) {
      alert('請填寫詞條標題');
      return;
    }

    // 若輸入框內還有未按 Enter 的關鍵字，自動補入
    let finalKeywords = [...(editingItem.keywords || [])];
    if (keywordInput.trim()) {
      const parts = keywordInput.split(/[,，、\s]+/).filter(Boolean);
      for (const p of parts) {
        if (!finalKeywords.includes(p)) finalKeywords.push(p);
      }
    }

    const itemToSave: LoreItem = {
      id: editingItem.id || `lore-${Date.now().toString(36)}`,
      title: editingItem.title.trim(),
      category: editingItem.category || '伏筆秘密',
      keywords: finalKeywords,
      content: editingItem.content?.trim() || '',
      is_constant: Boolean(editingItem.is_constant),
      is_enabled: editingItem.is_enabled ?? true
    };

    const exists = loreItems.some(i => i.id === itemToSave.id);
    const updated = exists 
      ? loreItems.map(i => i.id === itemToSave.id ? itemToSave : i)
      : [...loreItems, itemToSave];

    onChange({ ...novel, lore_items: updated });
    setIsEditModalOpen(false);
    setEditingItem(null);
  };

  // 新增關鍵字 Tag
  const handleAddKeyword = (raw: string) => {
    if (!raw.trim() || !editingItem) return;
    const parts = raw.split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean);
    const curr = editingItem.keywords || [];
    const newKw = [...curr];
    for (const p of parts) {
      if (!newKw.includes(p)) newKw.push(p);
    }
    setEditingItem({ ...editingItem, keywords: newKw });
    setKeywordInput('');
  };

  // 移除關鍵字 Tag
  const handleRemoveKeyword = (kwToRemove: string) => {
    if (!editingItem) return;
    setEditingItem({
      ...editingItem,
      keywords: (editingItem.keywords || []).filter(k => k !== kwToRemove)
    });
  };

  // AI 提煉伏筆
  const handleAnalyzeAi = async () => {
    setIsAnalyzing(true);
    setAiSuggestions([]);
    setAddedAiIds(new Set());
    try {
      const res = await api.analyzeLoreItems({
        novel_id: novel.id,
        count: 4,
        hint: aiHint.trim()
      });
      setAiSuggestions(res.items || []);
    } catch (e: any) {
      alert(e.message || 'AI 提煉伏筆失敗');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 將 AI 建議加入記憶庫
  const handleAddAiSuggestion = (item: LoreItem) => {
    const updated = [...loreItems, item];
    onChange({ ...novel, lore_items: updated });
    setAddedAiIds(prev => new Set([...prev, item.id]));
  };

  // 一鍵加入全部 AI 建議
  const handleAddAllAiSuggestions = () => {
    const toAdd = aiSuggestions.filter(item => !addedAiIds.has(item.id));
    if (toAdd.length === 0) return;
    const updated = [...loreItems, ...toAdd];
    onChange({ ...novel, lore_items: updated });
    setAddedAiIds(new Set(aiSuggestions.map(i => i.id)));
  };

  const getCategoryColor = (cat: string) => {
    const found = CATEGORIES.find(c => c.id === cat);
    return found?.color || 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="space-y-6">
      {/* 頂部導引與操作列 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-cyan-500/20 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  第 4 層
                </span>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  世界書與伏筆記憶庫 (Lorebook)
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                建立關鍵物品、秘密誓約、勢力與特殊設定卡片。支援關鍵字自動掃描觸發與常駐注入，防止長篇創作吃書與遺忘。
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsAiModalOpen(true);
              if (aiSuggestions.length === 0) {
                handleAnalyzeAi();
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs shadow-lg shadow-purple-600/20 transition"
          >
            <Sparkles className="w-4 h-4 text-purple-200" />
            <span>✨ AI 智慧提煉新伏筆</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-lg shadow-cyan-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>新增記憶卡片</span>
          </button>
        </div>
      </div>

      {/* 搜尋與分類過濾列 */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* 分類藥丸標籤 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
            {CATEGORIES.map(cat => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl border font-medium transition shrink-0 ${
                    active
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm font-semibold'
                      : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* 搜尋框 */}
          <div className="relative sm:w-72 shrink-0">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋詞條名稱、關鍵字或內容..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>
        </div>

        {/* 狀態數據徽章 */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <div className="flex items-center gap-3">
            <span>共 <strong className="text-slate-300">{totalCount}</strong> 條記憶卡片</span>
            <span>·</span>
            <span>已啟用 <strong className="text-emerald-400">{enabledCount}</strong> 條</span>
            <span>·</span>
            <span>常駐生效 <strong className="text-amber-400">{constantCount}</strong> 條</span>
          </div>
          <span className="text-[11px] text-slate-500">
            💡 提示：在【章節創作】頁面撰寫或生成時，AI 會自動讀取並呼應命中的記憶卡片
          </span>
        </div>
      </div>

      {/* 卡片網格列表 */}
      {filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 space-y-3">
          <Brain className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm text-slate-400">
            {searchQuery || selectedCategory !== 'all' 
              ? '找不到符合條件的記憶卡片。' 
              : '目前尚未建立任何記憶或伏筆卡片。'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-3 py-1.5 rounded-lg bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs font-medium transition"
            >
              手動建立第一張卡片
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAiModalOpen(true);
                handleAnalyzeAi();
              }}
              className="px-3 py-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white text-xs font-medium transition flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>由 AI 自動深度分析</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
          {filteredItems.map(item => {
            const isEnabled = item.is_enabled;
            const isConstant = item.is_constant;

            return (
              <div
                key={item.id}
                className={`flex flex-col justify-between p-4 rounded-2xl border transition shadow-lg ${
                  isEnabled
                    ? 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/40'
                    : 'bg-slate-950/60 border-slate-900 opacity-60'
                }`}
              >
                <div className="space-y-3">
                  {/* 卡片頂部：分類、狀態徽章與開關 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getCategoryColor(item.category)}`}>
                        {item.category}
                      </span>
                      {isConstant ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-amber-400" />
                          常駐生效
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/80">
                          關鍵字觸發
                        </span>
                      )}
                    </div>

                    {/* 啟用切換按鈕 */}
                    <button
                      type="button"
                      onClick={() => handleToggleEnabled(item.id)}
                      className={`text-xs px-2 py-1 rounded-lg border font-medium transition ${
                        isEnabled
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                          : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'
                      }`}
                      title={isEnabled ? '點擊停用此卡片' : '點擊啟用此卡片'}
                    >
                      {isEnabled ? '已啟用' : '已停用'}
                    </button>
                  </div>

                  {/* 標題 */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>{item.title}</span>
                    </h3>
                  </div>

                  {/* 觸發關鍵字 Tags */}
                  {!isConstant && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Tag className="w-3 h-3 text-slate-500 shrink-0" />
                      {item.keywords && item.keywords.length > 0 ? (
                        item.keywords.map((kw, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-cyan-300/90 border border-cyan-500/20"
                          >
                            {kw}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-rose-400/80 italic">尚未設定關鍵字（無法自動觸發）</span>
                      )}
                    </div>
                  )}

                  {/* 記憶內容 */}
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 whitespace-pre-wrap">
                    {item.content || '（暫無設定詳情）'}
                  </p>
                </div>

                {/* 卡片底部操作列 */}
                <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => handleDuplicateItem(item)}
                    className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition"
                    title="複製副本"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(item)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>編輯</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                    title="刪除卡片"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 編輯 / 新增卡片 Modal */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Brain className="w-5 h-5 text-cyan-400" />
                <span>{loreItems.some(i => i.id === editingItem.id) ? '編輯世界書記憶卡片' : '新增世界書記憶卡片'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 分類與常駐切換 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    條目分類
                  </label>
                  <select
                    value={editingItem.category || '伏筆秘密'}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="伏筆秘密">伏筆秘密 (未解之謎 / 幕後真相)</option>
                    <option value="關鍵物品">關鍵物品 (神器 / 鑰匙 / 道具)</option>
                    <option value="誓言契約">誓言契約 (血盟 / 約定 / 承諾)</option>
                    <option value="組織勢力">組織勢力 (教團 / 商號 / 刺客盟)</option>
                    <option value="歷史傳說">歷史傳說 (遠古大災變 / 英雄傳記)</option>
                    <option value="特殊設定">特殊設定 (魔法代價 / 禁區規則)</option>
                    <option value="自訂">自訂</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
                    <input
                      type="checkbox"
                      checked={Boolean(editingItem.is_constant)}
                      onChange={(e) => setEditingItem({ ...editingItem, is_constant: e.target.checked })}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span className="text-xs font-medium text-slate-200">
                      常駐生效 (每章均強制注入)
                    </span>
                  </label>
                </div>
              </div>

              {/* 詞條標題 */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  詞條名稱 / 伏筆標題 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={editingItem.title || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  placeholder="例如：【九霄龍佩】、【太古血盟】、【以太畸變法則】"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* 觸發關鍵字 (當非常駐時) */}
              {!editingItem.is_constant && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      觸發關鍵字 (Keys / Keywords)
                    </label>
                    <span className="text-[11px] text-slate-500">
                      輸入關鍵字後按 Enter 或逗號添加
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    {/* 已加入的標籤列表 */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(editingItem.keywords || []).map((kw, i) => (
                        <span
                          key={i}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        >
                          <span>{kw}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveKeyword(kw)}
                            className="hover:text-rose-400 transition"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            handleAddKeyword(keywordInput);
                          }
                        }}
                        placeholder="輸入關鍵字，例如：龍佩 或 玉佩..."
                        className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddKeyword(keywordInput)}
                        className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                      >
                        加入
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    💡 當寫作章節的大綱、登場角色、地點或輸入提示中包含這些詞彙時，AI 自動喚醒此卡片！
                  </p>
                </div>
              )}

              {/* 記憶內容 / 真相說明 */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  記憶設定詳情、隱藏真相與規範 <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={5}
                  value={editingItem.content || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
                  placeholder="詳細說明該物品或伏筆的來歷、目前在誰手上、有什麼不可違背的限制或背後真正的身世秘密... 建議 80~200 字，讓 AI 寫作時有清晰依據。"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 leading-relaxed resize-y"
                />
              </div>

              {/* 是否啟用 */}
              <div>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem.is_enabled ?? true}
                    onChange={(e) => setEditingItem({ ...editingItem, is_enabled: e.target.checked })}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>啟用此卡片（若取消勾選，AI 創作時將暫時忽略此卡片）</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveItem}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-lg shadow-cyan-600/30 transition"
              >
                儲存記憶卡片
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 深度分析提煉 Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">AI 智慧分析小說關鍵伏筆與設定</h3>
                  <p className="text-xs text-slate-400">AI 正在深度檢索你的主線大綱、世界觀與人物身世，提煉高價值伏筆卡片</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 分析提示詞指引 */}
            <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <input
                type="text"
                value={aiHint}
                onChange={(e) => setAiHint(e.target.value)}
                placeholder="選填指引（例如：多發想反派勢力的陰謀線索、上古神器...）"
                className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
              />
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={handleAnalyzeAi}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium text-xs transition flex items-center gap-1 shrink-0"
              >
                {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isAnalyzing ? '分析中...' : '重新分析'}</span>
              </button>
            </div>

            {/* AI 提煉結果清單 */}
            <div className="space-y-3">
              {isAnalyzing ? (
                <div className="py-12 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">AI 正在推演劇情伏筆與世界法則，請稍候...</p>
                </div>
              ) : aiSuggestions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  暫無建議條目，請點擊「重新分析」。
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span>為您提煉出 {aiSuggestions.length} 條推薦卡片：</span>
                    <button
                      type="button"
                      onClick={handleAddAllAiSuggestions}
                      className="text-xs text-purple-400 hover:text-purple-300 font-medium transition"
                    >
                      一鍵全部加入記憶庫
                    </button>
                  </div>

                  <div className="space-y-3">
                    {aiSuggestions.map(item => {
                      const isAdded = addedAiIds.has(item.id);

                      return (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 hover:border-purple-500/30 transition"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getCategoryColor(item.category)}`}>
                                {item.category}
                              </span>
                              <span className="font-bold text-sm text-slate-200">
                                {item.title}
                              </span>
                            </div>

                            <button
                              type="button"
                              disabled={isAdded}
                              onClick={() => handleAddAiSuggestion(item)}
                              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition ${
                                isAdded
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow'
                              }`}
                            >
                              {isAdded ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>已加入</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>加入記憶庫</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* 關鍵字 */}
                          {item.keywords && item.keywords.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-slate-500">觸發詞:</span>
                              {item.keywords.map((kw, i) => (
                                <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 text-cyan-300/80 border border-slate-800">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}

                          <p className="text-xs text-slate-300 leading-relaxed">
                            {item.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
