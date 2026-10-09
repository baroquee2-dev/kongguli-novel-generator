import React, { useState } from 'react';
import type { NovelListItem, GameListItem, AISettings, SystemMode } from '../types';
import { 
  BookOpen, Plus, Settings, Download, Trash2, Sparkles, ChevronDown, Gamepad2 
} from 'lucide-react';
import { api } from '../api/client';

interface Props {
  systemMode: SystemMode;
  onSwitchSystemMode: (mode: SystemMode) => void;
  novels: NovelListItem[];
  currentNovelId: string;
  onSelectNovel: (id: string) => void;
  onCreateNovel: () => void;
  onInitSample: () => void;
  onDeleteNovel: (id: string) => void;
  games: GameListItem[];
  currentGameId: string;
  onSelectGame: (id: string) => void;
  onCreateGame: () => void;
  onInitSampleGame: () => void;
  onDeleteGame: (id: string) => void;
  onOpenSettings: () => void;
  onSwitchToFrontstage: () => void;
  settings: AISettings;
}

export const Navbar: React.FC<Props> = ({
  systemMode,
  onSwitchSystemMode,
  novels,
  currentNovelId,
  onSelectNovel,
  onCreateNovel,
  onInitSample,
  onDeleteNovel,
  games,
  currentGameId,
  onSelectGame,
  onCreateGame,
  onInitSampleGame,
  onDeleteGame,
  onOpenSettings,
  onSwitchToFrontstage,
  settings
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isGame = systemMode === 'game';
  const currentItem = isGame 
    ? games.find(g => g.id === currentGameId)
    : novels.find(n => n.id === currentNovelId);

  const handleExport = () => {
    if (isGame) {
      if (!currentGameId) return;
      window.open(api.getExportGameUrl(currentGameId), '_blank');
    } else {
      if (!currentNovelId) return;
      window.open(api.getExportUrl(currentNovelId), '_blank');
    }
  };

  const handleDelete = () => {
    if (!currentItem) return;
    const itemType = isGame ? '遊戲專案' : '小說';
    if (window.confirm(`確定要刪除${itemType}《${currentItem.title}》嗎？此動作不可逆！`)) {
      if (isGame) {
        onDeleteGame(currentItem.id);
      } else {
        onDeleteNovel(currentItem.id);
      }
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      {/* 左側：品牌 Logo、頂層模式切換 & 作品庫選單 */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg text-white font-black text-lg transition ${
            isGame 
              ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-600/30' 
              : 'bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-purple-600/30'
          }`}>
            {isGame ? <Gamepad2 className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
          </div>
          <div>
            <span className={`font-extrabold text-sm sm:text-base tracking-wide bg-clip-text text-transparent ${
              isGame
                ? 'bg-gradient-to-r from-emerald-200 via-teal-200 to-cyan-200'
                : 'bg-gradient-to-r from-purple-200 via-indigo-200 to-pink-200'
            }`}>
              KongGuLi-孔固力創作系統
            </span>
            <span className="block text-[10px] text-slate-400 font-mono">
              {isGame ? '🎮 獨立遊戲版引擎模式' : '📖 靈活多層式小說生成'}
            </span>
          </div>
        </div>

        {/* 🌟 頂層系統版本切換頁籤：小說版 vs 遊戲版 */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 shadow-inner">
          <button
            onClick={() => onSwitchSystemMode('novel')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              !isGame
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>小說版</span>
          </button>
          <button
            onClick={() => onSwitchSystemMode('game')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              isGame
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>遊戲版</span>
          </button>
        </div>

        {/* 作品/專案選擇下拉 */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-sm font-medium text-slate-200 transition"
          >
            <span className="max-w-[180px] truncate">
              {currentItem 
                ? `${isGame ? '🎮' : '📖'} ${currentItem.title}` 
                : (isGame ? '選擇遊戲專案...' : '選擇作品...')}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {dropdownOpen && (
            <div 
              className="absolute left-0 mt-2 w-72 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
              onClick={() => setDropdownOpen(false)}
            >
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {isGame ? `切換遊戲專案庫 (${games.length})` : `切換小說作品庫 (${novels.length})`}
              </div>
              <div className="max-h-60 overflow-y-auto">
                {isGame ? (
                  games.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => onSelectGame(g.id)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 transition ${
                        g.id === currentGameId ? 'text-emerald-300 font-semibold bg-emerald-600/10' : 'text-slate-300'
                      }`}
                    >
                      <span className="truncate pr-2">{g.title}</span>
                      <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                        {g.chapters_count} 關/章
                      </span>
                    </button>
                  ))
                ) : (
                  novels.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => onSelectNovel(n.id)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 transition ${
                        n.id === currentNovelId ? 'text-purple-300 font-semibold bg-purple-600/10' : 'text-slate-300'
                      }`}
                    >
                      <span className="truncate pr-2">{n.title}</span>
                      <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                        {n.chapters_count} 章
                      </span>
                    </button>
                  ))
                )}
              </div>

              <div className="border-t border-slate-800 mt-1 pt-1">
                {isGame ? (
                  <>
                    <button
                      onClick={onCreateGame}
                      className="w-full text-left px-3 py-2 text-xs text-emerald-400 hover:bg-slate-800 flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> 建立新遊戲專案
                    </button>
                    <button
                      onClick={onInitSampleGame}
                      className="w-full text-left px-3 py-2 text-xs text-teal-400 hover:bg-slate-800 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> 載入示範遊戲 (時空迴廊)
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={onCreateNovel}
                      className="w-full text-left px-3 py-2 text-xs text-purple-400 hover:bg-slate-800 flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> 建立新小說
                    </button>
                    <button
                      onClick={onInitSample}
                      className="w-full text-left px-3 py-2 text-xs text-indigo-400 hover:bg-slate-800 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> 載入示範作品 (蒼穹星軌)
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 右側：動作按鈕群 */}
      <div className="flex items-center gap-3">
        {/* 小說版專屬：切換到前台閱讀展台按鈕 */}
        {!isGame && (
          <button
            onClick={onSwitchToFrontstage}
            title="切換至前台讀者閱讀展台，完整列出主題與純故事正文"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600/30 via-teal-600/30 to-cyan-600/30 hover:from-emerald-600/50 hover:to-cyan-600/50 border border-emerald-500/50 text-xs font-bold text-emerald-200 transition shadow-sm shadow-emerald-500/10 transform hover:-translate-y-0.5"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>📖 切換至前台閱讀</span>
          </button>
        )}

        {currentItem && (
          <>
            <button
              onClick={handleExport}
              title={isGame ? "匯出遊戲文件為 Markdown 檔" : "匯出全書為 Markdown 文字檔"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-xs font-medium text-slate-300 hover:text-white transition"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>{isGame ? '匯出遊戲' : '匯出全書'}</span>
            </button>

            <button
              onClick={handleDelete}
              title={isGame ? "刪除此遊戲專案" : "刪除此小說"}
              className="p-1.5 rounded-xl bg-slate-800/40 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}

        <div className="h-5 w-[1px] bg-slate-800 mx-1" />

        {/* AI 模型設定按鈕 */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-950/40 hover:bg-purple-900/40 border border-purple-500/30 text-xs font-medium text-purple-200 transition"
        >
          <Settings className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden sm:inline">AI 模型:</span>
          <span className="font-mono text-purple-300 font-semibold">{settings.model || settings.provider}</span>
        </button>
      </div>
    </header>
  );
};
