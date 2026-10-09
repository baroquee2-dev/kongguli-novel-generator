import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { GameProject, GameListItem, GameChoiceOption, GameTurnHistoryItem } from '../types';
import { api } from '../api/client';
import { 
  Gamepad2, ArrowLeft, RotateCcw, Send, Sparkles, ShieldAlert, 
  BookOpen, Users, MapPin, Brain, Search, Clock, Compass, Layers, 
  CheckCircle2, ChevronRight, Loader2, AlertCircle, Settings, Download,
  Save, Play, HeartPulse, Activity, Copy, Check, X
} from 'lucide-react';

interface Props {
  games: GameListItem[];
  currentGame: GameProject | null;
  onSelectGame: (id: string) => Promise<void> | void;
  onBackToStudio: () => void;
  onOpenSettings: () => void;
}

interface AdventureTurn {
  round: number;
  storySegment: string;
  playerAction?: string;
  actionType?: 'preset' | 'custom';
  statusSummary?: string;
  playerStats?: string;
  statsChanges?: string;
}

interface GameAdventureSession {
  gameId: string;
  turns: AdventureTurn[];
  currentChoices: GameChoiceOption[];
  playerStats?: string;
  updatedAt: string;
  roundCount: number;
}

const STORAGE_PREFIX = 'kongguli_game_session_';
const ACTIVE_GAME_KEY = 'kongguli_game_active_id';
const VIEW_MODE_KEY = 'kongguli_game_view_mode';

// 讀取指定遊戲的持久化遊玩進度
const loadSavedSession = (gameId: string): GameAdventureSession | null => {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${gameId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.turns) && parsed.turns.length > 0) {
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse saved session:', e);
  }
  return null;
};

// 儲存指定遊戲的遊玩進度
const saveAdventureSession = (
  gameId: string, 
  turns: AdventureTurn[], 
  currentChoices: GameChoiceOption[],
  playerStats?: string
) => {
  try {
    const session: GameAdventureSession = {
      gameId,
      turns,
      currentChoices,
      playerStats,
      updatedAt: new Date().toLocaleTimeString(),
      roundCount: turns.length
    };
    localStorage.setItem(`${STORAGE_PREFIX}${gameId}`, JSON.stringify(session));
  } catch (e) {
    console.error('Failed to save session:', e);
  }
};

// 清除指定遊戲的存檔進度
const removeSavedSession = (gameId: string) => {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${gameId}`);
  } catch {}
};

export const GameFrontstageView: React.FC<Props> = ({
  games,
  currentGame,
  onSelectGame,
  onBackToStudio,
  onOpenSettings,
}) => {
  // 檢視模式預設：讀取上次儲存的 viewMode 與 activeGameId (若之前在遊玩中則保持在遊玩中)
  const [viewMode, setViewMode] = useState<'lobby' | 'play'>(() => {
    try {
      const savedMode = localStorage.getItem(VIEW_MODE_KEY);
      const activeId = localStorage.getItem(ACTIVE_GAME_KEY);
      if (savedMode === 'play' && activeId) {
        return 'play';
      }
    } catch {}
    return 'lobby';
  });

  // 當前遊玩中專案 ID
  const [activeGameId, setActiveGameId] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_GAME_KEY) || currentGame?.id || '';
    } catch {
      return currentGame?.id || '';
    }
  });

  // 當前遊玩的完整遊戲資料
  const [playingGame, setPlayingGame] = useState<GameProject | null>(currentGame);
  const [loadingGame, setLoadingGame] = useState(false);

  // 冒險狀態歷程
  const [turns, setTurns] = useState<AdventureTurn[]>([]);
  const [currentChoices, setCurrentChoices] = useState<GameChoiceOption[]>([]);
  const [currentPlayerStats, setCurrentPlayerStats] = useState<string>('');
  const [customInputText, setCustomInputText] = useState('');
  const [isAdvancingTurn, setIsAdvancingTurn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedAction, setFailedAction] = useState<{ text: string; type: 'preset' | 'custom' } | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  // 右側固定角色狀態欄開關 (當啟用數值狀態時預設開啟固定於右側)
  const [showStatsBar, setShowStatsBar] = useState(true);
  const [copiedStats, setCopiedStats] = useState(false);

  // 側邊世界觀手冊開關
  const [showManualDrawer, setShowManualDrawer] = useState(false);

  // 大廳搜尋
  const [lobbySearch, setLobbySearch] = useState('');

  // 遊戲進行中背景循環圖集：包含封面圖及所有已設定頭像的角色圖
  const backgroundSlides = useMemo(() => {
    if (!playingGame) return [];
    const list: { url: string; label: string; type: 'cover' | 'character' }[] = [];

    // 1. 遊戲封面圖
    if (playingGame.cover_url && playingGame.cover_url.trim()) {
      list.push({
        url: playingGame.cover_url.trim(),
        label: `封面 · ${playingGame.title}`,
        type: 'cover',
      });
    }

    // 2. 所有登場角色圖
    if (Array.isArray(playingGame.characters)) {
      playingGame.characters.forEach((char) => {
        if (char.avatar_url && char.avatar_url.trim()) {
          // 避免與封面完全相同 URL 重複
          if (!list.some(item => item.url === char.avatar_url!.trim())) {
            list.push({
              url: char.avatar_url.trim(),
              label: `角色 · ${char.name}${char.role ? ` (${char.role})` : ''}`,
              type: 'character',
            });
          }
        }
      });
    }

    return list;
  }, [playingGame]);

  const [currentBgIndex, setCurrentBgIndex] = useState(0);

  // 定時平滑循環切換背景圖 (每 8 秒自動輪播)
  useEffect(() => {
    if (backgroundSlides.length <= 1) {
      setCurrentBgIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentBgIndex((prev) => (prev + 1) % backgroundSlides.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [backgroundSlides.length]);

  // 滾動參照
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // 當發生錯誤時滾動至錯誤提示，否則平滑滾動至最新情節
  useEffect(() => {
    if (viewMode === 'play') {
      if (errorMessage && errorRef.current) {
        errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [turns, isAdvancingTurn, errorMessage, viewMode]);

  // 元件掛載時，若預設為 'play' 模式，自動還原進度與資料
  useEffect(() => {
    const restoreSavedProgress = async () => {
      const targetId = activeGameId || currentGame?.id;
      if (!targetId) return;

      const saved = loadSavedSession(targetId);
      if (saved && saved.turns.length > 0) {
        setTurns(saved.turns);
        setCurrentChoices(saved.currentChoices);
        if (saved.playerStats) {
          setCurrentPlayerStats(saved.playerStats);
        }
        setLastSavedTime(saved.updatedAt);

        // 確保載入完整的遊戲資料
        if (!playingGame || playingGame.id !== targetId) {
          try {
            const g = await api.getGame(targetId);
            setPlayingGame(g);
            if (!saved.playerStats && g.game_rules?.initial_player_stats) {
              setCurrentPlayerStats(g.game_rules.initial_player_stats);
            }
          } catch (e) {
            console.error('Failed to load active game on restore:', e);
          }
        }
      } else if (targetId) {
        // 若無現成存檔但處於 play 模式，初始化該專案
        handleResumeOrStartGame(targetId, false);
      }
    };

    if (viewMode === 'play') {
      restoreSavedProgress();
    }
  }, []);

  // 當 turns 或 choices 或 stats 變化時，自動持久化至 localStorage
  useEffect(() => {
    if (playingGame && turns.length > 0 && viewMode === 'play') {
      saveAdventureSession(playingGame.id, turns, currentChoices, currentPlayerStats);
      const timeStr = new Date().toLocaleTimeString();
      setLastSavedTime(timeStr);
      try {
        localStorage.setItem(ACTIVE_GAME_KEY, playingGame.id);
        localStorage.setItem(VIEW_MODE_KEY, 'play');
      } catch {}
    }
  }, [turns, currentChoices, currentPlayerStats, playingGame, viewMode]);

  // 切換回大廳
  const handleSwitchToLobby = () => {
    setViewMode('lobby');
    try {
      localStorage.setItem(VIEW_MODE_KEY, 'lobby');
    } catch {}
  };

  // 進入/繼續/重啟遊戲冒險
  const handleResumeOrStartGame = async (gameId: string, forceRestart: boolean = false) => {
    setLoadingGame(true);
    setErrorMessage(null);
    try {
      let gameData: GameProject;
      if (currentGame && currentGame.id === gameId) {
        gameData = currentGame;
      } else {
        gameData = await api.getGame(gameId);
        await onSelectGame(gameId);
      }
      setPlayingGame(gameData);
      setActiveGameId(gameId);
      try {
        localStorage.setItem(ACTIVE_GAME_KEY, gameId);
        localStorage.setItem(VIEW_MODE_KEY, 'play');
      } catch {}

      // 若非強制重開，先檢查是否有存檔
      const existingSession = !forceRestart ? loadSavedSession(gameId) : null;
      if (existingSession && existingSession.turns.length > 0) {
        // 恢復已有的冒險紀錄
        setTurns(existingSession.turns);
        setCurrentChoices(existingSession.currentChoices);
        const restoredStats = existingSession.playerStats || gameData.game_rules?.initial_player_stats || '';
        setCurrentPlayerStats(restoredStats);
        setLastSavedTime(existingSession.updatedAt);
        setCustomInputText('');
        setViewMode('play');
        return;
      }

      // 否則初始化新一輪冒險 (第 1 回合)
      const initialStory = gameData.chapters && gameData.chapters.length > 0 
        ? gameData.chapters[0] 
        : null;

      const startingPlot = initialStory?.starting_plot || initialStory?.content || '命運的帷幕緩緩拉開，新的冒險即將啟程...';
      const rawChoices = (gameData.game_rules?.dialog_choices || []).filter(c => c > 0);
      const maxChoicesLimit = rawChoices.length > 0 
        ? (rawChoices.length === 1 ? rawChoices[0] : Math.max(...rawChoices)) 
        : 3;
      const rawOptions: GameChoiceOption[] = (initialStory?.starting_options && initialStory.starting_options.length > 0)
        ? initialStory.starting_options
        : [
            { id: 'opt-init-1', text: '主動挺身而出，探查周遭動靜', hint: '主動出擊' },
            { id: 'opt-init-2', text: '保持警惕在暗處觀察局勢', hint: '審慎穩妥' },
            { id: 'opt-init-3', text: '嘗試尋找同伴或搜集情報', hint: '情報與社交' }
          ];
      const startingOptions: GameChoiceOption[] = rawOptions.slice(0, maxChoicesLimit);

      const initialStats = gameData.game_rules?.enable_player_stats
        ? (gameData.game_rules?.initial_player_stats || '生命值: 100/100, 精神值: 100/100, 狀態: [正常]')
        : '';
      setCurrentPlayerStats(initialStats);

      const initialTurns: AdventureTurn[] = [
        {
          round: 1,
          storySegment: startingPlot,
          playerStats: initialStats || undefined
        }
      ];

      setTurns(initialTurns);
      setCurrentChoices(startingOptions);
      setCustomInputText('');
      saveAdventureSession(gameId, initialTurns, startingOptions, initialStats);
      setLastSavedTime(new Date().toLocaleTimeString());
      setViewMode('play');
    } catch (err: any) {
      console.error('進入遊戲失敗:', err);
      alert(err.message || '進入遊戲失敗，請檢查網路或後端連線');
    } finally {
      setLoadingGame(false);
    }
  };

  // 重新開始本專案冒險 (清除該專案存檔並重置)
  const handleRestartAdventure = () => {
    if (!playingGame) return;
    if (window.confirm('確定要重新開始當前冒險嗎？現有遊玩紀錄將會重置回第 1 回合啟始劇情。')) {
      removeSavedSession(playingGame.id);
      handleResumeOrStartGame(playingGame.id, true);
    }
  };

  // 匯出冒險遊玩紀錄為 Markdown 檔
  const handleExportAdventureTranscript = () => {
    if (!playingGame || turns.length === 0) return;
    const lines: string[] = [];
    lines.push(`# 《${playingGame.title}》互動冒險遊玩紀錄\n`);
    lines.push(`- **遊戲類型**：${playingGame.genre} | **風格基調**：${playingGame.tone}`);
    lines.push(`- **規則模式**：${playingGame.game_rules?.strict_rule_enforcement ? '強硬遊戲規則（防暴走）' : '劇情自由發展'}`);
    if (playingGame.game_rules?.enable_player_stats) {
      lines.push(`- **玩家數值狀態**：已啟用`);
      lines.push(`- **當前固定記憶狀態**：\n\`\`\`\n${currentPlayerStats || '無數值'}\n\`\`\``);
    }
    lines.push(`- **總進行回合**：共 ${turns.length} 回合`);
    lines.push(`- **紀錄儲存時間**：${new Date().toLocaleString()}\n`);
    lines.push(`---\n`);

    turns.forEach((t) => {
      lines.push(`## 【第 ${t.round} 回合】`);
      if (t.statusSummary) {
        lines.push(`> 局勢摘要：${t.statusSummary}`);
      }
      if (t.statsChanges) {
        lines.push(`> ⚡ 數值變動：${t.statsChanges}`);
      }
      if (t.playerStats && playingGame.game_rules?.enable_player_stats) {
        lines.push(`> ❤️ 回合結算狀態：${t.playerStats.replace(/\n/g, ' | ')}`);
      }
      lines.push('');
      lines.push(`${t.storySegment}\n`);
      if (t.playerAction) {
        lines.push(`👉 **你的抉擇行動 (${t.actionType === 'custom' ? '自由輸入' : '預設選項'})**：${t.playerAction}\n`);
      }
      lines.push(`---\n`);
    });

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${playingGame.title}_冒險紀錄_第${turns.length}回合.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 推進遊戲回合核心邏輯
  const advanceTurn = async (actionText: string, actionType: 'preset' | 'custom') => {
    if (!playingGame || !actionText.trim() || isAdvancingTurn) return;

    // ★★★ 完整快照：記錄行動前之完整狀態，用於出錯或空白時精確回滾 ★★★
    const previousTurns = turns.map(t => ({ ...t }));
    const previousChoices = [...currentChoices];
    const previousPlayerStats = currentPlayerStats;
    const previousCustomInput = customInputText;

    setIsAdvancingTurn(true);
    setErrorMessage(null);
    setFailedAction(null);

    // 1. 登記玩家在當前回合的行動（樂觀更新供畫面即時呈現）
    const currentRound = turns.length;
    const optimisticTurns = turns.map(t => ({ ...t }));
    if (optimisticTurns.length > 0) {
      optimisticTurns[optimisticTurns.length - 1] = {
        ...optimisticTurns[optimisticTurns.length - 1],
        playerAction: actionText.trim(),
        actionType: actionType
      };
    }
    setTurns(optimisticTurns);

    // 2. 組裝歷史送交後端推演
    const historyPayload: GameTurnHistoryItem[] = optimisticTurns.map(t => ({
      round: t.round,
      story_segment: t.storySegment,
      player_action: t.playerAction || '',
      choice_type: t.actionType || 'preset'
    }));

    try {
      const isStatsEnabled = Boolean(playingGame.game_rules?.enable_player_stats);
      const response = await api.playGameTurn({
        game_id: playingGame.id,
        current_action: actionText.trim(),
        action_type: actionType,
        history: historyPayload,
        current_player_stats: (isStatsEnabled && currentPlayerStats) ? currentPlayerStats : undefined
      });

      // 檢查是否回傳有效劇情與選項（杜絕空白或無選項）
      if (!response || !response.story_continuation || !response.story_continuation.trim()) {
        throw new Error('AI 回傳的劇情內容為空白，無法推演新情節');
      }
      if (!response.choices || response.choices.length === 0) {
        throw new Error('AI 未能產生命運選項分支（選項清單為空）');
      }

      // 3. 處理更新後玩家數值狀態
      const nextStats = response.updated_player_stats || currentPlayerStats;
      if (isStatsEnabled && response.updated_player_stats) {
        setCurrentPlayerStats(response.updated_player_stats);
      }

      // 4. 追加新一輪的劇情敘述與更新選項
      const nextTurn: AdventureTurn = {
        round: response.round || currentRound + 1,
        storySegment: response.story_continuation.trim(),
        statusSummary: response.status_summary,
        playerStats: isStatsEnabled ? nextStats : undefined,
        statsChanges: response.stats_changes || undefined
      };

      const finalTurns = [...optimisticTurns, nextTurn];
      const nextChoices = response.choices || [];

      setTurns(finalTurns);
      setCurrentChoices(nextChoices);
      setCustomInputText('');
      setFailedAction(null);

      // 推進成功後才持久化儲存
      saveAdventureSession(playingGame.id, finalTurns, nextChoices, isStatsEnabled ? nextStats : undefined);
      setLastSavedTime(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error('推進劇情失敗:', err);
      const errorMsg = err.message || 'AI 推演劇情時發生錯誤或回應內容空白，請稍候重試或檢查 API Key 設定';

      // ★★★ 當 API 回傳錯誤或空白時，前台跳出提示，並回到錯誤前的選擇回合 ★★★
      setTurns(previousTurns);
      setCurrentChoices(previousChoices);
      setCurrentPlayerStats(previousPlayerStats);
      if (actionType === 'custom') {
        setCustomInputText(previousCustomInput || actionText);
      }
      setFailedAction({ text: actionText, type: actionType });
      setErrorMessage(errorMsg);
    } finally {
      setIsAdvancingTurn(false);
    }
  };

  // 玩家點選預設選項
  const handleSelectOption = (option: GameChoiceOption) => {
    advanceTurn(option.text, 'preset');
  };

  // 玩家自訂輸入行動
  const handleSubmitCustomInput = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customInputText.trim()) return;
    advanceTurn(customInputText.trim(), 'custom');
  };

  // 篩選大廳遊戲清單
  const filteredGames = games.filter(g => 
    g.title.toLowerCase().includes(lobbySearch.toLowerCase()) ||
    g.genre.toLowerCase().includes(lobbySearch.toLowerCase()) ||
    g.tone.toLowerCase().includes(lobbySearch.toLowerCase())
  );

  const allowCustom = playingGame?.game_rules?.allow_custom_input ?? true;
  const isStrict = playingGame?.game_rules?.strict_rule_enforcement ?? true;
  const isStatsEnabled = Boolean(playingGame?.game_rules?.enable_player_stats);
  const latestStatsChanges = turns.length > 0 ? turns[turns.length - 1]?.statsChanges : undefined;

  // ==================== 1. 遊戲大廳視圖 (Lobby) ====================
  if (viewMode === 'lobby') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        {/* 大廳頂部導航橫幅 */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30 font-bold">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base tracking-wide bg-gradient-to-r from-emerald-200 via-teal-200 to-cyan-200 bg-clip-text text-transparent">
                  遊戲前台大廳
                </h1>
                <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  GAME PORTAL
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                挑選已建立的遊戲專案，即刻進入互動分支與文字冒險
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/40 hover:bg-purple-900/40 border border-purple-500/30 text-xs font-medium text-purple-200 transition"
              title="AI 模型設定"
            >
              <Settings className="w-3.5 h-3.5 text-purple-400" />
              <span>AI 設定</span>
            </button>
            <button
              onClick={onBackToStudio}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-xs font-semibold text-slate-300 hover:text-white transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>返回後台設定</span>
            </button>
          </div>
        </header>

        {/* 大廳主區 */}
        <main className="max-w-7xl mx-auto w-full p-6 sm:p-8 space-y-8 flex-1">
          {/* 大廳引導橫幅 */}
          <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 via-slate-900/80 to-slate-950 p-6 sm:p-10 shadow-2xl">
            <div className="relative z-10 max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>獨立遊戲版·互動引擎</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
                沉浸式文字冒險，即刻開啟命運分支
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                所有遊戲項目的世界觀舞台、登場角色與頂層規則皆已就緒。點擊下方任一專案即可載入啟始劇情，冒險進度會自動保存於瀏覽器中，隨時可自由切換介面繼續進行！
              </p>
            </div>

            {/* 背景科技裝飾光斑 */}
            <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute right-20 bottom-0 w-64 h-64 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
          </div>

          {/* 搜尋與過濾列 */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-200">現有遊戲項目庫</span>
              <span className="text-xs font-mono bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-full border border-slate-700">
                {games.length} 部
              </span>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={lobbySearch}
                onChange={(e) => setLobbySearch(e.target.value)}
                placeholder="搜尋遊戲名稱或題材..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* 遊戲項目卡片網格 */}
          {filteredGames.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/40 text-slate-400 space-y-3">
              <Gamepad2 className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm font-medium">找不到相符的遊戲項目</p>
              <button
                onClick={onBackToStudio}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition"
              >
                前往後台建立新遊戲
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGames.map((game) => {
                const isCurrent = currentGame?.id === game.id;
                const savedSession = loadSavedSession(game.id);
                const hasProgress = savedSession && savedSession.turns && savedSession.turns.length > 0;

                return (
                  <div
                    key={game.id}
                    className={`group relative rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden bg-slate-900/70 hover:bg-slate-900 shadow-lg hover:shadow-emerald-950/40 hover:-translate-y-1 ${
                      isCurrent 
                        ? 'border-emerald-500/60 ring-1 ring-emerald-500/30' 
                        : 'border-slate-800 hover:border-emerald-500/40'
                    }`}
                  >
                    {/* 卡片封面頂部區域 */}
                    <div className="relative h-44 w-full bg-slate-950 overflow-hidden flex items-center justify-center">
                      {game.cover_url ? (
                        <img
                          src={game.cover_url}
                          alt={game.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-900 via-teal-950/30 to-emerald-950/50 flex flex-col items-center justify-center gap-2 p-4 text-center">
                          <Gamepad2 className="w-10 h-10 text-emerald-400/50 group-hover:text-emerald-400 transition" />
                          <span className="text-xs font-semibold text-slate-400 line-clamp-1">{game.title}</span>
                        </div>
                      )}

                      {/* 類型與基調標籤 */}
                      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 z-10">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-950/80 text-emerald-300 border border-emerald-500/30 backdrop-blur-sm">
                          {game.genre}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-950/80 text-teal-300 border border-teal-500/30 backdrop-blur-sm">
                          {game.tone}
                        </span>
                        {game.game_rules?.enable_player_stats && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-950/80 text-rose-300 border border-rose-500/40 backdrop-blur-sm flex items-center gap-1">
                            <HeartPulse className="w-2.5 h-2.5 text-rose-400" /> 數值系統
                          </span>
                        )}
                      </div>

                      {/* 當前專案標記 */}
                      {isCurrent && (
                        <div className="absolute top-3 right-3 z-10">
                          <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-md shadow-md">
                            <CheckCircle2 className="w-3 h-3" /> 當前選定
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 卡片內容 */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base font-bold text-slate-100 group-hover:text-emerald-300 transition line-clamp-1">
                            {game.title}
                          </h3>
                        </div>

                        {/* 若有存檔紀錄，呈現進度徽章 */}
                        {hasProgress && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[11px] font-mono text-emerald-300">
                            <span className="flex items-center gap-1.5">
                              <Save className="w-3.5 h-3.5 text-emerald-400" />
                              <span>已推進至第 <strong>{savedSession.roundCount}</strong> 回合</span>
                            </span>
                            <span className="text-[10px] text-slate-400">存於 {savedSession.updatedAt}</span>
                          </div>
                        )}

                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {game.main_plot || '世界舞台與主線任務已載入，等待玩家進入探索...'}
                        </p>
                      </div>

                      {/* 元素統計 pills */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono pt-3 border-t border-slate-800/80 flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-400" />
                          {game.locations_count} 場景
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-blue-400" />
                          {game.characters_count} NPC
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="flex items-center gap-1">
                          <Brain className="w-3 h-3 text-cyan-400" />
                          {game.lore_items_count || 0} 伏筆
                        </span>
                        {game.game_rules?.enable_player_stats && (
                          <>
                            <span className="text-slate-600">•</span>
                            <span className="flex items-center gap-1 text-rose-300">
                              <Activity className="w-3 h-3 text-rose-400" />
                              動態數值
                            </span>
                          </>
                        )}
                      </div>

                      {/* 進入/繼續遊戲按鈕群 */}
                      <div className="space-y-2">
                        {hasProgress ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleResumeOrStartGame(game.id, false)}
                              disabled={loadingGame}
                              className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition group-hover:shadow-emerald-500/30"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>繼續冒險 (回合 {savedSession.roundCount})</span>
                            </button>

                            <button
                              onClick={() => {
                                if (window.confirm(`確定要清除《${game.title}》的現有紀錄並重新開始嗎？`)) {
                                  handleResumeOrStartGame(game.id, true);
                                }
                              }}
                              disabled={loadingGame}
                              title="清除紀錄並重新開始"
                              className="py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-rose-950/40 hover:border-rose-500/50 hover:text-rose-300 border border-slate-700/60 text-slate-400 text-xs font-semibold flex items-center justify-center gap-1 transition"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>重開</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleResumeOrStartGame(game.id, false)}
                            disabled={loadingGame}
                            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition group-hover:shadow-emerald-500/30"
                          >
                            {loadingGame && playingGame?.id === game.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>正在啟動遊戲...</span>
                              </>
                            ) : (
                              <>
                                <Gamepad2 className="w-4 h-4" />
                                <span>進入遊戲冒險</span>
                                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    );
  }

  // ==================== 2. 遊戲進行中視圖 (Play Session) ====================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative">
      {/* 🌌 動態淡色循環背景圖層 (封面圖與角色圖淡入淡出輪播，完整全貌呈現) 🌌 */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {backgroundSlides.length > 0 ? (
          <>
            {backgroundSlides.map((slide, idx) => {
              const isActive = idx === currentBgIndex;
              return (
                <div
                  key={`${slide.url}-${idx}`}
                  className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {/* 背景氛圍擴散底層 (微模糊光暈，填補周圍氛圍) */}
                  <img
                    src={slide.url}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover object-center filter blur-3xl opacity-15"
                  />

                  {/* 主體展示層：自動適應瀏覽器邊框，剛好放大至長邊或寬邊觸碰到瀏覽器邊界 (100% object-contain) */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img
                      src={slide.url}
                      alt={slide.label}
                      className="w-full h-full object-contain object-center filter saturate-105 brightness-95 opacity-45 drop-shadow-[0_10px_35px_rgba(0,0,0,0.8)]"
                    />
                  </div>
                </div>
              );
            })}
            {/* 柔和微暗漸層，確保背景與前景文字完美融合 */}
            <div className="absolute inset-0 bg-slate-950/30" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-transparent to-slate-950/60" />
          </>
        ) : (
          /* 若無圖片時的科技感暗夜漸層與環境光 */
          <>
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-1/3 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          </>
        )}
      </div>

      {/* 背景圖當前輪播指示標籤 (極簡淡色小標，左下角) */}
      {backgroundSlides.length > 0 && (
        <div className="fixed bottom-3 left-4 z-20 pointer-events-none flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/70 border border-slate-800/60 backdrop-blur-md text-[10px] text-slate-300 shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>背景：{backgroundSlides[currentBgIndex]?.label}</span>
          {backgroundSlides.length > 1 && (
            <span className="font-mono text-[9px] text-emerald-400/90 font-semibold">
              ({currentBgIndex + 1}/{backgroundSlides.length})
            </span>
          )}
        </div>
      )}

      {/* 冒險頂部控制橫幅 (上方指令列) */}
      <header className="min-h-16 py-2.5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-40 shadow-lg">
        {/* 左側：遊戲名稱與狀態標籤 */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleSwitchToLobby}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-xs font-semibold text-slate-300 hover:text-white transition shrink-0"
            title="返回遊戲前台大廳"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回大廳</span>
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-slate-100 truncate max-w-[180px] sm:max-w-xs">
                  {playingGame?.title}
                </span>
                <span className="text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0">
                  回合 {turns.length}
                </span>
                {lastSavedTime && (
                  <span className="hidden xl:inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400/80 shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>進度已存 ({lastSavedTime})</span>
                  </span>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                <span>{playingGame?.genre}</span>
                <span>•</span>
                <span>{playingGame?.tone}</span>
                <span>•</span>
                <span className={isStrict ? 'text-purple-400 font-semibold' : 'text-cyan-400 font-semibold'}>
                  {isStrict ? '🛡️ 強硬約束' : '✨ 自由發展'}
                </span>
                {playingGame?.game_rules?.enable_player_stats && (
                  <>
                    <span>•</span>
                    <span className="text-rose-400 font-semibold flex items-center gap-1">
                      <HeartPulse className="w-3 h-3 text-rose-400" /> 數值系統
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 右側：操作指令按鈕列 */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end">
          <button
            onClick={handleExportAdventureTranscript}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-xs font-medium text-slate-300 hover:text-white transition"
            title="匯出完整冒險遊玩紀錄為 Markdown 檔"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">匯出紀錄</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-950/40 hover:bg-purple-900/40 border border-purple-500/30 text-xs font-medium text-purple-200 transition"
            title="AI 模型設定"
          >
            <Settings className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden md:inline">AI 設定</span>
          </button>

          {/* 角色狀態欄固定顯示切換按鈕 */}
          {isStatsEnabled && (
            <button
              onClick={() => setShowStatsBar(!showStatsBar)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                showStatsBar
                  ? 'bg-rose-950/70 border-rose-500/60 text-rose-200 shadow-sm shadow-rose-950/40 font-bold'
                  : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/60 text-slate-400'
              }`}
              title={showStatsBar ? "收起右側角色狀態欄" : "固定顯示右側角色狀態欄"}
            >
              <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
              <span>{showStatsBar ? '狀態欄(開啟)' : '狀態欄(收起)'}</span>
            </button>
          )}

          <button
            onClick={() => setShowManualDrawer(!showManualDrawer)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
              showManualDrawer
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/60 text-slate-300'
            }`}
            title="開啟世界觀與NPC手冊"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">世界觀手冊</span>
          </button>

          <button
            onClick={handleRestartAdventure}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/40 hover:border-rose-500/50 hover:text-rose-300 border border-slate-700/60 text-xs font-medium text-slate-400 transition"
            title="重置回第 1 回合啟始劇情"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">重新開始</span>
          </button>

          <button
            onClick={onBackToStudio}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
          >
            <span>後台</span>
          </button>
        </div>
      </header>

      {/* 冒險進行中主介面 */}
      <div className={`flex-1 w-full mx-auto p-4 sm:p-6 pb-28 transition-all ${
        isStatsEnabled && showStatsBar
          ? 'max-w-[1536px] flex flex-col lg:flex-row items-start gap-6'
          : 'max-w-5xl flex flex-col space-y-6'
      }`}>
        {/* 左側：冒險故事與決策推進主區 */}
        <div className="flex-1 min-w-0 space-y-6 w-full">
          {/* 錯誤提醒橫幅 (具備重試按鈕與狀態回滾提示) */}
          {errorMessage && (
            <div 
              ref={errorRef}
              className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/80 border-2 border-rose-500/60 text-rose-200 text-xs shadow-2xl shadow-rose-950/50 space-y-3 animate-in shake duration-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-md">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm text-rose-100">
                        劇情推演未成功 · 已自動回到選擇回合
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        進度已復原
                      </span>
                    </div>
                    <p className="text-xs text-rose-300/90 leading-relaxed font-medium">
                      {errorMessage}
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      💡 目前冒險進度已完好回復至錯誤發生前的選擇點，未消耗任何進度。你可以重新點選下方選項，或點擊「重試」重新嘗試。
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition shrink-0"
                  title="關閉錯誤提示"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 快速重試與操作按鈕 */}
              <div className="flex items-center gap-2.5 pt-2 border-t border-rose-500/20 flex-wrap">
                {failedAction && (
                  <button
                    onClick={() => advanceTurn(failedAction.text, failedAction.type)}
                    disabled={isAdvancingTurn}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>重試剛才行動：{failedAction.text.length > 20 ? failedAction.text.slice(0, 20) + '...' : failedAction.text}</span>
                  </button>
                )}
                <button
                  onClick={() => setErrorMessage(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  關閉提示並重選
                </button>
              </div>
            </div>
          )}

          {/* 故事動態對話滾動歷程 (Timeline Cards) */}
          <div className="space-y-6">
          {turns.map((turn) => {
            return (
              <div key={turn.round} className="space-y-4 animate-in fade-in duration-300">
                {/* 回合標題分隔 */}
                <div className="flex items-center gap-3">
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
                  <span className="text-[11px] font-mono text-emerald-400/90 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>第 {turn.round} 回合</span>
                  </span>
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
                </div>

                {/* 該回合劇情敘述主卡片 */}
                <div className="p-5 sm:p-7 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-xl space-y-4 relative overflow-hidden backdrop-blur-sm">
                  {/* 背景微光 */}
                  <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

                  {/* 局勢狀態與數值變動提示 */}
                  {(turn.statusSummary || turn.statsChanges) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {turn.statusSummary && (
                        <div className="text-[11px] font-medium text-emerald-300/90 bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-500/20 inline-flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{turn.statusSummary}</span>
                        </div>
                      )}
                      {turn.statsChanges && (
                        <div className="text-[11px] font-medium text-amber-300/90 bg-amber-950/40 px-3 py-1 rounded-lg border border-amber-500/30 inline-flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>⚡ 數值變動：{turn.statsChanges}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 劇情內文 (以乾淨段落呈現) */}
                  <div className="text-slate-200 text-sm sm:text-base leading-relaxed space-y-3 font-serif">
                    {turn.storySegment.split('\n\n').map((paragraph, pIdx) => {
                      if (!paragraph.trim()) return null;
                      return (
                        <p key={pIdx} className="leading-relaxed tracking-wide">
                          {paragraph.trim()}
                        </p>
                      );
                    })}
                  </div>
                </div>

                {/* 若玩家已做出選擇，顯示玩家行動 */}
                {turn.playerAction && (
                  <div className="flex justify-end">
                    <div className="max-w-xl p-3.5 sm:p-4 rounded-2xl rounded-tr-sm bg-gradient-to-r from-teal-950/80 to-emerald-950/90 border border-emerald-500/40 text-emerald-100 shadow-lg space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-300">
                        <span>👉 你的抉擇行動 ({turn.actionType === 'custom' ? '自由輸入' : '預設選項'})：</span>
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-slate-100 leading-relaxed">
                        {turn.playerAction}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 當前最新回合：命運決策與選項互動區 (Active Choices & Input) */}
        <div className="pt-4 space-y-5">
          {/* 決策面板標題 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-emerald-400" />
                <span>當前命運抉擇（請選擇或輸入行動推進劇情）：</span>
              </span>
              {errorMessage && (
                <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded-full">
                  已恢復至此回合選項
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              {allowCustom ? '支援自選與自創輸入' : '僅限點選系統預設選項'}
            </span>
          </div>

          {/* AI 命運引擎推演中動畫 */}
          {isAdvancingTurn && (
            <div className="p-8 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-sm text-center space-y-3 animate-pulse">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-emerald-300">
                  AI 命運引擎演算中...
                </p>
                <p className="text-[11px] text-slate-400">
                  正在依據世界觀舞台、登場角色與頂層規則推演後續劇情與分歧...
                </p>
              </div>
            </div>
          )}

          {/* 預設選項列表 */}
          {!isAdvancingTurn && currentChoices.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentChoices.map((opt, idx) => (
                <button
                  key={opt.id || idx}
                  onClick={() => handleSelectOption(opt)}
                  disabled={isAdvancingTurn}
                  className="group p-4 rounded-xl border border-slate-800 bg-slate-900/90 hover:bg-emerald-950/30 hover:border-emerald-500/60 text-left transition-all duration-200 shadow-md flex items-start gap-3 transform hover:-translate-y-0.5"
                >
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xs font-mono font-bold shrink-0 group-hover:bg-emerald-500 group-hover:text-slate-950 transition">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-white leading-relaxed">
                      {opt.text}
                    </p>
                    {opt.hint && (
                      <p className="text-[10px] text-slate-500 group-hover:text-emerald-300/80 leading-relaxed font-mono">
                        💡 提示：{opt.hint}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* 自由文字輸入框 (依遊戲第 1 層設定：allow_custom_input 決定是否開放) */}
          {!isAdvancingTurn && (
            allowCustom ? (
              <form onSubmit={handleSubmitCustomInput} className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5 shadow-lg">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>玩家自訂行動 / 發言推進：</span>
                  </label>
                  <span className="text-[10px] font-mono text-cyan-400/80 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20">
                    開放自創輸入
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customInputText}
                    onChange={(e) => setCustomInputText(e.target.value)}
                    disabled={isAdvancingTurn}
                    placeholder="鍵入你的自創行為、對白或嘗試之行動（例如：拔出腰間佩刀朝右側陰影揮去...）"
                    className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                  />
                  <button
                    type="submit"
                    disabled={isAdvancingTurn || !customInputText.trim()}
                    className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>送出行動</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {isStrict 
                    ? '🛡️ 本遊戲啟動強硬規則約束：若輸入脫離現實或違背世界觀的無敵開掛舉動，AI 將判定失敗或給予懲罰。' 
                    : '✨ 本遊戲支援劇情自由發展：AI 將盡可能順應你的創意與天馬行空的意向展開。'}
                </p>
              </form>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
                <span>此遊戲設定為「僅限點選系統預設選項」，未開放自由文字輸入。請直接點擊上方選項以推演劇情。</span>
              </div>
            )
          )}

          {/* 滾動底部錨點 */}
          <div ref={chatBottomRef} />
        </div>
      </div>

      {/* 右側：固定顯示的角色狀態欄 (Permanent Character HUD) */}
      {isStatsEnabled && showStatsBar && (
        <aside className="w-full lg:w-80 xl:w-96 shrink-0 lg:sticky lg:top-20 space-y-4 z-20 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="rounded-2xl bg-gradient-to-b from-rose-950/60 via-slate-900/95 to-slate-950 border border-rose-500/40 shadow-2xl backdrop-blur-md overflow-hidden flex flex-col max-h-[calc(100vh-6.5rem)]">
            {/* 頂部標題列 */}
            <div className="p-4 border-b border-rose-500/30 bg-rose-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-md">
                  <HeartPulse className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-rose-200">
                      角色狀態欄
                    </h3>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      固定右側
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    常駐固定記憶 · 即時演變
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(currentPlayerStats || '');
                    setCopiedStats(true);
                    setTimeout(() => setCopiedStats(false), 2000);
                  }}
                  title="複製狀態文字"
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                >
                  {copiedStats ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>
                <button
                  onClick={() => setShowStatsBar(false)}
                  title="收起右側狀態欄"
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 狀態欄滾動主體 */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* 最新一輪數值變動 (如有) */}
              {latestStatsChanges && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs space-y-1 animate-in fade-in">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400 text-[11px]">
                    <Activity className="w-3.5 h-3.5" />
                    <span>最新一輪數值變更</span>
                  </div>
                  <p className="text-[11px] leading-relaxed font-mono">
                    {latestStatsChanges}
                  </p>
                </div>
              )}

              {/* 當前角色數值卡片 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-rose-300 flex items-center gap-1">
                    <Sparkles className="w-3 text-rose-400" />
                    當前角色數值與持有狀態
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    第 {turns.length} 回合
                  </span>
                </div>

                <div className="p-3.5 bg-slate-950/90 rounded-xl border border-rose-500/20 font-mono text-xs text-rose-100 whitespace-pre-wrap leading-relaxed shadow-inner">
                  {currentPlayerStats || '（尚無數值紀錄）'}
                </div>
              </div>

              {/* 規則約束說明 */}
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[10px] text-slate-400 leading-relaxed space-y-1">
                <p className="font-semibold text-slate-300">
                  🛡️ AI 常駐固定記憶機制：
                </p>
                <p>
                  右側狀態欄為本遊戲最高優先級約束，AI 將永遠鎖定此記憶判定玩家行動代價、勝負、資源消耗與生死。
                </p>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>

    {/* 當開啟角色狀態但被玩家暫時收起時，顯示右下角快速展開懸浮按鈕 */}
    {isStatsEnabled && !showStatsBar && (
      <button
        onClick={() => setShowStatsBar(true)}
        className="fixed right-5 bottom-24 z-30 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-xl shadow-rose-950/60 transition transform hover:scale-105 border border-rose-400/40"
        title="固定展開右側角色狀態欄"
      >
        <HeartPulse className="w-4 h-4 animate-pulse" />
        <span>展開角色狀態欄</span>
      </button>
    )}

      {/* 側邊可折疊：世界觀與NPC手冊抽屜 (Manual Drawer) */}
      {showManualDrawer && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-slate-900/95 border-l border-slate-800 shadow-2xl z-50 flex flex-col backdrop-blur-md animate-in slide-in-from-right duration-200">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-slate-100">冒險手冊與世界觀</h3>
            </div>
            <button
              onClick={() => setShowManualDrawer(false)}
              className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 rounded-lg bg-slate-800"
            >
              關閉
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-300">
            {/* 遊戲頂層規則 */}
            <div className="space-y-2">
              <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" /> 頂層遊戲規則
              </span>
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5 font-mono text-[11px]">
                <p>約束模式：{isStrict ? '🛡️ 強硬遊戲規則（防暴走）' : '✨ 劇情自由發展'}</p>
                <p>自創輸入：{allowCustom ? '✅ 開放玩家自由輸入' : '🔒 僅限預設選項'}</p>
                <p>數值系統：{playingGame?.game_rules?.enable_player_stats ? '❤️ 已啟用（常駐固定記憶）' : '⚪ 未啟用'}</p>
                {playingGame?.game_rules?.rules_text && (
                  <div className="pt-2 border-t border-slate-800 text-slate-400 whitespace-pre-wrap">
                    {playingGame.game_rules.rules_text}
                  </div>
                )}
              </div>
            </div>

            {/* 玩家數值狀態（固定記憶） */}
            {playingGame?.game_rules?.enable_player_stats && (
              <div className="space-y-2">
                <span className="font-bold text-rose-300 flex items-center gap-1.5">
                  <HeartPulse className="w-3.5 h-3.5 text-rose-400" /> 玩家當前數值狀態（固定記憶）
                </span>
                <div className="p-3 bg-slate-950/80 rounded-xl border border-rose-500/30 text-rose-200 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                  {currentPlayerStats || '（尚未記錄數值）'}
                </div>
              </div>
            )}

            {/* 世界觀舞台 */}
            <div className="space-y-2">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-teal-400" /> 世界觀背景
              </span>
              <p className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] leading-relaxed text-slate-300">
                {playingGame?.world_background || '未設定特定世界觀'}
              </p>
            </div>

            {/* 主線任務目標 */}
            <div className="space-y-2">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" /> 核心主線目標
              </span>
              <p className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] leading-relaxed text-slate-300">
                {playingGame?.main_plot || '推進探索與解謎'}
              </p>
            </div>

            {/* 登場角色陣容 (NPC) */}
            <div className="space-y-2">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" /> 登場NPC角色 ({playingGame?.characters?.length || 0})
              </span>
              <div className="space-y-2">
                {(playingGame?.characters || []).map((char) => (
                  <div key={char.id} className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5">
                    {char.avatar_url ? (
                      <img src={char.avatar_url} alt={char.name} className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-700" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-xs shrink-0">
                        {char.name[0]}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200 text-[11px]">{char.name}</span>
                        <span className="text-[10px] text-slate-500">{char.role}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{char.profile}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 世界地點 */}
            <div className="space-y-2">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" /> 探索地點 ({playingGame?.locations?.length || 0})
              </span>
              <div className="space-y-1.5">
                {(playingGame?.locations || []).map((loc) => (
                  <div key={loc.id} className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <span className="font-bold text-slate-300 text-[11px]">{loc.name}</span>
                    <p className="text-[10px] text-slate-400 line-clamp-2">{loc.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
