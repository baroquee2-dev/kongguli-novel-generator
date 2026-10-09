import React, { useState, useEffect, useRef } from 'react';
import type { Novel, NovelListItem, GameProject, GameListItem, AISettings, SystemMode } from './types';
import { api } from './api/client';
import { Navbar } from './components/Navbar';
import { SettingsModal } from './components/SettingsModal';
import { StoryOverviewTab } from './components/StoryOverviewTab';
import { LocationsTab } from './components/LocationsTab';
import { CharactersTab } from './components/CharactersTab';
import { ChaptersTab } from './components/ChaptersTab';
import { GameLevelTab } from './components/GameLevelTab';
import { LorebookTab } from './components/LorebookTab';
import { FrontstageView } from './components/FrontstageView';
import { 
  BookMarked, MapPin, Users, BookOpenCheck, Loader2, CheckCircle, Brain, Gamepad2
} from 'lucide-react';

export const App: React.FC = () => {
  // 頂層系統模式切換：小說版 vs 遊戲版 (底層架構完全獨立)
  const [systemMode, setSystemMode] = useState<SystemMode>(() => {
    try {
      return (localStorage.getItem('kongguli_system_mode') as SystemMode) || 'novel';
    } catch {
      return 'novel';
    }
  });

  const handleSwitchSystemMode = (mode: SystemMode) => {
    setSystemMode(mode);
    try {
      localStorage.setItem('kongguli_system_mode', mode);
    } catch {}
  };

  // ==================== 1. 小說版專屬狀態 ====================
  const [novels, setNovels] = useState<NovelListItem[]>([]);
  const [currentNovelId, setCurrentNovelId] = useState<string>(() => {
    try {
      return localStorage.getItem('kongguli_current_novel_id') || '';
    } catch {
      return '';
    }
  });
  const [currentNovel, setCurrentNovel] = useState<Novel | null>(null);
  const [activeNovelTab, setActiveNovelTab] = useState<'overview' | 'locations' | 'characters' | 'chapters' | 'lorebook'>('overview');
  const [savingNovel, setSavingNovel] = useState(false);
  const [lastSavedNovelTime, setLastSavedNovelTime] = useState<string>('');
  const novelSaveTimeoutRef = useRef<any>(null);

  // ==================== 2. 獨立遊戲版專屬狀態 ====================
  const [games, setGames] = useState<GameListItem[]>([]);
  const [currentGameId, setCurrentGameId] = useState<string>(() => {
    try {
      return localStorage.getItem('kongguli_current_game_id') || '';
    } catch {
      return '';
    }
  });
  const [currentGame, setCurrentGame] = useState<GameProject | null>(null);
  const [activeGameTab, setActiveGameTab] = useState<'overview' | 'locations' | 'characters' | 'chapters' | 'lorebook'>('overview');
  const [savingGame, setSavingGame] = useState(false);
  const [lastSavedGameTime, setLastSavedGameTime] = useState<string>('');
  const gameSaveTimeoutRef = useRef<any>(null);

  // 前台讀者展示模式 vs 後台創作模式切換 (小說版專屬)
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

  // 全域 AI 設定
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

  // 初始化載入：同時並行載入設定、小說列表、遊戲列表
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [settingsData, novelsList, gamesList] = await Promise.all([
          api.getSettings(),
          api.listNovels(),
          api.listGames(),
        ]);
        setSettings(settingsData);
        setNovels(novelsList);
        setGames(gamesList);

        // 恢復或載入預設小說
        if (novelsList.length > 0) {
          const targetNovelId = novelsList.find(n => n.id === currentNovelId)?.id || novelsList[0].id;
          setCurrentNovelId(targetNovelId);
          try {
            localStorage.setItem('kongguli_current_novel_id', targetNovelId);
          } catch {}
          const fullNovel = await api.getNovel(targetNovelId);
          setCurrentNovel(fullNovel);
        }

        // 恢復或載入預設遊戲專案
        if (gamesList.length > 0) {
          const targetGameId = gamesList.find(g => g.id === currentGameId)?.id || gamesList[0].id;
          setCurrentGameId(targetGameId);
          try {
            localStorage.setItem('kongguli_current_game_id', targetGameId);
          } catch {}
          const fullGame = await api.getGame(targetGameId);
          setCurrentGame(fullGame);
        }
      } catch (err) {
        console.error('初始化系統失敗:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // ==================== 小說操作處理 ====================
  const handleSelectNovel = async (id: string) => {
    if (id === currentNovelId) return;
    setLoading(true);
    try {
      setCurrentNovelId(id);
      try {
        localStorage.setItem('kongguli_current_novel_id', id);
      } catch {}
      const fullNovel = await api.getNovel(id);
      setCurrentNovel(fullNovel);
      setActiveNovelTab('overview');
    } catch (err) {
      console.error('切換小說失敗:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInitSampleNovel = async () => {
    try {
      const sample = await api.initSample();
      const list = await api.listNovels();
      setNovels(list);
      setCurrentNovelId(sample.id);
      setCurrentNovel(sample);
      setActiveNovelTab('overview');
      try {
        localStorage.setItem('kongguli_current_novel_id', sample.id);
      } catch {}
    } catch (err: any) {
      alert(err.message || '載入範例作品失敗');
    }
  };

  const handleDeleteNovel = async (id: string) => {
    try {
      await api.deleteNovel(id);
      const list = await api.listNovels();
      setNovels(list);
      if (list.length > 0) {
        handleSelectNovel(list[0].id);
      } else {
        handleInitSampleNovel();
      }
    } catch (err: any) {
      alert(err.message || '刪除小說失敗');
    }
  };

  const handleNovelChange = (updated: Novel) => {
    setCurrentNovel(updated);
    if (novelSaveTimeoutRef.current) clearTimeout(novelSaveTimeoutRef.current);
    novelSaveTimeoutRef.current = setTimeout(async () => {
      setSavingNovel(true);
      try {
        await api.saveNovel(updated);
        setLastSavedNovelTime(new Date().toLocaleTimeString());
        setNovels(prev => prev.map(n => n.id === updated.id ? {
          ...n,
          title: updated.title,
          genre: updated.genre,
          tone: updated.tone,
          cover_url: updated.cover_url,
          locations_count: updated.locations.length,
          characters_count: updated.characters.length,
          chapters_count: updated.chapters.length,
        } : n));
      } catch (err) {
        console.error('儲存小說失敗:', err);
      } finally {
        setSavingNovel(false);
      }
    }, 800);
  };

  // ==================== 獨立遊戲版操作處理 ====================
  const handleSelectGame = async (id: string) => {
    if (id === currentGameId) return;
    setLoading(true);
    try {
      setCurrentGameId(id);
      try {
        localStorage.setItem('kongguli_current_game_id', id);
      } catch {}
      const fullGame = await api.getGame(id);
      setCurrentGame(fullGame);
      setActiveGameTab('overview');
    } catch (err) {
      console.error('切換遊戲專案失敗:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInitSampleGame = async () => {
    try {
      const sample = await api.initSampleGame();
      const list = await api.listGames();
      setGames(list);
      setCurrentGameId(sample.id);
      setCurrentGame(sample);
      setActiveGameTab('overview');
      try {
        localStorage.setItem('kongguli_current_game_id', sample.id);
      } catch {}
    } catch (err: any) {
      alert(err.message || '載入示範遊戲失敗');
    }
  };

  const handleDeleteGame = async (id: string) => {
    try {
      await api.deleteGame(id);
      const list = await api.listGames();
      setGames(list);
      if (list.length > 0) {
        handleSelectGame(list[0].id);
      } else {
        handleInitSampleGame();
      }
    } catch (err: any) {
      alert(err.message || '刪除遊戲專案失敗');
    }
  };

  const handleGameChange = (updated: Novel) => {
    const updatedGame = updated as GameProject;
    setCurrentGame(updatedGame);
    if (gameSaveTimeoutRef.current) clearTimeout(gameSaveTimeoutRef.current);
    gameSaveTimeoutRef.current = setTimeout(async () => {
      setSavingGame(true);
      try {
        await api.saveGame(updatedGame);
        setLastSavedGameTime(new Date().toLocaleTimeString());
        setGames(prev => prev.map(g => g.id === updatedGame.id ? {
          ...g,
          title: updatedGame.title,
          genre: updatedGame.genre,
          tone: updatedGame.tone,
          cover_url: updatedGame.cover_url,
          locations_count: updatedGame.locations.length,
          characters_count: updatedGame.characters.length,
          chapters_count: updatedGame.chapters.length,
        } : g));
      } catch (err) {
        console.error('儲存遊戲專案失敗:', err);
      } finally {
        setSavingGame(false);
      }
    }, 800);
  };

  // ==================== 建立新專案 Modal ====================
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalType, setCreateModalType] = useState<SystemMode>('novel');
  const [newTitle, setNewTitle] = useState('');
  const [newGenre, setNewGenre] = useState('');
  const [newTone, setNewTone] = useState('');
  const [creating, setCreating] = useState(false);

  const handleOpenCreateModal = (type: SystemMode) => {
    setCreateModalType(type);
    if (type === 'game') {
      setNewTitle(`我的新遊戲專案 ${games.length + 1}`);
      setNewGenre('文字冒險RPG');
      setNewTone('沉浸互動');
    } else {
      setNewTitle(`我的新小說 ${novels.length + 1}`);
      setNewGenre('奇幻冒險');
      setNewTone('熱血激昂');
    }
    setIsCreateModalOpen(true);
  };

  const handleConfirmCreateProject = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTitle.trim()) {
      alert(createModalType === 'game' ? '請填寫遊戲名稱' : '請填寫小說名稱');
      return;
    }

    setCreating(true);
    const isGame = createModalType === 'game';
    const newId = `${isGame ? 'game' : 'novel'}-${Date.now().toString(36)}`;

    try {
      if (isGame) {
        const created = await api.createGame({
          id: newId,
          title: newTitle.trim(),
          genre: newGenre.trim() || '文字冒險RPG',
          tone: newTone.trim() || '沉浸互動',
          main_plot: '',
          world_background: '',
          locations: [],
          characters: [],
          chapters: [{
            id: `chap-${Date.now().toString(36)}`,
            chapter_number: 1,
            title: '第 1 關/章：序章冒險啟程',
            outline: '',
            selected_location_ids: [],
            selected_sub_location_ids: [],
            selected_character_ids: [],
            content: '',
            word_count: 0
          }]
        });
        const list = await api.listGames();
        setGames(list);
        setCurrentGameId(created.id);
        setCurrentGame(created);
        setActiveGameTab('overview');
        try {
          localStorage.setItem('kongguli_current_game_id', created.id);
        } catch {}
      } else {
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
        setActiveNovelTab('overview');
        try {
          localStorage.setItem('kongguli_current_novel_id', created.id);
        } catch {}
      }
      setIsCreateModalOpen(false);
    } catch (err: any) {
      alert(err.message || '建立專案失敗，請檢查後端是否正常運作');
    } finally {
      setCreating(false);
    }
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

  const isGameMode = systemMode === 'game';
  const activeCurrentProject = isGameMode ? currentGame : currentNovel;

  if (loading && !activeCurrentProject) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <p className="text-sm font-medium">正在啟動孔固力創作空間...</p>
      </div>
    );
  }

  // 獨立前台讀者展示模式 (小說版專屬)
  if (viewMode === 'frontstage' && !isGameMode) {
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
        systemMode={systemMode}
        onSwitchSystemMode={handleSwitchSystemMode}
        novels={novels}
        currentNovelId={currentNovelId}
        onSelectNovel={handleSelectNovel}
        onCreateNovel={() => handleOpenCreateModal('novel')}
        onInitSample={handleInitSampleNovel}
        onDeleteNovel={handleDeleteNovel}
        games={games}
        currentGameId={currentGameId}
        onSelectGame={handleSelectGame}
        onCreateGame={() => handleOpenCreateModal('game')}
        onInitSampleGame={handleInitSampleGame}
        onDeleteGame={handleDeleteGame}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSwitchToFrontstage={() => handleToggleViewMode('frontstage')}
        settings={settings}
      />

      {/* 五層結構導覽標籤列 */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-6 py-2 sticky top-16 z-30 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <nav className="flex items-center gap-1 sm:gap-2">
            {[
              { 
                id: 'overview', 
                label: isGameMode ? '第 1 層：遊戲主體' : '第 1 層：小說主體', 
                icon: BookMarked, 
                color: isGameMode ? 'text-teal-400' : 'text-purple-400' 
              },
              { 
                id: 'locations', 
                label: isGameMode ? '第 2 層：世界場景' : '第 2 層：世界地點', 
                icon: MapPin, 
                color: 'text-emerald-400' 
              },
              { 
                id: 'characters', 
                label: isGameMode ? '第 3 層：NPC角色' : '第 3 層：角色陣容', 
                icon: Users, 
                color: 'text-blue-400' 
              },
              { 
                id: 'lorebook', 
                label: `第 4 層：記憶伏筆庫${activeCurrentProject?.lore_items && activeCurrentProject.lore_items.length > 0 ? ` (${activeCurrentProject.lore_items.length})` : ''}`, 
                icon: Brain, 
                color: 'text-cyan-400' 
              },
              { 
                id: 'chapters', 
                label: isGameMode ? '第 5 層：關卡創作' : '第 5 層：章節創作', 
                icon: BookOpenCheck, 
                color: isGameMode ? 'text-teal-400' : 'text-pink-400' 
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = isGameMode 
                ? activeGameTab === tab.id 
                : activeNovelTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (isGameMode) {
                      setActiveGameTab(tab.id as any);
                    } else {
                      setActiveNovelTab(tab.id as any);
                    }
                  }}
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
            {(isGameMode ? savingGame : savingNovel) ? (
              <span className="flex items-center gap-1 text-amber-400">
                <Loader2 className="w-3 h-3 animate-spin" /> 儲存中...
              </span>
            ) : (isGameMode ? lastSavedGameTime : lastSavedNovelTime) ? (
              <span className="flex items-center gap-1 text-emerald-400/80">
                <CheckCircle className="w-3 h-3" /> 已存於 {isGameMode ? lastSavedGameTime : lastSavedNovelTime}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* 主工作區 (小說版 vs 遊戲版完全對應與隔離) */}
      <main className="flex-1 p-6">
        {isGameMode ? (
          currentGame ? (
            <>
              {activeGameTab === 'overview' && (
                <StoryOverviewTab novel={currentGame} onChange={handleGameChange} isGame={true} />
              )}
              {activeGameTab === 'locations' && (
                <LocationsTab novel={currentGame} onChange={handleGameChange} />
              )}
              {activeGameTab === 'characters' && (
                <CharactersTab novel={currentGame} onChange={handleGameChange} />
              )}
              {activeGameTab === 'lorebook' && (
                <LorebookTab novel={currentGame} onChange={handleGameChange} />
              )}
              {activeGameTab === 'chapters' && (
                <GameLevelTab 
                  game={currentGame} 
                  onChange={handleGameChange} 
                />
              )}
            </>
          ) : (
            <div className="text-center py-20 text-slate-500">
              請選擇或建立一部遊戲專案開始創作。
            </div>
          )
        ) : (
          currentNovel ? (
            <>
              {activeNovelTab === 'overview' && (
                <StoryOverviewTab novel={currentNovel} onChange={handleNovelChange} isGame={false} />
              )}
              {activeNovelTab === 'locations' && (
                <LocationsTab novel={currentNovel} onChange={handleNovelChange} />
              )}
              {activeNovelTab === 'characters' && (
                <CharactersTab novel={currentNovel} onChange={handleNovelChange} />
              )}
              {activeNovelTab === 'lorebook' && (
                <LorebookTab novel={currentNovel} onChange={handleNovelChange} />
              )}
              {activeNovelTab === 'chapters' && (
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
          )
        )}
      </main>

      {/* 建立新專案 Modal (支援建立新小說或新遊戲專案) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleConfirmCreateProject}
            className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                {createModalType === 'game' ? (
                  <>
                    <Gamepad2 className="w-5 h-5 text-emerald-400" />
                    建立全新遊戲專案
                  </>
                ) : (
                  <>
                    <BookMarked className="w-5 h-5 text-purple-400" />
                    建立全新小說專案
                  </>
                )}
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
                  {createModalType === 'game' ? '遊戲名稱 *' : '小說書名 *'}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={createModalType === 'game' ? "例如：時空迴廊、命運之鑰、深淵探索者..." : "例如：星穹之約、深淵巡航錄..."}
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
                    placeholder={createModalType === 'game' ? "例如：文字冒險RPG、視覺小說" : "例如：奇幻冒險、懸疑科幻"}
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
                    placeholder={createModalType === 'game' ? "例如：沉浸探索、因果抉擇" : "例如：熱血激昂、暗黑冷酷"}
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
                className={`flex items-center gap-1.5 px-5 py-2 text-xs font-medium text-white rounded-xl shadow-lg transition disabled:opacity-50 ${
                  createModalType === 'game'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                    : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20'
                }`}
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
