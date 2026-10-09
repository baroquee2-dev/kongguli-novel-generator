import React, { useState, useEffect, useRef } from 'react';
import type { GameProject, GameListItem, GameChoiceOption, GameTurnHistoryItem } from '../types';
import { api } from '../api/client';
import { 
  Gamepad2, ArrowLeft, RotateCcw, Send, Sparkles, ShieldAlert, 
  BookOpen, Users, MapPin, Brain, Search, Clock, Compass, Layers, 
  CheckCircle2, ChevronRight, Loader2, AlertCircle, Settings
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
}

export const GameFrontstageView: React.FC<Props> = ({
  games,
  currentGame,
  onSelectGame,
  onBackToStudio,
  onOpenSettings,
}) => {
  // 檢視模式：'lobby' (遊戲大廳/專案庫列表) | 'play' (冒險遊玩中)
  const [viewMode, setViewMode] = useState<'lobby' | 'play'>('lobby');

  // 當前遊玩的完整遊戲資料
  const [playingGame, setPlayingGame] = useState<GameProject | null>(currentGame);
  const [loadingGame, setLoadingGame] = useState(false);

  // 冒險狀態歷程
  const [turns, setTurns] = useState<AdventureTurn[]>([]);
  const [currentChoices, setCurrentChoices] = useState<GameChoiceOption[]>([]);
  const [customInputText, setCustomInputText] = useState('');
  const [isAdvancingTurn, setIsAdvancingTurn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 側邊世界觀手冊開關
  const [showManualDrawer, setShowManualDrawer] = useState(false);

  // 大廳搜尋
  const [lobbySearch, setLobbySearch] = useState('');

  // 滾動參照
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // 自動平滑滾動至最新情節
  useEffect(() => {
    if (viewMode === 'play') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [turns, isAdvancingTurn, viewMode]);

  // 同步 currentGame
  useEffect(() => {
    if (currentGame && (!playingGame || playingGame.id === currentGame.id)) {
      setPlayingGame(currentGame);
    }
  }, [currentGame]);

  // 進入遊戲冒險 (初始化啟始劇情與啟始選項)
  const handleStartGame = async (gameId: string) => {
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

      // 提取第 5 層單一啟始劇情與啟始選項
      const initialStory = gameData.chapters && gameData.chapters.length > 0 
        ? gameData.chapters[0] 
        : null;

      const startingPlot = initialStory?.starting_plot || initialStory?.content || '命運的帷幕緩緩拉開，新的冒險即將啟程...';
      const startingOptions: GameChoiceOption[] = (initialStory?.starting_options && initialStory.starting_options.length > 0)
        ? initialStory.starting_options
        : [
            { id: 'opt-init-1', text: '主動挺身而出，探查周遭動靜', hint: '主動出擊' },
            { id: 'opt-init-2', text: '保持警惕在暗處觀察局勢', hint: '審慎穩妥' },
            { id: 'opt-init-3', text: '嘗試尋找同伴或搜集情報', hint: '情報與社交' }
          ];

      // 初始化第 1 回合
      setTurns([
        {
          round: 1,
          storySegment: startingPlot,
        }
      ]);
      setCurrentChoices(startingOptions);
      setCustomInputText('');
      setViewMode('play');
    } catch (err: any) {
      console.error('進入遊戲失敗:', err);
      alert(err.message || '進入遊戲失敗，請檢查網路或後端連線');
    } finally {
      setLoadingGame(false);
    }
  };

  // 重新開始本專案冒險
  const handleRestartAdventure = () => {
    if (!playingGame) return;
    if (window.confirm('確定要重新開始當前冒險嗎？目前的遊玩紀錄將會重置回啟始劇情。')) {
      handleStartGame(playingGame.id);
    }
  };

  // 推進遊戲回合核心邏輯
  const advanceTurn = async (actionText: string, actionType: 'preset' | 'custom') => {
    if (!playingGame || !actionText.trim() || isAdvancingTurn) return;

    setIsAdvancingTurn(true);
    setErrorMessage(null);

    // 1. 登記玩家在當前回合的行動
    const currentRound = turns.length;
    const updatedTurns = [...turns];
    if (updatedTurns.length > 0) {
      updatedTurns[updatedTurns.length - 1] = {
        ...updatedTurns[updatedTurns.length - 1],
        playerAction: actionText.trim(),
        actionType: actionType
      };
    }
    setTurns(updatedTurns);

    // 2. 組裝歷史送交後端推演
    const historyPayload: GameTurnHistoryItem[] = updatedTurns.map(t => ({
      round: t.round,
      story_segment: t.storySegment,
      player_action: t.playerAction || '',
      choice_type: t.actionType || 'preset'
    }));

    try {
      const response = await api.playGameTurn({
        game_id: playingGame.id,
        current_action: actionText.trim(),
        action_type: actionType,
        history: historyPayload
      });

      // 3. 追加新一輪的劇情敘述與更新選項
      const nextTurn: AdventureTurn = {
        round: response.round || currentRound + 1,
        storySegment: response.story_continuation,
        statusSummary: response.status_summary
      };

      setTurns([...updatedTurns, nextTurn]);
      setCurrentChoices(response.choices || []);
      setCustomInputText('');
    } catch (err: any) {
      console.error('推進劇情失敗:', err);
      setErrorMessage(err.message || 'AI 推演劇情時發生錯誤，請稍後再試或檢查 API Key 設定');
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
                所有遊戲項目的世界觀舞台、登場角色與頂層規則皆已就緒。點擊下方任一專案即可載入啟始劇情，隨著你的每一次抉擇自動由 AI 演算演繹專屬發展！
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
                        <h3 className="text-base font-bold text-slate-100 group-hover:text-emerald-300 transition line-clamp-1">
                          {game.title}
                        </h3>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {game.main_plot || '世界舞台與主線任務已載入，等待玩家進入探索...'}
                        </p>
                      </div>

                      {/* 元素統計 pills */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono pt-3 border-t border-slate-800/80">
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
                      </div>

                      {/* 進入遊戲按鈕 */}
                      <button
                        onClick={() => handleStartGame(game.id)}
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
      {/* 冒險頂部控制橫幅 */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setViewMode('lobby')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-xs font-semibold text-slate-300 hover:text-white transition"
            title="返回遊戲前台大廳"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回大廳</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-100">
                  {playingGame?.title}
                </span>
                <span className="text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  回合 {turns.length}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span>{playingGame?.genre}</span>
                <span>•</span>
                <span>{playingGame?.tone}</span>
                <span>•</span>
                <span className={isStrict ? 'text-purple-400 font-semibold' : 'text-cyan-400 font-semibold'}>
                  {isStrict ? '🛡️ 強硬規則約束' : '✨ 自由發展模式'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 右側操作按鈕 */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/40 hover:bg-purple-900/40 border border-purple-500/30 text-xs font-medium text-purple-200 transition"
            title="AI 模型設定"
          >
            <Settings className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">AI 設定</span>
          </button>

          <button
            onClick={() => setShowManualDrawer(!showManualDrawer)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
              showManualDrawer
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/60 text-slate-300'
            }`}
            title="開啟世界觀與NPC手冊"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">遊戲設定與NPC</span>
          </button>

          <button
            onClick={handleRestartAdventure}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/40 hover:border-rose-500/50 hover:text-rose-300 border border-slate-700/60 text-xs font-medium text-slate-400 transition"
            title="重置回第 1 回合啟始劇情"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">重新開始</span>
          </button>

          <button
            onClick={onBackToStudio}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
          >
            <span>後台設定</span>
          </button>
        </div>
      </header>

      {/* 冒險進行中主介面 */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col space-y-6 pb-28">
        {/* 錯誤提醒橫幅 */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 text-xs font-mono ml-2 underline"
            >
              關閉
            </button>
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

                  {/* 局勢狀態提示 (如有) */}
                  {turn.statusSummary && (
                    <div className="text-[11px] font-medium text-emerald-300/90 bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-500/20 inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{turn.statusSummary}</span>
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
                {playingGame?.game_rules?.rules_text && (
                  <div className="pt-2 border-t border-slate-800 text-slate-400 whitespace-pre-wrap">
                    {playingGame.game_rules.rules_text}
                  </div>
                )}
              </div>
            </div>

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
