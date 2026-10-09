import React, { useState, useRef } from 'react';
import type { Novel, GameRulesConfig } from '../types';
import { 
  Sparkles, Loader2, BookOpen, Globe2, Compass, PenTool, Wand2, Flame, RotateCcw,
  Upload, Link as LinkIcon, Trash2, Image as ImageIcon,
  Gamepad2, ScrollText, GitFork, MessageSquarePlus, ShieldAlert, ShieldCheck
} from 'lucide-react';
import { api } from '../api/client';

interface Props {
  novel: Novel;
  onChange: (updated: Novel) => void;
  isGame?: boolean;
}

export const StoryOverviewTab: React.FC<Props> = ({ novel, onChange, isGame = false }) => {
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [roughIdea, setRoughIdea] = useState('');
  const [preferredGenre, setPreferredGenre] = useState('');
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 封面圖上傳與設定狀態
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCover(true);
    try {
      const url = await api.uploadAvatar(file);
      onChange({ ...novel, cover_url: url });
    } catch (err: any) {
      alert(err.message || '封面圖片上傳失敗');
    } finally {
      setIsUploadingCover(false);
      e.target.value = '';
    }
  };

  const handleAiBrainstorm = async () => {
    if (!roughIdea.trim()) {
      setErrorMsg('請先輸入至少一句話的靈感或構思');
      return;
    }
    setGenerating(true);
    setErrorMsg('');
    try {
      const result = await api.generateOutline({
        rough_idea: roughIdea,
        genre: preferredGenre || novel.genre,
        tone: novel.tone,
        title: novel.title !== '未命名小說' && novel.title !== '未命名遊戲專案' ? novel.title : undefined,
        global_style_guide: novel.global_style_guide,
      });

      onChange({
        ...novel,
        title: result.title || novel.title,
        genre: result.genre || novel.genre,
        tone: result.tone || novel.tone,
        world_background: result.world_background || novel.world_background,
        main_plot: result.main_plot || novel.main_plot,
      });
      setIsAiModalOpen(false);
      setRoughIdea('');
    } catch (e: any) {
      setErrorMsg(e.message || 'AI 發想失敗，請確認 AI 設定中的 API Key 是否正確');
    } finally {
      setGenerating(false);
    }
  };

  // 頂層遊戲規則設定狀態處理 (第一欄、第二欄、第三欄、第四欄)
  const gameRules: GameRulesConfig = novel.game_rules || {
    rules_text: '',
    dialog_choices: [3],
    allow_custom_input: true,
    strict_rule_enforcement: true,
  };

  const handleGameRulesChange = (partial: Partial<GameRulesConfig>) => {
    const updatedRules: GameRulesConfig = {
      ...gameRules,
      ...partial,
    };
    onChange({
      ...novel,
      game_rules: updatedRules,
    });
  };

  const handleToggleDialogChoice = (choice: number) => {
    const currentChoices = gameRules.dialog_choices || [];
    let newChoices: number[];
    if (currentChoices.includes(choice)) {
      newChoices = currentChoices.filter(c => c !== choice);
    } else {
      newChoices = [...currentChoices, choice].sort((a, b) => a - b);
    }
    handleGameRulesChange({ dialog_choices: newChoices });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in duration-200">
      {/* 標題橫幅 */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border shadow-xl ${
        isGame 
          ? 'bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-900 border-emerald-500/30'
          : 'bg-gradient-to-r from-purple-900/30 via-slate-900/60 to-slate-900 border-purple-500/20'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
              isGame
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
            }`}>
              第 1 層
            </span>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              {isGame ? (
                <>
                  <Gamepad2 className="w-5 h-5 text-emerald-400" />
                  <span>遊戲主體與規則設定</span>
                </>
              ) : (
                <span>小說主體設定</span>
              )}
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            {isGame 
              ? '定義遊戲名稱、世界觀舞台、頂層遊戲規則與核心主線目標。所有設定皆可隨時自訂或透過 AI 輔助發想。'
              : '定義小說名稱、風格基調與核心主線架構。所有設定皆可隨時手寫或透過 AI 輔助發想。'}
          </p>
        </div>

        <button
          onClick={() => setIsAiModalOpen(true)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-xs shadow-lg transition shrink-0 ${
            isGame
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/20'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/20'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{isGame ? 'AI 靈感激盪遊戲設定' : 'AI 靈感激盪大綱'}</span>
        </button>
      </div>

      {/* 🌟 遊戲版專屬：在第一層的上層新增【遊戲規則定義】面板 (4 欄位) 🌟 */}
      {isGame && (
        <section className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/70 to-emerald-950/25 border-2 border-emerald-500/35 shadow-2xl space-y-5 animate-in fade-in zoom-in-98 duration-200">
          {/* 面板標題區 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-100 tracking-wide flex items-center gap-1.5">
                    <span>頂層遊戲規則定義</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      第 1 層・頂部機制
                    </span>
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  自訂底層法則、每輪對話選項數、玩家自由度與防暴走因果約束機制
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/70 border border-emerald-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>遊戲規則介面已就緒</span>
              </span>
            </div>
          </div>

          {/* 四欄網格佈局 */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* 第一欄：自行輸入文字定義遊戲規則 */}
            <div className="flex flex-col p-4 rounded-xl bg-slate-950/75 border border-slate-800/90 hover:border-emerald-500/40 transition">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ScrollText className="w-4 h-4 text-emerald-400" />
                  <span>第一欄：自訂遊戲規則</span>
                </label>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">文字定義</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                自訂此遊戲的通用規則與底層約束（如：生命判定、能量消耗、禁止事項或勝敗條件）：
              </p>
              <textarea
                rows={7}
                value={gameRules.rules_text}
                onChange={(e) => handleGameRulesChange({ rules_text: e.target.value })}
                placeholder="例如：&#10;1. 角色生命歸零即判定任務失敗。&#10;2. 每次時空跳躍消耗 1 枚反重力晶核。&#10;3. 行動受物理與因果律限制，嚴禁憑空變出超自然神器。"
                className="w-full flex-1 px-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none font-mono leading-relaxed"
              />
            </div>

            {/* 第二欄：每回合會出現幾個對話選擇 (0, 3, 4, 5 可勾選) */}
            <div className="flex flex-col p-4 rounded-xl bg-slate-950/75 border border-slate-800/90 hover:border-teal-500/40 transition">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <GitFork className="w-4 h-4 text-teal-400" />
                  <span>第二欄：對話選擇數量</span>
                </label>
                <span className="text-[10px] font-mono text-teal-400/90 bg-teal-950/50 px-1.5 py-0.5 rounded border border-teal-500/30">可勾選</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                勾選每輪對話出現的選項數，之後對話將依勾選項目出現劇情分歧：
              </p>
              <div className="space-y-2 flex-1 flex flex-col justify-between">
                {[
                  { val: 0, label: '0 個選項', desc: '純敘事推進，無分支選項' },
                  { val: 3, label: '3 個選項', desc: '經典三選一，平衡分支策略 (推薦)' },
                  { val: 4, label: '4 個選項', desc: '四向策略決策，探索深度提升' },
                  { val: 5, label: '5 個選項', desc: '五重命運抉擇，高自由度展開' },
                ].map((item) => {
                  const isChecked = (gameRules.dialog_choices || []).includes(item.val);
                  return (
                    <label
                      key={item.val}
                      className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition select-none ${
                        isChecked
                          ? 'bg-teal-950/30 border-teal-500/60 text-teal-200'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleDialogChoice(item.val)}
                        className="mt-0.5 rounded border-slate-700 text-teal-500 focus:ring-teal-500/20 bg-slate-950"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${isChecked ? 'text-teal-300 font-bold' : 'text-slate-300'}`}>
                            {item.label}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">{item.val} 項</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">{item.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 第三欄：勾選是否可以由玩家自行輸入劇情分歧 */}
            <div className="flex flex-col p-4 rounded-xl bg-slate-950/75 border border-slate-800/90 hover:border-cyan-500/40 transition">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <MessageSquarePlus className="w-4 h-4 text-cyan-400" />
                  <span>第三欄：玩家自訂輸入分歧</span>
                </label>
                <span className="text-[10px] font-mono text-cyan-400/90 bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-500/30">自填開關</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                勾選是否允許玩家在系統預設選項之外，自填行動或台詞推進劇情：
              </p>
              <div className="space-y-2.5 flex-1 flex flex-col justify-start">
                <label
                  onClick={() => handleGameRulesChange({ allow_custom_input: true })}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition select-none ${
                    gameRules.allow_custom_input
                      ? 'bg-cyan-950/30 border-cyan-500/60 text-cyan-200'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="custom_input_mode"
                    checked={gameRules.allow_custom_input === true}
                    onChange={() => handleGameRulesChange({ allow_custom_input: true })}
                    className="mt-0.5 text-cyan-500 focus:ring-cyan-500/20 bg-slate-950"
                  />
                  <div>
                    <div className="text-xs font-bold text-cyan-300">
                      允許玩家自行輸入劇情分歧
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                      開放文字輸入框，玩家可自由鍵入自創行為或反詰台詞推進情節。
                    </p>
                  </div>
                </label>

                <label
                  onClick={() => handleGameRulesChange({ allow_custom_input: false })}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition select-none ${
                    !gameRules.allow_custom_input
                      ? 'bg-cyan-950/30 border-cyan-500/60 text-cyan-200'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="custom_input_mode"
                    checked={gameRules.allow_custom_input === false}
                    onChange={() => handleGameRulesChange({ allow_custom_input: false })}
                    className="mt-0.5 text-cyan-500 focus:ring-cyan-500/20 bg-slate-950"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-300">
                      僅限點選系統預設選項
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                      封閉型選擇模式，嚴格限制玩家僅能從上述系統選項中做決策。
                    </p>
                  </div>
                </label>

                <div className="mt-auto pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">輸入許可：</span>
                    <span className={`font-semibold ${gameRules.allow_custom_input ? 'text-cyan-400' : 'text-slate-400'}`}>
                      {gameRules.allow_custom_input ? '✅ 開放玩家自訂分歧' : '🔒 僅限預設選項'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 第四欄：勾選劇情可自由發展或是有強硬遊戲規則 */}
            <div className="flex flex-col p-4 rounded-xl bg-slate-950/75 border border-slate-800/90 hover:border-purple-500/40 transition">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-purple-400" />
                  <span>第四欄：劇情發展規則約束</span>
                </label>
                <span className="text-[10px] font-mono text-purple-400/90 bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-500/30">防暴走</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                勾選劇情可自由發展或是有強硬規則（防亂輸入無敵反攻）：
              </p>
              <div className="space-y-2.5 flex-1 flex flex-col justify-start">
                <label
                  onClick={() => handleGameRulesChange({ strict_rule_enforcement: true })}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition select-none ${
                    gameRules.strict_rule_enforcement
                      ? 'bg-purple-950/30 border-purple-500/60 text-purple-200'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="rule_enforcement_mode"
                    checked={gameRules.strict_rule_enforcement === true}
                    onChange={() => handleGameRulesChange({ strict_rule_enforcement: true })}
                    className="mt-0.5 text-purple-500 focus:ring-purple-500/20 bg-slate-950"
                  />
                  <div>
                    <div className="text-xs font-bold text-purple-300">
                      強硬遊戲規則（防暴走）
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                      即使玩家亂輸入，也不會出現絕地大反攻的無敵劇情；AI 嚴格判定失敗或合理懲罰。
                    </p>
                  </div>
                </label>

                <label
                  onClick={() => handleGameRulesChange({ strict_rule_enforcement: false })}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition select-none ${
                    !gameRules.strict_rule_enforcement
                      ? 'bg-purple-950/30 border-purple-500/60 text-purple-200'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="rule_enforcement_mode"
                    checked={gameRules.strict_rule_enforcement === false}
                    onChange={() => handleGameRulesChange({ strict_rule_enforcement: false })}
                    className="mt-0.5 text-purple-500 focus:ring-purple-500/20 bg-slate-950"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-300">
                      劇情可自由發展（無約束）
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                      順應玩家任何天馬行空的意向展開，情節發展極具自由度，不強制套用硬性失敗法則。
                    </p>
                  </div>
                </label>

                <div className="mt-auto pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">約束模式：</span>
                    <span className={`font-semibold ${gameRules.strict_rule_enforcement ? 'text-purple-400' : 'text-slate-400'}`}>
                      {gameRules.strict_rule_enforcement ? '🛡️ 強硬規則約束中' : '✨ 自由發展模式'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 基礎資訊與封面設定網格 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 左側：自訂立體封面卡片 (佔 4 欄) */}
        <div className="lg:col-span-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-4 shadow-lg">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-pink-400" />
                <span>{isGame ? '遊戲自訂封面/海報' : '小說自訂封面'}</span>
              </label>
              {novel.cover_url && (
                <button
                  type="button"
                  onClick={() => onChange({ ...novel, cover_url: '' })}
                  className="text-[11px] text-slate-500 hover:text-rose-400 flex items-center gap-1 transition"
                  title="移除自訂封面"
                >
                  <Trash2 className="w-3 h-3" /> 移除
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {isGame ? '此封面將展示於遊戲專案卡片與預覽展台。' : '此封面將展示於前台閱讀首頁與書庫目錄中。'}
            </p>
          </div>

          {/* 立體書封預覽 */}
          <div className={`relative mx-auto w-36 h-52 sm:w-44 sm:h-64 rounded-xl overflow-hidden border shadow-xl flex items-center justify-center group ${
            isGame
              ? 'bg-gradient-to-tr from-emerald-950/60 via-teal-950/40 to-slate-950 border-emerald-500/30 shadow-emerald-950/40'
              : 'bg-gradient-to-tr from-purple-900/60 via-indigo-900/40 to-slate-950 border-purple-500/30 shadow-purple-950/40'
          }`}>
            {novel.cover_url ? (
              <img
                src={novel.cover_url}
                alt={novel.title}
                className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="p-4 text-center space-y-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto ${
                  isGame ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/20 text-purple-400'
                }`}>
                  <ImageIcon className="w-5 h-5" />
                </div>
                <p className="text-[11px] font-bold text-slate-300 line-clamp-2">{novel.title}</p>
                <p className="text-[10px] text-slate-500">{novel.genre} · {novel.tone}</p>
                <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                  尚未設定封面
                </span>
              </div>
            )}

            {/* 書脊立體光影 (仿實體裝幀) */}
            <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/40 to-transparent pointer-events-none" />
          </div>

          {/* 上傳與網址設定按鈕列 */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <input
              type="file"
              ref={coverFileInputRef}
              onChange={handleCoverFileUpload}
              accept="image/*"
              className="hidden"
            />
            
            <button
              type="button"
              onClick={() => coverFileInputRef.current?.click()}
              disabled={isUploadingCover}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50 border ${
                isGame
                  ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
                  : 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border-purple-500/40'
              }`}
            >
              {isUploadingCover ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>{isUploadingCover ? '上傳中...' : '本地上傳圖片'}</span>
            </button>

            {/* 外部圖片 URL 快速填寫 */}
            <div className="relative">
              <LinkIcon className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={novel.cover_url || ''}
                onChange={(e) => onChange({ ...novel, cover_url: e.target.value.trim() })}
                placeholder="或直接貼上圖片 URL..."
                className="w-full pl-7 pr-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* 右側：名稱、題材類型、風格基調 (佔 8 欄) */}
        <div className="lg:col-span-8 space-y-4 flex flex-col justify-between">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 shadow-lg">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <BookOpen className={`w-3.5 h-3.5 ${isGame ? 'text-emerald-400' : 'text-purple-400'}`} />
              <span>{isGame ? '遊戲專案名稱 *' : '小說名稱 *'}</span>
            </label>
            <input
              type="text"
              value={novel.title}
              onChange={(e) => onChange({ ...novel, title: e.target.value })}
              placeholder={isGame ? "請輸入遊戲名稱" : "請輸入小說名稱"}
              className={`w-full px-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-base font-bold text-slate-100 focus:outline-none transition ${
                isGame ? 'focus:border-emerald-500' : 'focus:border-purple-500'
              }`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 題材類型 */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 shadow-lg">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isGame ? '遊戲類型' : '題材類型'}</span>
              </label>
              <input
                type="text"
                value={novel.genre}
                onChange={(e) => onChange({ ...novel, genre: e.target.value })}
                placeholder={isGame ? "例如：文字冒險RPG、互動視覺小說" : "例如：奇幻蒸氣龐克、東方玄幻、懸疑解謎"}
                className={`w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 focus:outline-none transition ${
                  isGame ? 'focus:border-emerald-500' : 'focus:border-purple-500'
                }`}
              />
            </div>

            {/* 風格基調 */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 shadow-lg">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5 text-pink-400" />
                <span>{isGame ? '遊戲風格基調' : '風格基調'}</span>
              </label>
              <input
                type="text"
                value={novel.tone}
                onChange={(e) => onChange({ ...novel, tone: e.target.value })}
                placeholder={isGame ? "例如：時空穿梭、因果律抉擇、情感冒險" : "例如：熱血冒險、暗黑懸疑、輕鬆幽默"}
                className={`w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 focus:outline-none transition ${
                  isGame ? 'focus:border-emerald-500' : 'focus:border-purple-500'
                }`}
              />
            </div>
          </div>

          <div className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
            isGame
              ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300'
              : 'bg-purple-950/20 border-purple-500/20 text-purple-300'
          }`}>
            <span className="text-base">💡</span>
            <span>
              {isGame 
                ? '提示：設定好遊戲名稱、頂層規則與世界觀後，即可依序設定世界場景、NPC與開局啟始劇情！'
                : '設定好書名、基調與封面後，點擊右上角「📖 切換至前台閱讀」可立即預覽讀者看到的實體書效果！'}
            </span>
          </div>
        </div>
      </div>

      {/* ★★★ 全域 AI 文字風格定義框 (最高優先級) ★★★ */}
      <div className={`p-6 rounded-2xl bg-gradient-to-br from-slate-950/40 via-slate-900/90 to-slate-900 border-2 shadow-xl space-y-4 ${
        isGame ? 'border-teal-500/40 shadow-teal-950/20' : 'border-purple-500/40 shadow-purple-950/20'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${
              isGame ? 'bg-teal-500/20 text-teal-300 border-teal-500/30' : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
            }`}>
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">全域 AI 文字風格與行文規範</h3>
                <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-amber-300 border border-amber-500/40 shadow-xs">
                  <Flame className="w-3 h-3 text-amber-400 fill-amber-400" /> 最高優先度
                </span>
                <span className="text-[11px] text-slate-500 font-medium">（選填）</span>
              </div>
              <p className="text-[11px] text-slate-400">
                此規範擁有最高約束力，直接主導整體世界觀、場景細節、NPC/角色描繪與所有章節正文的生成風格。
              </p>
            </div>
          </div>

          {novel.global_style_guide && (
            <button
              type="button"
              onClick={() => onChange({ ...novel, global_style_guide: '' })}
              className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition self-end sm:self-auto"
            >
              <RotateCcw className="w-3 h-3" /> 清空風格定義
            </button>
          )}
        </div>

        {/* 快速靈感標籤 */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <span>💡 快捷預設風格範例 (點擊直接套用)：</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              {
                label: '🎮 電影級互動RPG感',
                style: '電影感臨場體驗，對話具備強烈性格色彩，關鍵選項與分支抉擇富有戲劇張力；場景渲染科技神秘質感。'
              },
              {
                label: '🍶 古龍短句冷峻風',
                style: '仿古龍短句冷峻白描風，語言精煉有力，注重氛圍與心理留白，多用環境襯托殺氣，切忌冗長說教。'
              },
              {
                label: '⚡ 現代俐落爽快風',
                style: '現代快節奏俐落文風，語言通俗生動，衝突密集，動作描寫拳拳到肉，對白極具角色張力，推進絕不拖沓。'
              },
              {
                label: '📜 半文半白典雅古風',
                style: '半文半白典雅古風，辭藻講究，句式對仗舒緩，融入詩詞意象與古典哲思，重意境氛圍渲染。'
              },
              {
                label: '🔮 克蘇魯冷冽詭譎',
                style: '冷冽克制的客觀觀察筆觸，著重微觀五感細節（黏稠、潮濕、暗影），烘托不可名狀的壓抑與未知恐懼。'
              },
              {
                label: '🌸 輕小說明快幽默',
                style: '日系輕小說明快語調，多心理活動與幽默吐槽，角色對話生動俏皮，節奏明朗鮮活。'
              }
            ].map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onChange({ ...novel, global_style_guide: preset.style })}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-700/60 hover:border-emerald-500/60 text-slate-300 hover:text-emerald-200 transition"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          rows={3}
          value={novel.global_style_guide || ''}
          onChange={(e) => onChange({ ...novel, global_style_guide: e.target.value })}
          placeholder="選填：自訂最高優先級 AI 文字風格。例如：『電影感臨場體驗，對話具備強烈性格色彩，分支抉擇富有戲劇張力』..."
          className={`w-full px-4 py-3 bg-slate-950 border rounded-xl text-sm leading-relaxed focus:outline-none transition resize-y ${
            isGame
              ? 'border-teal-500/30 text-teal-100 placeholder-slate-600 focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30'
              : 'border-purple-500/30 text-purple-100 placeholder-slate-600 focus:border-purple-400 focus:ring-1 focus:ring-purple-400/30'
          }`}
        />
      </div>

      {/* 世界觀設定 */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
        <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-emerald-400" />
          <span>{isGame ? '遊戲世界觀概述與舞台背景' : '世界觀背景概述'}</span>
        </label>
        <p className="text-xs text-slate-400">
          說明這個世界的物理法則、科技水平、歷史大事件或超自然力量來源。
        </p>
        <textarea
          rows={4}
          value={novel.world_background}
          onChange={(e) => onChange({ ...novel, world_background: e.target.value })}
          placeholder={isGame ? "例如：世界由量子因果律網絡維持穩定，時空穿梭裝置由反重力晶核與虛數神經連接器驅動..." : "例如：世界分為上下兩層，千年前遭遇以太風暴後，人類依賴浮空引擎建立天穹群島..."}
          className={`w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 leading-relaxed focus:outline-none transition resize-y ${
            isGame ? 'focus:border-emerald-500' : 'focus:border-purple-500'
          }`}
        />
      </div>

      {/* 主要劇情架構 / 主線目標 */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{isGame ? '核心主線任務與目標走向' : '主要劇情架構 / 核心主線'}</span>
          </label>
          <span className="text-xs text-slate-500">{isGame ? '（AI 輔助生成劇情與分歧的核心依據）' : '（AI 生成章節的核心依據）'}</span>
        </div>
        <p className="text-xs text-slate-400">
          {isGame ? '描述遊戲的主線目標、核心衝突、危機事件與預期終局走向。' : '描述全書的主線走向：開局危機、主角目標、敵對阻礙、命運高潮與預期結局。'}
        </p>
        <textarea
          rows={7}
          value={novel.main_plot}
          onChange={(e) => onChange({ ...novel, main_plot: e.target.value })}
          placeholder={isGame ? "例如：身為第七執行官的主角必須穿越至七個不同的歷史分歧點，修復時空因果線，並揭發觀測所所長重塑人類記憶的真相..." : "例如：在浮空城以太能源即將枯竭之際，主角發現了一份記載古老地下遺跡的航海圖..."}
          className={`w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 leading-relaxed focus:outline-none transition resize-y ${
            isGame ? 'focus:border-emerald-500' : 'focus:border-purple-500'
          }`}
        />
      </div>

      {/* AI 發想彈窗 */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className={`w-5 h-5 ${isGame ? 'text-emerald-400' : 'text-purple-400'}`} />
                <h3 className="font-bold text-slate-100">{isGame ? 'AI 靈感激盪遊戲設定' : 'AI 靈感激盪'}</h3>
              </div>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              只要隨手寫下一句話、幾個關鍵字或任何突發奇想，AI 將為您自動擴展出世界觀與故事主線。
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  您的初步想法 / 核心梗概
                </label>
                <textarea
                  rows={3}
                  value={roughIdea}
                  onChange={(e) => setRoughIdea(e.target.value)}
                  placeholder={isGame ? "例如：一個能看見他人死亡倒數的駭客，在虛擬實境都市中發現世界正在被格式化..." : "例如：一個被逐出師門的煉丹師，在現代都市開深夜藥膳食堂，意外治好了吸血鬼貴族..."}
                  className={`w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 focus:outline-none transition ${
                    isGame ? 'focus:border-emerald-500' : 'focus:border-purple-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  期望題材 (選填)
                </label>
                <input
                  type="text"
                  value={preferredGenre}
                  onChange={(e) => setPreferredGenre(e.target.value)}
                  placeholder={isGame ? "例如：日系科幻冒險、地牢探索RPG" : "例如：都市奇幻、賽博修真、星際懸疑"}
                  className={`w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 focus:outline-none transition ${
                    isGame ? 'focus:border-emerald-500' : 'focus:border-purple-500'
                  }`}
                />
              </div>

              {errorMsg && (
                <div className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                  {errorMsg}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                disabled={generating}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 rounded-xl transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleAiBrainstorm}
                disabled={generating}
                className={`flex items-center gap-2 px-5 py-2 text-xs font-medium text-white rounded-xl shadow-lg transition disabled:opacity-50 ${
                  isGame
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                    : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20'
                }`}
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? 'AI 構思中...' : '生成並套用'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
