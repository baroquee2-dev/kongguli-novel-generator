import React, { useState } from 'react';
import type { Novel, Location, SubLocation } from '../types';
import { 
  MapPin, Plus, Trash2, ChevronRight, ChevronDown, Sparkles, Loader2, Building2, Map 
} from 'lucide-react';
import { api } from '../api/client';

interface Props {
  novel: Novel;
  onChange: (updated: Novel) => void;
}

export const LocationsTab: React.FC<Props> = ({ novel, onChange }) => {
  const [expandedLocIds, setExpandedLocIds] = useState<Record<string, boolean>>({
    [novel.locations[0]?.id]: true
  });
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiCount, setAiCount] = useState(3);
  const [aiHint, setAiHint] = useState('');
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedLocIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 新增大項目
  const handleAddLocation = () => {
    const newId = `loc-${Date.now().toString(36)}`;
    const newLoc: Location = {
      id: newId,
      name: '新地點大項目',
      description: '請輸入此地點的整體地理、氣候或社會環境...',
      sub_locations: []
    };
    onChange({
      ...novel,
      locations: [...novel.locations, newLoc]
    });
    setExpandedLocIds(prev => ({ ...prev, [newId]: true }));
  };

  // 刪除大項目
  const handleDeleteLocation = (locId: string) => {
    onChange({
      ...novel,
      locations: novel.locations.filter(l => l.id !== locId)
    });
  };

  // 更新大項目欄位
  const handleUpdateLocation = (locId: string, fields: Partial<Location>) => {
    onChange({
      ...novel,
      locations: novel.locations.map(l => l.id === locId ? { ...l, ...fields } : l)
    });
  };

  // 新增子細節地點
  const handleAddSubLocation = (locId: string) => {
    const subId = `subloc-${Date.now().toString(36)}`;
    const newSub: SubLocation = {
      id: subId,
      name: '新子場景/建築',
      description: '描述具體設施、內部陳設、特點或可能發生的事件...'
    };
    onChange({
      ...novel,
      locations: novel.locations.map(l => {
        if (l.id === locId) {
          return {
            ...l,
            sub_locations: [...l.sub_locations, newSub]
          };
        }
        return l;
      })
    });
    setExpandedLocIds(prev => ({ ...prev, [locId]: true }));
  };

  // 刪除子細節地點
  const handleDeleteSubLocation = (locId: string, subId: string) => {
    onChange({
      ...novel,
      locations: novel.locations.map(l => {
        if (l.id === locId) {
          return {
            ...l,
            sub_locations: l.sub_locations.filter(s => s.id !== subId)
          };
        }
        return l;
      })
    });
  };

  // 更新子細節地點
  const handleUpdateSubLocation = (locId: string, subId: string, fields: Partial<SubLocation>) => {
    onChange({
      ...novel,
      locations: novel.locations.map(l => {
        if (l.id === locId) {
          return {
            ...l,
            sub_locations: l.sub_locations.map(s => s.id === subId ? { ...s, ...fields } : s)
          };
        }
        return l;
      })
    });
  };

  // AI 發想地點
  const handleAiGenerate = async () => {
    setGenerating(true);
    setErrorMsg('');
    try {
      const generated = await api.generateLocations({
        novel_title: novel.title,
        genre: novel.genre,
        main_plot: novel.main_plot,
        world_background: novel.world_background,
        global_style_guide: novel.global_style_guide,
        count: aiCount,
        hint: aiHint,
      });

      onChange({
        ...novel,
        locations: [...novel.locations, ...generated]
      });

      // 預設展開新產生的地點
      const newExpanded: Record<string, boolean> = { ...expandedLocIds };
      generated.forEach(g => { newExpanded[g.id] = true; });
      setExpandedLocIds(newExpanded);

      setIsAiModalOpen(false);
      setAiHint('');
    } catch (e: any) {
      setErrorMsg(e.message || 'AI 地點發想失敗');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-200">
      {/* 標題橫幅 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-emerald-900/30 via-slate-900/60 to-slate-900 border border-emerald-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              第 2 層
            </span>
            <h1 className="text-xl font-bold text-slate-100">地點與場景系統</h1>
          </div>
          <p className="text-xs text-slate-400">
            樹狀管理故事世界：先建立「地點大項目」（如國家、城市），再為其充實「細節子場景」（如特定建築、辦公室、地下室等）。
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 text-xs font-medium transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>AI 發想地點</span>
          </button>
          <button
            onClick={handleAddLocation}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-lg shadow-emerald-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>新增地點大項目</span>
          </button>
        </div>
      </div>

      {/* 地點列表 */}
      {novel.locations.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 space-y-3">
          <Map className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-medium text-slate-300">尚未建立任何地點</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            您可以手動建立大地點與子場景，或點擊上方「AI 發想地點」讓 AI 根據小說主線為您構思。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {novel.locations.map((loc) => {
            const isExpanded = !!expandedLocIds[loc.id];
            return (
              <div 
                key={loc.id} 
                className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-lg transition"
              >
                {/* 地點大項目標頭 */}
                <div className="p-4 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      onClick={() => toggleExpand(loc.id)}
                      className="p-1 text-slate-400 hover:text-slate-200 transition"
                    >
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <MapPin className="w-4 h-4" />
                    </div>

                    <input
                      type="text"
                      value={loc.name}
                      onChange={(e) => handleUpdateLocation(loc.id, { name: e.target.value })}
                      placeholder="地點名稱（如：艾斯特王國）"
                      className="text-sm font-bold text-slate-100 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-emerald-500 focus:outline-none px-1 py-0.5 transition flex-1 max-w-xs"
                    />

                    <span className="text-[11px] text-slate-500 font-mono">
                      ({loc.sub_locations.length} 個子場景)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAddSubLocation(loc.id)}
                      title="在此地點下新增子場景"
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>新增子場景</span>
                    </button>
                    <button
                      onClick={() => handleDeleteLocation(loc.id)}
                      title="刪除此大地點"
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 展開內容 */}
                {isExpanded && (
                  <div className="p-5 space-y-4">
                    {/* 大地點整體描寫 */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                        <span>大地點環境氛圍與整體背景</span>
                        <span className="text-[11px] text-slate-500">（國家/城市/星系層次）</span>
                      </label>
                      <textarea
                        rows={2}
                        value={loc.description}
                        onChange={(e) => handleUpdateLocation(loc.id, { description: e.target.value })}
                        placeholder="描述這片區域的氣候、地貌、整體勢力或社會風貌..."
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition resize-y"
                      />
                    </div>

                    {/* 細節子地點列表 */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                          附屬細節子地點 ({loc.sub_locations.length})
                        </span>
                        <span className="text-[11px] text-slate-500">
                          如具體的某棟建築、村落、辦公室、密室
                        </span>
                      </div>

                      {loc.sub_locations.length === 0 ? (
                        <div className="text-center py-4 border border-dashed border-slate-800/80 rounded-xl text-slate-500 text-xs">
                          尚無細節子場景，點擊上方「新增子場景」來添加！
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {loc.sub_locations.map((sub) => (
                            <div 
                              key={sub.id} 
                              className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 hover:border-slate-700 transition relative group"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <input
                                  type="text"
                                  value={sub.name}
                                  onChange={(e) => handleUpdateSubLocation(loc.id, sub.id, { name: e.target.value })}
                                  placeholder="子地點名稱"
                                  className="text-xs font-semibold text-emerald-300 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-emerald-500 focus:outline-none px-1 py-0.5 transition flex-1"
                                />
                                <button
                                  onClick={() => handleDeleteSubLocation(loc.id, sub.id)}
                                  className="p-1 text-slate-500 hover:text-rose-400 rounded transition opacity-60 group-hover:opacity-100"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <textarea
                                rows={2}
                                value={sub.description}
                                onChange={(e) => handleUpdateSubLocation(loc.id, sub.id, { description: e.target.value })}
                                placeholder="描述內部細節、氛圍、關鍵特徵..."
                                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500 transition resize-y"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* AI 發想地點彈窗 */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-slate-100">AI 發想地點與場景</h3>
              </div>
              <button onClick={() => setIsAiModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              AI 將根據《{novel.title}》的主線劇情與世界觀，發想包含「大地點」與「具體子場景」的完整場景群。
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  發想數量
                </label>
                <div className="flex gap-2">
                  {[2, 3, 4].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAiCount(c)}
                      className={`px-3 py-1.5 text-xs rounded-xl border transition ${
                        aiCount === c ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {c} 個地點群
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  特定期望或偏好 (選填)
                </label>
                <input
                  type="text"
                  value={aiHint}
                  onChange={(e) => setAiHint(e.target.value)}
                  placeholder="例如：多一些古代遺跡、充滿科技感的秘密實驗室..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
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
                onClick={handleAiGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? 'AI 構思中...' : '生成並加入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
