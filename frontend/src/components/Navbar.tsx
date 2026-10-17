import React, { useState } from 'react';
import type {
  NovelListItem,
  GameListItem,
  CharacterCardListItem,
  AISettings,
  SystemMode
} from '../types';
import {
  BookOpen,
  Plus,
  Settings,
  Download,
  Trash2,
  Sparkles,
  ChevronDown,
  Gamepad2,
  Compass,
  MessageSquareHeart,
  MessageCircle
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
  characterCards: CharacterCardListItem[];
  currentCardId: string;
  onSelectCard: (id: string) => void;
  onCreateCard: () => void;
  onInitSampleCard: () => void;
  onDeleteCard: (id: string) => void;
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
  characterCards,
  currentCardId,
  onSelectCard,
  onCreateCard,
  onInitSampleCard,
  onDeleteCard,
  onOpenSettings,
  onSwitchToFrontstage,
  settings
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isGame = systemMode === 'game' || systemMode === 'game_frontstage';
  const isCharacter = systemMode === 'character' || systemMode === 'character_frontstage';

  const currentNovelOrGame = isGame
    ? games.find((g) => g.id === currentGameId)
    : novels.find((n) => n.id === currentNovelId);
  const currentCardItem = characterCards.find((c) => c.id === currentCardId);

  const handleExport = () => {
    if (isCharacter) {
      if (!currentCardId) return;
      window.open(api.getExportCharacterCardJsonUrl(currentCardId), '_blank');
    } else if (isGame) {
      if (!currentGameId) return;
      window.open(api.getExportGameUrl(currentGameId), '_blank');
    } else {
      if (!currentNovelId) return;
      window.open(api.getExportUrl(currentNovelId), '_blank');
    }
  };

  const handleDelete = () => {
    if (isCharacter) {
      if (!currentCardItem) return;
      if (window.confirm(`確定要刪除角色卡「${currentCardItem.name}」嗎？此動作不可逆！`)) {
        onDeleteCard(currentCardItem.id);
      }
      return;
    }
    if (!currentNovelOrGame) return;
    const itemType = isGame ? '遊戲專案' : '小說';
    if (window.confirm(`確定要刪除${itemType}《${currentNovelOrGame.title}》嗎？此動作不可逆！`)) {
      if (isGame) {
        onDeleteGame(currentNovelOrGame.id);
      } else {
        onDeleteNovel(currentNovelOrGame.id);
      }
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      {/* 左側：品牌 Logo、頂層模式切換 & 作品庫選單 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg text-white font-black text-lg transition ${
              isCharacter
                ? 'bg-gradient-to-tr from-rose-600 to-pink-500 shadow-rose-600/30'
                : isGame
                ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-600/30'
                : 'bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-purple-600/30'
            }`}
          >
            {isCharacter ? (
              <MessageSquareHeart className="w-5 h-5" />
            ) : isGame ? (
              <Gamepad2 className="w-5 h-5" />
            ) : (
              <BookOpen className="w-5 h-5" />
            )}
          </div>
          <div className="hidden lg:block">
            <span
              className={`font-extrabold text-sm tracking-wide bg-clip-text text-transparent ${
                isCharacter
                  ? 'bg-gradient-to-r from-rose-200 via-pink-200 to-fuchsia-200'
                  : isGame
                  ? 'bg-gradient-to-r from-emerald-200 via-teal-200 to-cyan-200'
                  : 'bg-gradient-to-r from-purple-200 via-indigo-200 to-pink-200'
              }`}
            >
              KongGuLi-孔固力創作系統
            </span>
            <span className="block text-[10px] text-slate-400 font-mono">
              {isCharacter
                ? '💬 角色聊天與酒館角色卡工坊'
                : isGame
                ? '🎮 獨立遊戲版引擎模式'
                : '📖 靈活多層式小說生成'}
            </span>
          </div>
        </div>

        {/* 🌟 頂層系統版本切換頁籤：小說版 vs 遊戲版 vs 遊戲前台 vs 角色後台 vs 角色聊天 */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 shadow-inner">
          <button
            onClick={() => onSwitchSystemMode('novel')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
              systemMode === 'novel'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>小說版</span>
          </button>
          <button
            onClick={() => onSwitchSystemMode('game')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
              systemMode === 'game'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>遊戲版</span>
          </button>
          <button
            onClick={() => onSwitchSystemMode('game_frontstage')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
              systemMode === 'game_frontstage'
                ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>遊戲前台</span>
          </button>
          <button
            onClick={() => onSwitchSystemMode('character')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
              systemMode === 'character'
                ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md shadow-rose-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquareHeart className="w-3.5 h-3.5" />
            <span>角色後台</span>
          </button>
          <button
            onClick={() => onSwitchSystemMode('character_frontstage')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
              systemMode === 'character_frontstage'
                ? 'bg-gradient-to-r from-pink-500 to-fuchsia-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>角色聊天</span>
          </button>
        </div>

        {/* 作品/專案/角色卡選擇下拉 */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-sm font-medium text-slate-200 transition"
          >
            <span className="max-w-[160px] truncate">
              {isCharacter
                ? currentCardItem
                  ? `💬 ${currentCardItem.name}`
                  : '選擇角色卡...'
                : currentNovelOrGame
                ? `${isGame ? '🎮' : '📖'} ${currentNovelOrGame.title}`
                : isGame
                ? '選擇遊戲專案...'
                : '選擇作品...'}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {dropdownOpen && (
            <div
              className="absolute left-0 mt-2 w-72 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
              onClick={() => setDropdownOpen(false)}
            >
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {isCharacter
                  ? `切換角色卡庫 (${characterCards.length})`
                  : isGame
                  ? `切換遊戲專案庫 (${games.length})`
                  : `切換小說作品庫 (${novels.length})`}
              </div>
              <div className="max-h-60 overflow-y-auto">
                {isCharacter ? (
                  characterCards.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onSelectCard(c.id)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 transition ${
                        c.id === currentCardId
                          ? 'text-rose-300 font-semibold bg-rose-600/10'
                          : 'text-slate-300'
                      }`}
                    >
                      <span className="truncate pr-2">{c.name}</span>
                      <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                        世界書 {c.lore_items_count}
                      </span>
                    </button>
                  ))
                ) : isGame ? (
                  games.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => onSelectGame(g.id)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 transition ${
                        g.id === currentGameId
                          ? 'text-emerald-300 font-semibold bg-emerald-600/10'
                          : 'text-slate-300'
                      }`}
                    >
                      <span className="truncate pr-2">{g.title}</span>
                      <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                        {g.total_word_count ? `${g.total_word_count} 字` : '啟始情境'}
                      </span>
                    </button>
                  ))
                ) : (
                  novels.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => onSelectNovel(n.id)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 transition ${
                        n.id === currentNovelId
                          ? 'text-purple-300 font-semibold bg-purple-600/10'
                          : 'text-slate-300'
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
                {isCharacter ? (
                  <>
                    <button
                      onClick={onCreateCard}
                      className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-slate-800 flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> 建立新角色卡
                    </button>
                    <button
                      onClick={onInitSampleCard}
                      className="w-full text-left px-3 py-2 text-xs text-pink-400 hover:bg-slate-800 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> 載入示範角色 (星見 汐音)
                    </button>
                  </>
                ) : isGame ? (
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
      <div className="flex items-center gap-2.5">
        {systemMode === 'novel' && (
          <button
            onClick={onSwitchToFrontstage}
            title="切換至前台讀者閱讀展台"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600/30 via-teal-600/30 to-cyan-600/30 hover:from-emerald-600/50 hover:to-cyan-600/50 border border-emerald-500/50 text-xs font-bold text-emerald-200 transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden xl:inline">📖 前台閱讀</span>
          </button>
        )}

        {systemMode === 'game' && (
          <button
            onClick={() => onSwitchSystemMode('game_frontstage')}
            title="切換至遊戲前台大廳"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600/30 via-teal-600/30 to-cyan-600/30 hover:from-emerald-600/50 hover:to-cyan-600/50 border border-emerald-500/50 text-xs font-bold text-emerald-200 transition"
          >
            <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden xl:inline">🎮 遊戲前台</span>
          </button>
        )}

        {systemMode === 'character' && (
          <button
            onClick={() => onSwitchSystemMode('character_frontstage')}
            title="切換至角色聊天前台大廳"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600/30 via-pink-600/30 to-fuchsia-600/30 hover:from-rose-600/50 hover:to-fuchsia-600/50 border border-rose-500/50 text-xs font-bold text-rose-200 transition"
          >
            <MessageCircle className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden xl:inline">💬 前往角色聊天</span>
          </button>
        )}

        {(isCharacter ? currentCardItem : currentNovelOrGame) && (
          <>
            <button
              onClick={handleExport}
              title={
                isCharacter
                  ? '匯出 SillyTavern V2 JSON 角色卡'
                  : isGame
                  ? '匯出遊戲文件為 Markdown 檔'
                  : '匯出全書為 Markdown 文字檔'
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-xs font-medium text-slate-300 hover:text-white transition"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">
                {isCharacter ? '匯出角色卡' : isGame ? '匯出遊戲' : '匯出全書'}
              </span>
            </button>

            <button
              onClick={handleDelete}
              title={
                isCharacter
                  ? '刪除此角色卡'
                  : isGame
                  ? '刪除此遊戲專案'
                  : '刪除此小說'
              }
              className="p-1.5 rounded-xl bg-slate-800/40 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}

        <div className="h-5 w-[1px] bg-slate-800 mx-0.5" />

        {/* AI 模型設定按鈕 */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/40 hover:bg-purple-900/40 border border-purple-500/30 text-xs font-medium text-purple-200 transition"
        >
          <Settings className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden sm:inline">AI:</span>
          <span className="font-mono text-purple-300 font-semibold max-w-[110px] truncate">
            {settings.model || settings.provider}
          </span>
        </button>
      </div>
    </header>
  );
};
