import React, { useState } from 'react';
import type { Novel } from '../types';
import { Sparkles, Loader2, BookOpen, Globe2, Compass, PenTool, Wand2, Flame, RotateCcw } from 'lucide-react';
import { api } from '../api/client';

interface Props {
  novel: Novel;
  onChange: (updated: Novel) => void;
}

export const StoryOverviewTab: React.FC<Props> = ({ novel, onChange }) => {
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [roughIdea, setRoughIdea] = useState('');
  const [preferredGenre, setPreferredGenre] = useState('');
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
        title: novel.title !== '未命名小說' ? novel.title : undefined,
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-200">
      {/* 標題橫幅 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-purple-900/30 via-slate-900/60 to-slate-900 border border-purple-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              第 1 層
            </span>
            <h1 className="text-xl font-bold text-slate-100">小說主體設定</h1>
          </div>
          <p className="text-xs text-slate-400">
            定義小說名稱、風格基調與核心主線架構。所有設定皆可隨時手寫或透過 AI 輔助發想。
          </p>
        </div>

        <button
          onClick={() => setIsAiModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs shadow-lg shadow-purple-600/20 transition shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>AI 靈感激盪大綱</span>
        </button>
      </div>

      {/* 基礎資訊網格 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 書名 */}
        <div className="md:col-span-1 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-purple-400" /> 小說名稱
          </label>
          <input
            type="text"
            value={novel.title}
            onChange={(e) => onChange({ ...novel, title: e.target.value })}
            placeholder="請輸入小說名稱"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-purple-500 transition"
          />
        </div>

        {/* 題材類型 */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-indigo-400" /> 題材類型
          </label>
          <input
            type="text"
            value={novel.genre}
            onChange={(e) => onChange({ ...novel, genre: e.target.value })}
            placeholder="例如：奇幻蒸氣龐克、東方玄幻、懸疑解謎"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-purple-500 transition"
          />
        </div>

        {/* 風格基調 */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <PenTool className="w-3.5 h-3.5 text-pink-400" /> 風格基調
          </label>
          <input
            type="text"
            value={novel.tone}
            onChange={(e) => onChange({ ...novel, tone: e.target.value })}
            placeholder="例如：熱血冒險、暗黑懸疑、輕鬆幽默"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-purple-500 transition"
          />
        </div>
      </div>

      {/* ★★★ 全域 AI 文字風格定義框 (最高優先級) ★★★ */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900/90 to-slate-900 border-2 border-purple-500/40 shadow-xl shadow-purple-950/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
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
              <p className="text-[11px] text-purple-300/80">
                此規範擁有最高約束力，直接主導整體小說、地點細節、角色描繪與所有章節正文的生成風格。
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
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950/70 border border-purple-500/20 hover:border-purple-500/60 text-slate-300 hover:text-purple-200 transition"
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
          placeholder="選填：自訂最高優先級 AI 文字風格。例如：『仿古龍短句冷峻風，多留白，禁止說教』或『日系輕小說吐槽幽默風，多內心獨白，節奏明快』或『克蘇魯克制冷冽筆觸，注重不可名狀的氛圍描寫』..."
          className="w-full px-4 py-3 bg-slate-950 border border-purple-500/30 rounded-xl text-sm text-purple-100 placeholder-slate-600 leading-relaxed focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/30 transition resize-y"
        />
      </div>

      {/* 世界觀設定 */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
        <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-emerald-400" /> 世界觀背景概述
        </label>
        <p className="text-xs text-slate-400">
          說明這個世界的物理法則、科技水平、歷史大事件或超自然力量來源。
        </p>
        <textarea
          rows={4}
          value={novel.world_background}
          onChange={(e) => onChange({ ...novel, world_background: e.target.value })}
          placeholder="例如：世界分為上下兩層，千年前遭遇以太風暴後，人類依賴浮空引擎建立天穹群島..."
          className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 leading-relaxed focus:outline-none focus:border-purple-500 transition resize-y"
        />
      </div>

      {/* 主要劇情架構 / 主線 */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" /> 主要劇情架構 / 核心主線
          </label>
          <span className="text-xs text-slate-500">（AI 生成章節的核心依據）</span>
        </div>
        <p className="text-xs text-slate-400">
          描述全書的主線走向：開局危機、主角目標、敵對阻礙、命運高潮與預期結局。
        </p>
        <textarea
          rows={7}
          value={novel.main_plot}
          onChange={(e) => onChange({ ...novel, main_plot: e.target.value })}
          placeholder="例如：在浮空城以太能源即將枯竭之際，主角發現了一份記載古老地下遺跡的航海圖，必須在三個月內深入禁忌下界尋找失落鑰匙..."
          className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 leading-relaxed focus:outline-none focus:border-purple-500 transition resize-y"
        />
      </div>

      {/* AI 發想彈窗 */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-slate-100">AI 靈感激盪</h3>
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
                  placeholder="例如：一個被逐出師門的煉丹師，在現代都市開深夜藥膳食堂，意外治好了吸血鬼貴族..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-purple-500 transition"
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
                  placeholder="例如：都市奇幻、賽博修真、星際懸疑"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-purple-500 transition"
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
                className="flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg shadow-purple-600/20 transition disabled:opacity-50"
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
