import React, { useState, useEffect, useRef } from 'react';
import type { Novel, NovelListItem, AISettings } from './types';
import { api } from './api/client';
import { Navbar } from './components/Navbar';
import { SettingsModal } from './components/SettingsModal';
import { StoryOverviewTab } from './components/StoryOverviewTab';
import { LocationsTab } from './components/LocationsTab';
import { CharactersTab } from './components/CharactersTab';
import { ChaptersTab } from './components/ChaptersTab';
import { LorebookTab } from './components/LorebookTab';
import { FrontstageView } from './components/FrontstageView';
import { 
  BookMarked, MapPin, Users, BookOpenCheck, Loader2, CheckCircle, Brain
} from 'lucide-react';

export const App: React.FC = () => {
  const [novels, setNovels] = useState<NovelListItem[]>([]);
  const [currentNovelId, setCurrentNovelId] = useState<string>('');
  const [currentNovel, setCurrentNovel] = useState<Novel | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'locations' | 'characters' | 'chapters' | 'lorebook'>('overview');

  // 前台讀者展示模式 vs 後台五層創作模式切換
  const [viewMode, setViewMode] = useState<'studio' | 'frontstage'>(() => {
    try {
      return (localStorage.getItem('novel_app_view_mode') as 'studio' | 'frontstage') || 'studio';
    } catch {
      return 'studio';
    }
  });

  const handleToggleViewMode = (mode: 'studio' | 'frontstage') => {
    setViewMode(mode);
    try {
      localStorage.setItem('novel_app_view_mode', mode);
    } catch {}
  };

  const [settings, setSettings] = useState<AISettings>({
    provider: 'openai',
    api_key: '',
    base_url: '',
    model: 'gpt-4o',
    temperature: 0.75,
    max_tokens: 4000
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  const saveTimeoutRef = useRef<any>(null);

  // 初始化載入
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [settingsData, novelsList] = await Promise.all([
          api.getSettings(),
          api.listNovels()
        ]);
        setSettings(settingsData);
        setNovels(novelsList);

        if (novelsList.length > 0) {
          const firstId = novelsList[0].id;
          setCurrentNovelId(firstId);
          const fullNovel = await api.getNovel(firstId);
          setCurrentNovel(fullNovel);
        }
      } catch (err) {
        console.error('初始化失敗:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // 切換小說
  const handleSelectNovel = async (id: string) => {
    if (id === currentNovelId) return;
    setLoading(true);
    try {
      setCurrentNovelId(id);
      const fullNovel = await api.getNovel(id);
      setCurrentNovel(fullNovel);
      setActiveTab('overview');
    } catch (err) {
      console.error('切換小說失敗:', err);
    } finally {
      setLoading(false);
    }
  };

  // 建立新小說 Modal 狀態
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('我的全新小說');
  const [newGenre, setNewGenre] = useState('奇幻冒險');
  const [newTone, setNewTone] = useState('熱血激昂');
  const [creating, setCreating] = useState(false);

  // 打開建立新小說彈窗
  const handleOpenCreateModal = () => {
    setNewTitle(`我的新小說 ${novels.length + 1}`);
    setNewGenre('奇幻冒險');
    setNewTone('熱血激昂');
    setIsCreateModalOpen(true);
  };

  // 確認建立新小說
  const handleConfirmCreateNovel = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTitle.trim()) {
      alert('請填寫小說名稱');
      return;
    }

    setCreating(true);
    const newId = `novel-${Date.now().toString(36)}`;
    try {
      const created = await api.createNovel({
        id: newId,
        title: newTitle.trim(),
        genre: newGenre.trim() || '奇幻冒險',
        tone: newTone.trim() || '熱血激昂',
        main_plot: '',
        world_background: '',
        locations: [],
        characters: [],
        chapters: [{
          id: `chap-${Date.now().toString(36)}`,
          chapter_number: 1,
          title: '第一章：冒險的序幕',
          outline: '',
          selected_location_ids: [],
          selected_sub_location_ids: [],
          selected_character_ids: [],
          content: '',
          word_count: 0
        }]
      });
      const list = await api.listNovels();
      setNovels(list);
      setCurrentNovelId(created.id);
      setCurrentNovel(created);
      setActiveTab('overview');
      setIsCreateModalOpen(false);
    } catch (err: any) {
      alert(err.message || '建立小說失敗，請檢查後端是否正常運作');
    } finally {
      setCreating(false);
    }
  };

  // 載入示範作品
  const handleInitSample = async () => {
    try {
      const sample = await api.initSample();
      const list = await api.listNovels();
      setNovels(list);
      setCurrentNovelId(sample.id);
      setCurrentNovel(sample);
      setActiveTab('overview');
    } catch (err: any) {
      alert(err.message || '載入範例失敗');
    }
  };

  // 刪除小說
  const handleDeleteNovel = async (id: string) => {
    try {
      await api.deleteNovel(id);
      const list = await api.listNovels();
      setNovels(list);
      if (list.length > 0) {
        handleSelectNovel(list[0].id);
      } else {
        // 若無小說則建一個範例
        handleInitSample();
      }
    } catch (err: any) {
      alert(err.message || '刪除失敗');
    }
  };

  // 儲存小說資料 (附帶防抖)
  const handleNovelChange = (updated: Novel) => {
    setCurrentNovel(updated);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await api.saveNovel(updated);
        setLastSavedTime(new Date().toLocaleTimeString());
        // 同步更新小說列表計數
        setNovels(prev => prev.map(n => n.id === updated.id ? {
          ...n,
          title: updated.title,
          genre: updated.genre,
          tone: updated.tone,
          locations_count: updated.locations.length,
          characters_count: updated.characters.length,
          chapters_count: updated.chapters.length,
        } : n));
      } catch (err) {
        console.error('儲存失敗:', err);
      } finally {
        setSaving(false);
      }
    }, 800);
  };

  // 儲存 AI 設定
  const handleSaveSettings = async (newSettings: AISettings) => {
    try {
      const saved = await api.saveSettings(newSettings);
      setSettings(saved);
    } catch (err: any) {
      alert(err.message || '保存設定失敗');
    }
  };

  if (loading && !currentNovel) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <p className="text-sm font-medium">正在啟動小說創作空間...</p>
      </div>
    );
  }

  // 獨立前台讀者展示模式 (純粹故事本體與章節目錄，排除劇本、角色卡等後台雜訊)
  if (viewMode === 'frontstage') {
    return (
      <FrontstageView
        novels={novels}
        currentNovel={currentNovel}
        onSelectNovel={handleSelectNovel}
        onBackToStudio={() => handleToggleViewMode('studio')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 頂部導覽列 */}
      <Navbar
        novels={novels}
        currentNovelId={currentNovelId}
        onSelectNovel={handleSelectNovel}
        onCreateNovel={handleOpenCreateModal}
        onInitSample={handleInitSample}
        onDeleteNovel={handleDeleteNovel}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSwitchToFrontstage={() => handleToggleViewMode('frontstage')}
        settings={settings}
      />

      {/* 五層結構導覽標籤列 */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-6 py-2 sticky top-16 z-30 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <nav className="flex items-center gap-1 sm:gap-2">
            {[
              { id: 'overview', label: '第 1 層：小說主體', icon: BookMarked, color: 'text-purple-400' },
              { id: 'locations', label: '第 2 層：世界地點', icon: MapPin, color: 'text-emerald-400' },
              { id: 'characters', label: '第 3 層：角色陣容', icon: Users, color: 'text-blue-400' },
              { 
                id: 'lorebook', 
                label: `第 4 層：記憶伏筆庫${currentNovel?.lore_items && currentNovel.lore_items.length > 0 ? ` (${currentNovel.lore_items.length})` : ''}`, 
                icon: Brain, 
                color: 'text-cyan-400' 
              },
              { id: 'chapters', label: '第 5 層：章節創作', icon: BookOpenCheck, color: 'text-pink-400' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${tab.color}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* 自動存檔狀態指示 */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            {saving ? (
              <span className="flex items-center gap-1 text-amber-400">
                <Loader2 className="w-3 h-3 animate-spin" /> 儲存中...
              </span>
            ) : lastSavedTime ? (
              <span className="flex items-center gap-1 text-emerald-400/80">
                <CheckCircle className="w-3 h-3" /> 已存於 {lastSavedTime}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* 主工作區 */}
      <main className="flex-1 p-6">
        {currentNovel ? (
          <>
            {activeTab === 'overview' && (
              <StoryOverviewTab novel={currentNovel} onChange={handleNovelChange} />
            )}
            {activeTab === 'locations' && (
              <LocationsTab novel={currentNovel} onChange={handleNovelChange} />
            )}
            {activeTab === 'characters' && (
              <CharactersTab novel={currentNovel} onChange={handleNovelChange} />
            )}
            {activeTab === 'lorebook' && (
              <LorebookTab novel={currentNovel} onChange={handleNovelChange} />
            )}
            {activeTab === 'chapters' && (
              <ChaptersTab 
                novel={currentNovel} 
                onChange={handleNovelChange} 
                settings={settings}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            )}
          </>
        ) : (
          <div className="text-center py-20 text-slate-500">
            請選擇或建立一部小說開始創作。
          </div>
        )}
      </main>

      {/* 建立新小說 Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleConfirmCreateNovel}
            className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <BookMarked className="w-5 h-5 text-purple-400" />
                建立全新小說專案
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  小說書名 *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="例如：星穹之約、深淵巡航錄..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    題材類型
                  </label>
                  <input
                    type="text"
                    value={newGenre}
                    onChange={(e) => setNewGenre(e.target.value)}
                    placeholder="例如：奇幻冒險、懸疑科幻"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    風格基調
                  </label>
                  <input
                    type="text"
                    value={newTone}
                    onChange={(e) => setNewTone(e.target.value)}
                    placeholder="例如：熱血激昂、暗黑冷酷"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:bg-slate-800 rounded-xl transition"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg shadow-purple-600/20 transition disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{creating ? '建立中...' : '確認建立'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* AI 設定彈窗 */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  );
};

export default App;
