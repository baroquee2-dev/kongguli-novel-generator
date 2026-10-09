import React, { useState } from 'react';
import type { GameProject, Chapter, GameChoiceOption } from '../types';
import { 
  Gamepad2, BookOpen, GitFork, Plus, Trash2, MapPin, Users,
  ShieldCheck, Loader2, Info, CornerDownRight, CheckCircle2,
  FileText, Wand2, Compass, AlertTriangle
} from 'lucide-react';
import { api } from '../api/client';

interface Props {
  game: GameProject;
  onChange: (updated: GameProject) => void;
}

export const GameLevelTab: React.FC<Props> = ({ game, onChange }) => {
  // 遊戲採用單一啟始劇情設定 (非關卡制)
  const initialStory: Chapter = game.chapters && game.chapters.length > 0 
    ? game.chapters[0] 
    : {
        id: `chap-opening`,
        chapter_number: 1,
        title: '序章：命運的破曉',
        outline: '警報大作，基地遭遇突襲，主角面臨最初的世界線危機抉擇。',
        selected_location_ids: [],
        selected_sub_location_ids: [],
        selected_character_ids: [],
        content: '',
        word_count: 0,
        starting_plot: '',
        starting_options: [
          { id: 'opt-1', text: '衝向中央控制台，強行重載核心信標', hint: '承擔超載風險，嘗試錨定因果線' },
          { id: 'opt-2', text: '拔出武器尋求掩體，優先殲滅入侵敵軍', hint: '確保人身安全，但耗費寶貴時間' },
          { id: 'opt-3', text: '呼叫同伴遠程支援，引爆上方蒸氣管道阻敵', hint: '藉助環境阻敵，需要彼此高度信任' }
        ]
      };

  const startingOptions: GameChoiceOption[] = initialStory.starting_options && initialStory.starting_options.length > 0
    ? initialStory.starting_options
    : [
        { id: `opt-${Date.now()}-1`, text: '選擇 A：迎面迎擊突發危機', hint: '勇氣與正面突破' },
        { id: `opt-${Date.now()}-2`, text: '選擇 B：保持冷靜觀察環境尋找退路', hint: '謹慎與智力策略' },
        { id: `opt-${Date.now()}-3`, text: '選擇 C：嘗試與神秘聲音展開交涉', hint: '談判與劇情秘密挖掘' }
      ];

  const startingPlot: string = initialStory.starting_plot !== undefined 
    ? initialStory.starting_plot 
    : (initialStory.content || '');

  // 更新單一啟始劇情資料並同步觸發 onChange
  const handleUpdateStory = (updatedFields: Partial<Chapter>) => {
    const updatedStory: Chapter = {
      ...initialStory,
      ...updatedFields,
      chapter_number: 1,
      // 同步 content 與 word_count，確保其他系統相容
      content: updatedFields.starting_plot !== undefined ? updatedFields.starting_plot : (initialStory.starting_plot || initialStory.content),
      word_count: (updatedFields.starting_plot !== undefined ? updatedFields.starting_plot : (initialStory.starting_plot || initialStory.content)).replace(/\s/g, '').length
    };

    const remainingChapters = game.chapters ? game.chapters.slice(1) : [];
    onChange({
      ...game,
      chapters: [updatedStory, ...remainingChapters]
    });
  };

  // 第 1 頁「對話選擇數量」規則限制
  const gameRules = game.game_rules;
  const rawChoices = (gameRules?.dialog_choices || []).filter(c => c > 0);
  const maxChoiceLimit = rawChoices.length > 0 
    ? (rawChoices.length === 1 ? rawChoices[0] : Math.max(...rawChoices)) 
    : 3;
  const isMaxOptionsReached = startingOptions.length >= maxChoiceLimit;
  const isOptionsOverLimit = startingOptions.length > maxChoiceLimit;
  const targetChoicesCount = rawChoices.length > 0 ? rawChoices.join(' / ') : '3';

  // 啟始選項增刪改
  const handleAddOption = () => {
    if (startingOptions.length >= maxChoiceLimit) {
      alert(`已達第 1 頁設定的選項上限（${maxChoiceLimit} 個選項），無法再增加！如需增加請前往第 1 頁調整「對話選擇數量」。`);
      return;
    }
    const nextIdx = startingOptions.length + 1;
    const newOpt: GameChoiceOption = {
      id: `opt-${Date.now()}-${nextIdx}`,
      text: `新啟始選項 ${nextIdx}`,
      hint: '自訂分歧導向'
    };
    handleUpdateStory({
      starting_options: [...startingOptions, newOpt]
    });
  };

  const handleUpdateOption = (index: number, partial: Partial<GameChoiceOption>) => {
    const newOptions = [...startingOptions];
    newOptions[index] = { ...newOptions[index], ...partial };
    handleUpdateStory({
      starting_options: newOptions
    });
  };

  const handleDeleteOption = (index: number) => {
    if (startingOptions.length <= 1) {
      alert('請至少保留一個啟始選項供玩家做決策！');
      return;
    }
    const newOptions = startingOptions.filter((_, i) => i !== index);
    handleUpdateStory({
      starting_options: newOptions
    });
  };

  // AI 輔助發想開局劇情狀態
  const [isAiBrainstorming, setIsAiBrainstorming] = useState(false);

  const handleAiBrainstormStartingPlot = async () => {
    setIsAiBrainstorming(true);
    try {
      const locNames = game.locations
        .filter(l => initialStory.selected_location_ids.includes(l.id))
        .map(l => l.name)
        .join('、');
      const charNames = game.characters
        .filter(c => initialStory.selected_character_ids.includes(c.id))
        .map(c => c.name)
        .join('、');

      const customPrompt = `請為遊戲《${game.title}》發想一段極具沉浸感、臨場感與危機張力的開局【啟始劇情】。\n` +
        `遊戲題材：${game.genre} | 基調：${game.tone}\n` +
        `主線目標：${game.main_plot}\n` +
        `開局標題：${initialStory.title}\n` +
        `情境目標：${initialStory.outline}\n` +
        `${locNames ? `發生地點：${locNames}\n` : ''}` +
        `${charNames ? `登場NPC：${charNames}\n` : ''}` +
        `要求：字數約 350-500 字，生動刻畫開局第一幕的突發衝突，結尾停在即將做出關鍵抉擇的瞬間。`;

      const res = await api.generateOutline({
        rough_idea: customPrompt,
        genre: game.genre,
        tone: game.tone,
        title: game.title,
        global_style_guide: game.global_style_guide
      });

      if (res && res.main_plot) {
        handleUpdateStory({
          starting_plot: res.main_plot
        });
      }
    } catch (err: any) {
      alert(err.message || 'AI 發想開局失敗，請確認 AI 設定');
    } finally {
      setIsAiBrainstorming(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 animate-in fade-in duration-200">
      {/* 頂部橫幅：單一啟始劇情設定 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-teal-950/40 via-slate-900/80 to-slate-900 border border-teal-500/30 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
              第 5 層・啟始設定
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>單一啟始情境</span>
            </span>
            <h1 className="text-xl font-bold text-slate-100">遊戲啟始劇情與選項設定</h1>
          </div>
          <p className="text-xs text-slate-400">
            設定遊戲開局的單一啟始劇情，以及玩家首先面臨的第一組初始命運選項分歧。
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-teal-300/90 bg-teal-950/60 border border-teal-500/30 px-3 py-1.5 rounded-xl font-mono flex items-center gap-1.5 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
            <span>開局啟始設定已就緒</span>
          </span>
        </div>
      </div>

      {/* 頂層規則即時對照提示列 (連動第 1 層設定) */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-bold text-slate-200">第一層遊戲規則同步：</span>
          <span className="text-slate-400">
            {gameRules?.rules_text ? `「${gameRules.rules_text.slice(0, 36)}...」` : '已套用核心規則'}
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="px-2 py-0.5 rounded bg-slate-800 text-teal-300 border border-slate-700">
            🎯 預設選項數: {targetChoicesCount} 個
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
            ⌨️ 自由輸入: {gameRules?.allow_custom_input ? '開放自填' : '僅限選項'}
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-purple-300 border border-slate-700">
            🛡️ 約束: {gameRules?.strict_rule_enforcement ? '強硬防暴走' : '自由發展'}
          </span>
        </div>
      </div>

      {/* 開局基礎情境資訊卡片 (標題、目標與場景NPC關聯) */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 開局標題 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-teal-400" />
              <span>開局情境標題 *</span>
            </label>
            <input
              type="text"
              value={initialStory.title}
              onChange={(e) => handleUpdateStory({ title: e.target.value })}
              placeholder="例如：序章・紅光警報下的第 0 號分歧點"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm font-bold text-slate-100 focus:outline-none focus:border-teal-500 transition"
            />
          </div>

          {/* 核心目標與衝突 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>開局核心衝突與目標</span>
            </label>
            <input
              type="text"
              value={initialStory.outline}
              onChange={(e) => handleUpdateStory({ outline: e.target.value })}
              placeholder="例如：因果控制室警報大作，變動率跌落臨界點，主角需在時空崩解前做出關鍵抉擇"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-teal-500 transition"
            />
          </div>
        </div>

        {/* 登場地點與角色關聯選取器 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
          {/* 發生地點 */}
          <div>
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1 mb-1.5">
              <MapPin className="w-3 h-3 text-emerald-400" />
              <span>開局發生場景 (點擊勾選)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {game.locations.length > 0 ? (
                game.locations.map(loc => {
                  const isSelected = initialStory.selected_location_ids.includes(loc.id);
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => {
                        const newIds = isSelected
                          ? initialStory.selected_location_ids.filter(id => id !== loc.id)
                          : [...initialStory.selected_location_ids, loc.id];
                        handleUpdateStory({ selected_location_ids: newIds });
                      }}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                        isSelected
                          ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300 font-semibold'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {isSelected ? '✓ ' : ''}{loc.name}
                    </button>
                  );
                })
              ) : (
                <span className="text-xs text-slate-500 italic">尚無世界地點，可於第 2 層新增</span>
              )}
            </div>
          </div>

          {/* 登場角色 */}
          <div>
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1 mb-1.5">
              <Users className="w-3 h-3 text-blue-400" />
              <span>開局登場NPC夥伴 (點擊勾選)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {game.characters.length > 0 ? (
                game.characters.map(char => {
                  const isSelected = initialStory.selected_character_ids.includes(char.id);
                  return (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => {
                        const newIds = isSelected
                          ? initialStory.selected_character_ids.filter(id => id !== char.id)
                          : [...initialStory.selected_character_ids, char.id];
                        handleUpdateStory({ selected_character_ids: newIds });
                      }}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                        isSelected
                          ? 'bg-blue-950/40 border-blue-500/60 text-blue-300 font-semibold'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {isSelected ? '✓ ' : ''}{char.name}
                    </button>
                  );
                })
              ) : (
                <span className="text-xs text-slate-500 italic">尚無NPC角色，可於第 3 層新增</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 核心欄位 1：寫入【啟始劇情】 🌟 */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-teal-950/20 border-2 border-teal-500/30 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-500/20 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100">開局啟始劇情 (Opening Narrative)</h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-semibold">
                  正文描述
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                玩家進入遊戲時最先體驗到的世界情境、感官氛圍與突發事件描寫：
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleAiBrainstormStartingPlot}
              disabled={isAiBrainstorming}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-medium text-xs shadow-md shadow-teal-600/20 transition disabled:opacity-50"
            >
              {isAiBrainstorming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              <span>{isAiBrainstorming ? 'AI 構思中...' : 'AI 輔助發想啟始劇情'}</span>
            </button>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-950/70 px-2 py-1 rounded-lg border border-slate-800">
              {startingPlot.replace(/\s/g, '').length} 字
            </span>
          </div>
        </div>

        <textarea
          rows={11}
          value={startingPlot}
          onChange={(e) => handleUpdateStory({ starting_plot: e.target.value })}
          placeholder={`請寫入遊戲的開局啟始劇情...例如：
刺耳的高頻防空警報撕裂了克羅諾斯觀測所的死寂。
全息中樞環上的數值正以恐怖的速度向下跌落——「0.4819%... 0.3120%...」紅芒將第七因果控制室映照得猶如血海。
你從冰冷的冷卻液中猛然嗆咳著甦醒，眼前的量子回環儀正發出悲鳴般的過載震顫。
神崎綾乃纖細的手指在虛擬光鍵上疾風般敲擊，及肩深藍短髮隨氣流飛舞：「執行官！主因果線正在崩潰！有人切斷了世界線鏈路！」
防爆閘門外，重型發條傀儡的沉重腳步聲與電磁刃嗡鳴正急速逼近……`}
          className="w-full px-4 py-3 bg-slate-950 border border-teal-500/30 rounded-xl text-sm text-slate-100 placeholder-slate-600 leading-relaxed focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/20 font-mono transition resize-y"
        />
      </div>

      {/* 🌟 核心欄位 2：定義【啟始選項】 🌟 */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-emerald-950/20 border-2 border-emerald-500/30 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <GitFork className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-slate-100">開局啟始選項 (Initial Choices)</h2>
                <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border font-bold flex items-center gap-1.5 shadow-sm ${
                  isOptionsOverLimit
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : isMaxOptionsReached
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  <span>項目上限：{startingOptions.length} / {maxChoiceLimit} 項</span>
                  <span className="text-[10px] font-normal text-slate-400">（連動第 1 頁規則）</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                當啟始劇情敘述完畢後，提供給玩家做出的第一組行動決策分歧項（選項總數受第 1 頁對話選擇數量限制，目前上限 {maxChoiceLimit} 項）：
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddOption}
              disabled={isMaxOptionsReached}
              title={isMaxOptionsReached ? `已達第 1 頁設定的上限 (${maxChoiceLimit} 項)` : '新增啟始選項'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                isMaxOptionsReached
                  ? 'bg-slate-800/80 text-slate-500 border-slate-700/60 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/40 shadow-sm'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isMaxOptionsReached ? `已達上限 (${maxChoiceLimit} 項)` : '新增啟始選項'}</span>
            </button>
          </div>
        </div>

        {/* 若選項超過上限，顯示警示列 */}
        {isOptionsOverLimit && (
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                目前啟始選項數（{startingOptions.length} 項）已超出第 1 頁設定的上限（{maxChoiceLimit} 項）。建議點擊右側垃圾桶刪除多餘選項，以確保遊戲規則一致。
              </span>
            </div>
          </div>
        )}

        {/* 選項清單 */}
        <div className="space-y-3">
          {startingOptions.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx); // A, B, C, D...
            return (
              <div 
                key={opt.id || idx}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500/40 transition space-y-2.5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center font-bold text-xs font-mono">
                      {letter}
                    </span>
                    <span className="text-xs font-bold text-slate-200">
                      選項 {idx + 1}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteOption(idx)}
                    title="刪除此選項"
                    className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-900 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {/* 選項文字 */}
                  <div>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => handleUpdateOption(idx, { text: e.target.value })}
                      placeholder={`輸入選項 ${letter} 的行動台詞，例如：衝向中央控制台強行重載信標...`}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-100 font-semibold focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  {/* 分歧提示 / 預期後果說明 */}
                  <div className="relative">
                    <CornerDownRight className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={opt.hint || ''}
                      onChange={(e) => handleUpdateOption(idx, { hint: e.target.value })}
                      placeholder="選填：此分歧的後續提示或預期後果（例如：承擔超載風險、優先自保消滅威脅）"
                      className="w-full pl-7 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-slate-400 placeholder-slate-600 focus:outline-none focus:border-emerald-500/70"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部輔助提示 */}
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-400 border-t border-slate-800/80 pt-3">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              已配置 {startingOptions.length} / {maxChoiceLimit} 個啟始選項（依據第 1 頁「對話選擇數量」規則上限）。
            </span>
          </div>

          {isMaxOptionsReached ? (
            <span className="text-amber-400/90 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              已達第 1 頁設定上限 ({maxChoiceLimit} 項)
            </span>
          ) : (
            <button
              type="button"
              onClick={handleAddOption}
              className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition"
            >
              <Plus className="w-3 h-3" /> 新增第 {startingOptions.length + 1} 個選項 (上限 {maxChoiceLimit})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
