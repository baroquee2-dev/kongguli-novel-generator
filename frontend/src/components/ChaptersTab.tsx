import React, { useState, useRef } from 'react';
import type { Novel, Chapter, AISettings } from '../types';
import { 
  FileText, Plus, Trash2, Sparkles, Play, Users, MapPin, 
  PenTool, CheckSquare, Square, CornerDownLeft, Sparkle, StopCircle, User, X,
  AlertTriangle, ShieldAlert, KeyRound, RefreshCw, Loader2, Settings,
  Eye, Edit3, BookOpen, Type
} from 'lucide-react';
import { api } from '../api/client';

interface Props {
  novel: Novel;
  onChange: (updated: Novel) => void;
  settings?: AISettings;
  onOpenSettings?: () => void;
}

interface DiagnosticError {
  type: 'refusal' | 'empty' | 'auth' | 'quota' | 'general';
  title: string;
  description: string;
  suggestion: string;
  rawError: string;
  modelName: string;
  provider: string;
}

const diagnoseError = (errMessage: string, providerName: string, modelName: string): DiagnosticError => {
  const msg = errMessage || '';
  if (
    msg.includes('安全') || 
    msg.includes('拒絕') || 
    msg.includes('SAFETY') || 
    msg.includes('BLOCKLIST') || 
    msg.includes('content_filter') || 
    msg.includes('refusal') || 
    msg.includes('PROHIBITED')
  ) {
    return {
      type: 'refusal',
      title: 'AI 安全審查拒答 (Safety / Policy Block)',
      description: 'AI 服務判定本章情節、登場角色或提示詞可能包含敏感或違反其安全政策的描寫，因而拒絕輸出正文。',
      suggestion: '1. 檢查本章大綱與額外指示，軟化或避開血腥、暴力或可能觸發審查的敏感詞彙。\n2. 或前往右上角「AI 模型設定」切換其他審查策略較寬鬆的模型後重新嘗試。',
      rawError: msg,
      modelName,
      provider: providerName
    };
  }

  if (
    msg.includes('空白') || 
    msg.includes('0') || 
    msg.includes('未輸出任何文字') || 
    msg.includes('未接收到任何文字') || 
    msg.includes('未收到任何文字')
  ) {
    return {
      type: 'empty',
      title: 'AI 回傳空白內容 (Empty Output)',
      description: 'API 連線正常回傳，但 AI 模型未產生任何實質的正文字元 (產出字數為 0)。',
      suggestion: '1. 若使用的是推理思考型模型（如部分 Flash Thinking / Preview 版本），可能因當前提示詞結構未輸出正文。\n2. 建議前往設定切換為推薦的主力創作模型（如 gemini-2.5-flash / gemini-2.5-pro 或 gpt-4o）。\n3. 亦可微調大綱、目標字數後再次點擊生成。',
      rawError: msg,
      modelName,
      provider: providerName
    };
  }

  if (
    msg.includes('API Key') || 
    msg.includes('金鑰') || 
    msg.includes('401') || 
    msg.includes('403') || 
    msg.includes('未填寫') || 
    msg.includes('API_KEY_INVALID')
  ) {
    return {
      type: 'auth',
      title: 'API 金鑰無效或未設定 (Authentication Error)',
      description: '無法通過 AI 平台的身份驗證，請求被拒絕。',
      suggestion: '請前往右上角「AI 模型設定」，確認目前所選供應商的 API Key 是否填妥、未過期且擁有正確權限。',
      rawError: msg,
      modelName,
      provider: providerName
    };
  }

  if (
    msg.includes('429') || 
    msg.includes('Quota') || 
    msg.includes('配額') || 
    msg.includes('額度') || 
    msg.includes('rate limit') || 
    msg.includes('ResourceExhausted')
  ) {
    return {
      type: 'quota',
      title: 'API 額度已耗盡或頻率超限 (Rate Limit / Quota Exceeded)',
      description: '已達到 AI 提供商的免費額度上限，或短時間內發送了過多請求。',
      suggestion: '1. 請稍候 1-2 分鐘後再試。\n2. 前往該 AI 平台後台檢查 API 額度或綁定有效帳單。\n3. 切換至其他可用平台（如切換為 Gemini 或自訂模型）。',
      rawError: msg,
      modelName,
      provider: providerName
    };
  }

  return {
    type: 'general',
    title: 'AI 生成過程發生異常 (Generation Error)',
    description: '請求在傳輸或處理過程中中斷。',
    suggestion: '請檢查本機網路連線、後端服務狀態，或點擊下方按鈕重新嘗試。',
    rawError: msg,
    modelName,
    provider: providerName
  };
};

interface SillyTavernToken {
  type: 'dialogue' | 'asterisk' | 'bold' | 'text';
  text: string;
}

// SillyTavern 樣式標記解析器 (支援星號背景/動作描寫、引號台詞橘黃高亮、粗體)
const parseSillyTavernParagraph = (paragraph: string): SillyTavernToken[] => {
  if (!paragraph) return [];
  // 正則表達式依序捕捉：
  // 1. **粗體文字**
  // 2. *星號動作/背景/神態描寫*
  // 3. 角色台詞對話：「...」、『...』、“...”、"..."
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|「[^」]*」|『[^』]*』|“[^”]*”|"(?:[^"\\]|\\.)*")/g;
  const tokens: SillyTavernToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(paragraph)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        text: paragraph.slice(lastIndex, match.index)
      });
    }

    const matchedStr = match[0];
    if (matchedStr.startsWith('**') && matchedStr.endsWith('**')) {
      tokens.push({
        type: 'bold',
        text: matchedStr.slice(2, -2)
      });
    } else if (matchedStr.startsWith('*') && matchedStr.endsWith('*')) {
      tokens.push({
        type: 'asterisk',
        text: matchedStr.slice(1, -1)
      });
    } else if (
      (matchedStr.startsWith('「') && matchedStr.endsWith('」')) ||
      (matchedStr.startsWith('『') && matchedStr.endsWith('』')) ||
      (matchedStr.startsWith('“') && matchedStr.endsWith('”')) ||
      (matchedStr.startsWith('"') && matchedStr.endsWith('"'))
    ) {
      tokens.push({
        type: 'dialogue',
        text: matchedStr
      });
    } else {
      tokens.push({
        type: 'text',
        text: matchedStr
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < paragraph.length) {
    tokens.push({
      type: 'text',
      text: paragraph.slice(lastIndex)
    });
  }

  return tokens;
};

export const ChaptersTab: React.FC<Props> = ({ novel, onChange, settings, onOpenSettings }) => {
  const [selectedChapId, setSelectedChapId] = useState<string>(
    novel.chapters[0]?.id || ''
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<'idle' | 'connecting' | 'streaming'>('idle');
  const [generatedCharsCount, setGeneratedCharsCount] = useState<number>(0);
  const [generationError, setGenerationError] = useState<DiagnosticError | null>(null);

  // SillyTavern 沉浸模式 vs 原始純文字編輯模式
  const [editorMode, setEditorMode] = useState<'sillytavern' | 'raw'>('sillytavern');
  const previewEndRef = useRef<HTMLDivElement | null>(null);

  // 章節正文字級大小設定 (只影響章節內容，自動記憶於瀏覽器)
  const [contentFontSize, setContentFontSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('novel_weaver_content_font_size');
      if (saved) {
        const val = parseInt(saved, 10);
        if (val >= 12 && val <= 32) return val;
      }
    } catch (e) {}
    return 15;
  });

  const handleFontSizeChange = (size: number) => {
    setContentFontSize(size);
    try {
      localStorage.setItem('novel_weaver_content_font_size', String(size));
    } catch (e) {}
  };

  const [targetWords, setTargetWords] = useState<number>(2000);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [continueInstruction, setContinueInstruction] = useState<string>('順著當前情節脈絡自然生動地繼續寫下去');

  const currentChapter = novel.chapters.find(c => c.id === selectedChapId) || novel.chapters[0];
  const selectedCharacters = novel.characters.filter(c => currentChapter?.selected_character_ids?.includes(c.id));

  const activeProvider = settings?.provider || 'openai';
  const activeModel = settings?.providers?.[activeProvider]?.model || settings?.model || 'gpt-4o';
  const providerLabel = activeProvider === 'gemini' 
    ? 'Google Gemini' 
    : activeProvider === 'claude' 
      ? 'Anthropic Claude' 
      : activeProvider === 'openrouter'
        ? 'OpenRouter'
        : activeProvider === 'custom' 
          ? '自訂 / Ollama' 
          : 'OpenAI';

  // 新增章節
  const handleAddChapter = () => {
    const nextNumber = novel.chapters.length > 0 
      ? Math.max(...novel.chapters.map(c => c.chapter_number)) + 1 
      : 1;
    const newId = `chap-${Date.now().toString(36)}`;
    const newChapter: Chapter = {
      id: newId,
      chapter_number: nextNumber,
      title: `第 ${nextNumber} 章：未命名`,
      outline: '請填寫本章預計發生的核心事件與衝突衝突...',
      selected_location_ids: novel.locations[0] ? [novel.locations[0].id] : [],
      selected_sub_location_ids: [],
      selected_character_ids: novel.characters.slice(0, 2).map(c => c.id),
      content: '',
      word_count: 0,
      summary: ''
    };

    onChange({
      ...novel,
      chapters: [...novel.chapters, newChapter]
    });
    setSelectedChapId(newId);
  };

  // 刪除章節
  const handleDeleteChapter = (chapId: string) => {
    if (novel.chapters.length <= 1) {
      alert('請保留至少一個章節');
      return;
    }
    const updated = novel.chapters.filter(c => c.id !== chapId);
    onChange({
      ...novel,
      chapters: updated
    });
    if (selectedChapId === chapId) {
      setSelectedChapId(updated[0]?.id || '');
    }
  };

  // 更新章節
  const handleUpdateChapter = (fields: Partial<Chapter>) => {
    if (!currentChapter) return;
    
    // 如果修改了正文，自動更新字數統計
    let newWordCount = currentChapter.word_count;
    if (fields.content !== undefined) {
      // 統計中英文字數
      newWordCount = fields.content.replace(/\s+/g, '').length;
      fields.word_count = newWordCount;
    }

    onChange({
      ...novel,
      chapters: novel.chapters.map(c => c.id === currentChapter.id ? { ...c, ...fields } : c)
    });
  };

  // 角色切換勾選
  const toggleCharacter = (charId: string) => {
    if (!currentChapter) return;
    const exists = currentChapter.selected_character_ids.includes(charId);
    const updatedIds = exists
      ? currentChapter.selected_character_ids.filter(id => id !== charId)
      : [...currentChapter.selected_character_ids, charId];
    handleUpdateChapter({ selected_character_ids: updatedIds });
  };

  // 地點大項切換勾選
  const toggleLocation = (locId: string) => {
    if (!currentChapter) return;
    const exists = currentChapter.selected_location_ids.includes(locId);
    const updatedIds = exists
      ? currentChapter.selected_location_ids.filter(id => id !== locId)
      : [...currentChapter.selected_location_ids, locId];
    handleUpdateChapter({ selected_location_ids: updatedIds });
  };

  // 子地點切換勾選
  const toggleSubLocation = (subId: string, parentLocId: string) => {
    if (!currentChapter) return;
    const exists = currentChapter.selected_sub_location_ids.includes(subId);
    let updatedSubs = exists
      ? currentChapter.selected_sub_location_ids.filter(id => id !== subId)
      : [...currentChapter.selected_sub_location_ids, subId];

    // 勾選子地點時，也確保大地點被勾選
    let updatedLocs = [...currentChapter.selected_location_ids];
    if (!exists && !updatedLocs.includes(parentLocId)) {
      updatedLocs.push(parentLocId);
    }

    handleUpdateChapter({
      selected_location_ids: updatedLocs,
      selected_sub_location_ids: updatedSubs
    });
  };

  const abortControllerRef = useRef<AbortController | null>(null);

  // 停止串流生成
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setIsContinuing(false);
    setGenerationPhase('idle');
  };


  // AI 串流一鍵結合設定生成正文 (打字機即時顯示)
  const handleGenerateStory = async () => {
    if (!currentChapter) return;
    
    if (currentChapter.content?.trim()) {
      if (!window.confirm('當前章節已有正文內容，點擊確認將以串流生成全新章節覆蓋現有內容。')) {
        return;
      }
    }

    setGenerationError(null);
    setIsGenerating(true);
    setGenerationPhase('connecting');
    setGeneratedCharsCount(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let fullText = '';
    let hasReceivedFirstChunk = false;

    try {
      await api.streamChapter(
        {
          novel_id: novel.id,
          chapter_id: currentChapter.id,
          target_words: targetWords,
          custom_instruction: customPrompt
        },
        (chunk) => {
          if (!hasReceivedFirstChunk) {
            hasReceivedFirstChunk = true;
            setGenerationPhase('streaming');
            fullText = chunk;
          } else {
            fullText += chunk;
          }
          setGeneratedCharsCount(fullText.replace(/\s+/g, '').length);
          handleUpdateChapter({
            content: fullText,
            word_count: fullText.replace(/\s+/g, '').length
          });
        },
        controller.signal
      );
      setGenerationPhase('idle');
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setGenerationPhase('idle');
      } else {
        setGenerationPhase('idle');
        const diag = diagnoseError(e.message || String(e), providerLabel, activeModel);
        setGenerationError(diag);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // AI 串流順著現有內容續寫
  const handleContinueWriting = async () => {
    if (!currentChapter || !currentChapter.content.trim()) {
      alert('請先有一些正文內容才能進行續寫');
      return;
    }

    setGenerationError(null);

    setIsContinuing(true);
    setGenerationPhase('connecting');
    setGeneratedCharsCount(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let fullText = currentChapter.content + '\n\n';
    let addedCount = 0;
    let hasReceivedFirstChunk = false;

    try {
      await api.streamContinueWriting(
        {
          novel_id: novel.id,
          chapter_id: currentChapter.id,
          current_content: currentChapter.content,
          instruction: continueInstruction,
          target_words: 800
        },
        (chunk) => {
          if (!hasReceivedFirstChunk) {
            hasReceivedFirstChunk = true;
            setGenerationPhase('streaming');
          }
          fullText += chunk;
          addedCount += chunk.replace(/\s+/g, '').length;
          setGeneratedCharsCount(addedCount);
          handleUpdateChapter({
            content: fullText,
            word_count: fullText.replace(/\s+/g, '').length
          });
        },
        controller.signal
      );
      setGenerationPhase('idle');
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setGenerationPhase('idle');
      } else {
        setGenerationPhase('idle');
        const diag = diagnoseError(e.message || String(e), providerLabel, activeModel);
        setGenerationError(diag);
      }
    } finally {
      setIsContinuing(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto space-y-5 pb-12 animate-in fade-in duration-200">
      {/* 標題橫幅 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-pink-900/30 via-slate-900/60 to-slate-900 border border-pink-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
              第 4 層
            </span>
            <h1 className="text-xl font-bold text-slate-100">章節創作與故事正文</h1>
          </div>
          <p className="text-xs text-slate-400">
            自動融合「小說主線架構 + 勾選的登場人物 + 發生地點場景 + 前章脈絡」，由 AI 一鍵生成精彩流暢的小說正文。
          </p>
        </div>

        <button
          onClick={handleAddChapter}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-medium shadow-lg shadow-pink-600/20 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>新增章節</span>
        </button>
      </div>

      {/* 核心工作區：左側目錄 + 右側全幅創作面板 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* 左側：章節目錄導覽 (3 cols) */}
        <div className="lg:col-span-3 2xl:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3 shadow-lg lg:sticky lg:top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              章節目錄 ({novel.chapters.length})
            </span>
            <span className="text-[11px] text-slate-500">
              共 {novel.chapters.reduce((acc, c) => acc + (c.word_count || 0), 0)} 字
            </span>
          </div>

          <div className="space-y-1.5 overflow-y-auto pr-1">
            {novel.chapters
              .sort((a, b) => a.chapter_number - b.chapter_number)
              .map((chap) => {
                const isSelected = chap.id === (currentChapter?.id || '');
                return (
                  <div
                    key={chap.id}
                    onClick={() => setSelectedChapId(chap.id)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition flex items-center justify-between group ${
                      isSelected
                        ? 'bg-pink-600/15 border-pink-500/50 text-pink-200 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="text-xs font-bold truncate flex items-center gap-1.5">
                        <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-pink-400' : 'text-slate-500'}`} />
                        <span>{chap.title}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-1">
                        {chap.outline || '（尚未填寫大綱）'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                        {chap.word_count || 0} 字
                      </span>
                      {novel.chapters.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`確定刪除《${chap.title}》嗎？`)) {
                              handleDeleteChapter(chap.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* 右側：章節寫作與情境融合面板 (9-10 cols 全幅展示) */}
        {currentChapter ? (
          <div className="lg:col-span-9 2xl:col-span-10 space-y-5 min-w-0">
            {/* 章節標題與大綱 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4 shadow-lg">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-1">
                  <label className="text-xs font-semibold text-slate-400 block mb-1">序號</label>
                  <input
                    type="number"
                    value={currentChapter.chapter_number}
                    onChange={(e) => handleUpdateChapter({ chapter_number: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-slate-200 focus:outline-none focus:border-pink-500"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="text-xs font-semibold text-slate-400 block mb-1">章節標題</label>
                  <input
                    type="text"
                    value={currentChapter.title}
                    onChange={(e) => handleUpdateChapter({ title: e.target.value })}
                    placeholder="例如：第一章：熄滅的以太之光"
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-slate-100 focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center justify-between">
                  <span>本章核心大綱 / 目標事件</span>
                  <span className="text-[11px] text-pink-400 font-normal">（AI 生成的主要劇情引導）</span>
                </label>
                <textarea
                  rows={2}
                  value={currentChapter.outline}
                  onChange={(e) => handleUpdateChapter({ outline: e.target.value })}
                  placeholder="說明本章要發生什麼事、爆發何種衝突、誰與誰對峙..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-pink-500 resize-y"
                />
              </div>

              {/* 關聯要素勾選區 (登場角色 & 發生地點) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
                {/* 勾選登場角色 */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    本章登場角色 ({currentChapter.selected_character_ids.length})
                  </span>
                  
                  {novel.characters.length === 0 ? (
                    <div className="text-[11px] text-slate-500 italic p-2 bg-slate-950/40 rounded-lg">
                      尚未建立角色，請先至「第 3 層 角色系統」建立。
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-slate-950/40 rounded-xl border border-slate-800/60">
                      {novel.characters.map((char) => {
                        const isSelected = currentChapter.selected_character_ids.includes(char.id);
                        return (
                          <button
                            key={char.id}
                            type="button"
                            onClick={() => toggleCharacter(char.id)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border transition ${
                              isSelected
                                ? 'bg-blue-600/20 border-blue-500 text-blue-200'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                            }`}
                          >
                            {char.avatar_url ? (
                              <img
                                src={char.avatar_url}
                                alt={char.name}
                                className="w-4 h-4 rounded-full object-cover shrink-0 border border-blue-400/40"
                              />
                            ) : (
                              <User className="w-3 h-3 text-slate-500 shrink-0" />
                            )}
                            {isSelected ? <CheckSquare className="w-3 h-3 text-blue-400 shrink-0" /> : <Square className="w-3 h-3 text-slate-600 shrink-0" />}
                            <span>{char.name}</span>
                            <span className="text-[9px] opacity-75">({char.role})</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 勾選發生地點與子場景 */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    本章發生地點與細節場景
                  </span>

                  {novel.locations.length === 0 ? (
                    <div className="text-[11px] text-slate-500 italic p-2 bg-slate-950/40 rounded-lg">
                      尚未建立地點，請先至「第 2 層 地點系統」建立。
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-28 overflow-y-auto p-1.5 bg-slate-950/40 rounded-xl border border-slate-800/60">
                      {novel.locations.map((loc) => {
                        const isLocSelected = currentChapter.selected_location_ids.includes(loc.id);
                        return (
                          <div key={loc.id} className="text-xs space-y-1">
                            <button
                              type="button"
                              onClick={() => toggleLocation(loc.id)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition ${
                                isLocSelected ? 'text-emerald-300 font-bold' : 'text-slate-400'
                              }`}
                            >
                              {isLocSelected ? <CheckSquare className="w-3 h-3 text-emerald-400" /> : <Square className="w-3 h-3 text-slate-600" />}
                              <span>{loc.name}</span>
                            </button>

                            {/* 子場景細節 */}
                            {loc.sub_locations.length > 0 && (
                              <div className="pl-4 flex flex-wrap gap-1">
                                {loc.sub_locations.map((sub) => {
                                  const isSubSelected = currentChapter.selected_sub_location_ids.includes(sub.id);
                                  return (
                                    <button
                                      key={sub.id}
                                      type="button"
                                      onClick={() => toggleSubLocation(sub.id, loc.id)}
                                      className={`text-[10px] px-1.5 py-0.5 rounded border transition ${
                                        isSubSelected
                                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200'
                                          : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
                                      }`}
                                    >
                                      ↳ {sub.name}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* AI 生成設定列 */}
            <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-100">AI 自動生成故事章節</h3>
                    <p className="text-[11px] text-slate-400">
                      一鍵融合小說主線、已勾選的角色與地點，進行全方位正文撰寫。
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* 當前模型標籤 */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 border border-purple-500/30 rounded-xl text-xs text-purple-300 font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="truncate max-w-[160px]">{providerLabel} ({activeModel})</span>
                    {onOpenSettings && (
                      <button
                        type="button"
                        onClick={onOpenSettings}
                        className="ml-1 text-slate-400 hover:text-purple-300 transition"
                        title="切換模型或修改設定"
                      >
                        <Settings className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <select
                    value={targetWords}
                    disabled={isGenerating || isContinuing}
                    onChange={(e) => setTargetWords(parseInt(e.target.value))}
                    className="px-2.5 py-1.5 bg-slate-900 border border-purple-500/30 rounded-xl text-xs text-purple-200 focus:outline-none disabled:opacity-50"
                  >
                    <option value={1000}>目標 ~1000 字</option>
                    <option value={1500}>目標 ~1500 字</option>
                    <option value={2000}>目標 ~2000 字</option>
                    <option value={3000}>目標 ~3000 字</option>
                  </select>

                  {isGenerating ? (
                    <button
                      type="button"
                      onClick={handleStopGeneration}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-lg shadow-rose-600/30 transition animate-pulse shrink-0"
                    >
                      <StopCircle className="w-4 h-4" />
                      <span>停止生成 (已產出部分保留)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGenerateStory}
                      disabled={isContinuing}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:opacity-90 text-white font-medium text-xs shadow-lg shadow-purple-600/30 transition disabled:opacity-50 shrink-0"
                    >
                      <Sparkle className="w-4 h-4 fill-white" />
                      <span>✨ 串流生成完整章節</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 額外指示 (折疊或直接展示) */}
              <input
                type="text"
                disabled={isGenerating || isContinuing}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="選填：為本章生成增加額外指示 (例如：加強打鬥動作描寫、讓反派展現威嚴冷酷...)"
                className="w-full px-3 py-1.5 bg-slate-950/80 border border-purple-500/20 rounded-xl text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-purple-500 disabled:opacity-50"
              />
            </div>

            {/* 本章登場角色陣容舞台 (Active Cast Gallery - 一字排開展示，增加沉浸感) */}
            <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-r from-blue-950/25 via-slate-900/60 to-purple-950/20 p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                      <span>本章登場角色陣容 (Active Cast)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30">
                        {selectedCharacters.length} 位在場
                      </span>
                      {(isGenerating || isContinuing) && (
                        <span className="text-[10px] text-purple-300 font-mono flex items-center gap-1.5 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span>
                          AI 正沉浸描寫本章人物中...
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      登場角色立繪一字排開展示，外觀設定即時對照，提升寫作沉浸感
                    </p>
                  </div>
                </div>
              </div>

              {selectedCharacters.length === 0 ? (
                <div className="py-6 px-4 text-center rounded-xl border border-dashed border-slate-800/80 bg-slate-950/40 flex items-center justify-center gap-3">
                  <User className="w-5 h-5 text-slate-600 shrink-0" />
                  <p className="text-xs text-slate-400">
                    本章尚未勾選登場角色。請在上方勾選角色，立繪將一字排開在此展示。
                  </p>
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-slate-700">
                  {selectedCharacters.map((char) => {
                    const isNowActing = isGenerating || isContinuing;
                    return (
                      <div
                        key={char.id}
                        className={`relative rounded-xl border overflow-hidden bg-slate-950/90 transition-all duration-300 group shrink-0 w-48 sm:w-52 flex flex-col ${
                          isNowActing
                            ? 'border-purple-500 ring-2 ring-purple-500/30 shadow-lg shadow-purple-900/30'
                            : 'border-slate-800 hover:border-slate-600 hover:shadow-md'
                        }`}
                      >
                        {/* 立繪圖片展示區 */}
                        {char.avatar_url ? (
                          <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-900 shrink-0">
                            <img
                              src={char.avatar_url}
                              alt={char.name}
                              className="w-full h-full object-cover object-top transition duration-500 group-hover:scale-105"
                            />
                            {/* 漸層遮罩 */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

                            {/* 右上角快捷移出場景按鈕 */}
                            <button
                              type="button"
                              title="從本章移出"
                              onClick={() => toggleCharacter(char.id)}
                              className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-950/70 hover:bg-rose-600/90 text-slate-300 hover:text-white backdrop-blur-sm transition border border-white/10 opacity-0 group-hover:opacity-100"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>

                            {/* 演出中動畫標籤 */}
                            {isNowActing && (
                              <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/50 backdrop-blur-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span>
                                <span className="text-[9px] text-purple-200 font-bold">登場中</span>
                              </div>
                            )}

                            {/* 浮動在立繪底部的角色名稱與標籤 */}
                            <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
                              <div className="min-w-0 pr-1">
                                <div className="text-sm font-bold text-white drop-shadow-md truncate">
                                  {char.name}
                                </div>
                                <span className="text-[10px] text-blue-300 bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-800/50 backdrop-blur-xs inline-block mt-0.5 truncate">
                                  {char.role || '角色'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="relative p-3.5 bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/60 shrink-0">
                            <button
                              type="button"
                              title="從本章移出"
                              onClick={() => toggleCharacter(char.id)}
                              className="absolute top-2.5 right-2.5 p-1 rounded-full bg-slate-800/60 hover:bg-rose-600 text-slate-400 hover:text-white transition"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                                <User className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-200 truncate">{char.name}</div>
                                {isNowActing && (
                                  <span className="text-[9px] text-purple-400 font-mono animate-pulse block">登場中</span>
                                )}
                                <span className="text-[10px] text-blue-400 block truncate">{char.role || '角色'} (無立繪)</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 角色外觀與特徵備忘卡 (供作者寫作隨時參考) */}
                        <div className="p-3 space-y-1.5 bg-slate-950 text-xs flex-1 flex flex-col justify-between">
                          {char.appearance ? (
                            <div className="space-y-0.5">
                              <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider block">外貌服飾</span>
                              <p className="text-[11px] text-slate-300 leading-snug line-clamp-3 hover:line-clamp-none transition-all cursor-default" title={char.appearance}>
                                {char.appearance}
                              </p>
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-600 italic">未填寫外貌描寫</p>
                          )}
                          {char.profile && (
                            <div className="space-y-0.5 pt-1.5 border-t border-slate-900">
                              <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider block">性格身世</span>
                              <p className="text-[10px] text-slate-400 leading-snug line-clamp-2" title={char.profile}>
                                {char.profile}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 故事正文創作區 (全幅最大化排版) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4 shadow-lg">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <PenTool className="w-3.5 h-3.5 text-pink-400" />
                      <span>故事正文</span>
                    </label>

                    {/* 顯示模式切換：SillyTavern 沉浸式格式 vs 原文編輯 */}
                    <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={() => setEditorMode('sillytavern')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition font-medium text-xs ${
                          editorMode === 'sillytavern'
                            ? 'bg-purple-600/30 border border-purple-500/60 text-purple-200 shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="啟用類似 SillyTavern 的排版渲染（星號背景動作描寫、橘黃色對話台詞）"
                      >
                        <Eye className="w-3.5 h-3.5 text-purple-400" />
                        <span>✨ 沉浸渲染</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditorMode('raw')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition font-medium text-xs ${
                          editorMode === 'raw'
                            ? 'bg-purple-600/30 border border-purple-500/60 text-purple-200 shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="切換回純文字編輯框，方便隨時手動微調修改"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                        <span>✏️ 純文字編輯</span>
                      </button>
                    </div>

                    {/* 正文字級大小設定 (只影響章節內容) */}
                    <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
                      <Type className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <select
                        value={contentFontSize}
                        onChange={(e) => handleFontSizeChange(parseInt(e.target.value, 10))}
                        className="bg-transparent text-slate-300 text-xs font-sans focus:outline-none cursor-pointer pr-1"
                        title="字體大小設定（僅影響本章節正文內容）"
                      >
                        <option value={13} className="bg-slate-900 text-slate-200">字級：13px (精簡)</option>
                        <option value={14} className="bg-slate-900 text-slate-200">字級：14px (偏小)</option>
                        <option value={15} className="bg-slate-900 text-slate-200">字級：15px (適中·預設)</option>
                        <option value={16} className="bg-slate-900 text-slate-200">字級：16px (標準舒適)</option>
                        <option value={18} className="bg-slate-900 text-slate-200">字級：18px (放大閱讀)</option>
                        <option value={20} className="bg-slate-900 text-slate-200">字級：20px (特大清晰)</option>
                        <option value={22} className="bg-slate-900 text-slate-200">字級：22px (護眼巨字)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* SillyTavern 樣式顏色圖例 */}
                    {editorMode === 'sillytavern' && (
                      <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-400 font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        <span className="flex items-center gap-1 text-amber-300 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          「台詞」橘黃
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="flex items-center gap-1 text-purple-300 italic">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                          *背景/動作* 紫灰
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-500 text-[9px]">點兩下正文切換編輯</span>
                      </div>
                    )}

                    <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20">
                      {currentChapter.word_count || 0} 字
                    </span>
                  </div>
                </div>


                {/* 即時生成狀態橫幅 (Live Status Bar) */}
                {(isGenerating || isContinuing) && (
                  <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/40 flex items-center justify-between gap-3 animate-in fade-in duration-150 shadow-lg shadow-purple-900/10">
                    <div className="flex items-center gap-3 min-w-0">
                      <Loader2 className="w-5 h-5 text-purple-400 animate-spin shrink-0" />
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs text-purple-200 font-bold flex items-center gap-2 flex-wrap">
                          <span>
                            {generationPhase === 'connecting'
                              ? '📡 正在連線 AI 模型，傳送小說背景、人物大綱中...'
                              : isContinuing
                                ? `✍️ AI 正在即時續寫中 (已追加 ${generatedCharsCount} 字)...`
                                : `✍️ AI 正在即時創作章節中 (已產出 ${generatedCharsCount} 字)...`}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                            {providerLabel} · {activeModel}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          {generationPhase === 'connecting'
                            ? '正在等待模型接收與思考情節脈絡，請稍候...'
                            : '文字正流暢逐字即時寫入，您可以隨時點擊右側按鈕中止生成。'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleStopGeneration}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-medium transition shrink-0 shadow"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      <span>中斷生成</span>
                    </button>
                  </div>
                )}

                {/* AI 診斷與狀態錯誤面板 (Diagnostic Alert Panel) */}
                {generationError !== null && (
                  <div className={`p-4 rounded-xl border space-y-3 animate-in fade-in duration-200 shadow-xl ${
                    generationError.type === 'refusal' 
                      ? 'bg-rose-950/40 border-rose-500/60 text-rose-200 shadow-rose-950/30' 
                      : generationError.type === 'empty'
                        ? 'bg-amber-950/40 border-amber-500/60 text-amber-200 shadow-amber-950/30'
                        : 'bg-red-950/40 border-red-500/60 text-red-200 shadow-red-950/30'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        {generationError.type === 'refusal' ? (
                          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                        ) : generationError.type === 'empty' ? (
                          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                        ) : (
                          <KeyRound className="w-5 h-5 text-red-400 shrink-0" />
                        )}
                        <div>
                          <h4 className="text-sm font-bold flex items-center gap-2 flex-wrap">
                            <span>{generationError.title}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-black/40 border border-current opacity-80">
                              {generationError.provider} · {generationError.modelName}
                            </span>
                          </h4>
                          <p className="text-xs text-slate-300 mt-0.5">
                            {generationError.description}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGenerationError(null)}
                        className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-white/10 transition"
                        title="關閉診斷訊息"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* 處置建議指引 */}
                    <div className="p-3 rounded-lg bg-black/40 border border-white/10 text-xs text-slate-300 space-y-1">
                      <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>建議處置方針：</span>
                      </div>
                      <p className="whitespace-pre-line text-[11px] text-slate-300 leading-relaxed font-sans">
                        {generationError.suggestion}
                      </p>
                    </div>

                    {/* 技術除錯資訊 */}
                    <details className="text-[11px] text-slate-400">
                      <summary className="cursor-pointer hover:text-slate-200 font-mono text-[10px]">
                        查看原始錯誤詳細回傳日誌 (Technical Log)
                      </summary>
                      <pre className="mt-1.5 p-2 rounded bg-black/60 border border-slate-800 text-[10px] font-mono text-rose-300/90 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                        {generationError.rawError}
                      </pre>
                    </details>

                    {/* 快捷操作按鈕 */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
                      <button
                        type="button"
                        onClick={handleGenerateStory}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-medium shadow transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>🔄 重新嘗試生成</span>
                      </button>

                      {onOpenSettings && (
                        <button
                          type="button"
                          onClick={onOpenSettings}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-900/50 hover:bg-purple-800/60 text-purple-200 border border-purple-500/40 text-xs font-medium transition ml-auto"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span>⚙️ 前往 AI 設定 (更換模型或金鑰)</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 編輯器主體：SillyTavern 沉浸式高亮視窗 vs 原始文字框 */}
                {editorMode === 'sillytavern' ? (
                  <div
                    onDoubleClick={() => setEditorMode('raw')}
                    title="雙擊此處切換至純文字編輯框"
                    className={`w-full min-h-[480px] max-h-[750px] overflow-y-auto p-5 bg-slate-950 rounded-xl leading-relaxed transition ${
                      isGenerating || isContinuing
                        ? 'border border-purple-500/80 ring-2 ring-purple-500/20 shadow-lg shadow-purple-500/10'
                        : 'border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {currentChapter.content?.trim() ? (
                      <div className="space-y-3 font-sans select-text">
                        {currentChapter.content.split('\n').map((para, pIdx) => {
                          if (!para.trim()) {
                            return <div key={pIdx} className="h-2.5" />;
                          }
                          const tokens = parseSillyTavernParagraph(para);
                          return (
                            <p
                              key={pIdx}
                              className="text-slate-200 tracking-wide"
                              style={{ fontSize: `${contentFontSize}px`, lineHeight: 1.85 }}
                            >
                              {tokens.map((token, tIdx) => {
                                if (token.type === 'dialogue') {
                                  return (
                                    <span key={tIdx} className="text-amber-300 font-semibold drop-shadow-xs">
                                      {token.text}
                                    </span>
                                  );
                                }
                                if (token.type === 'asterisk') {
                                  return (
                                    <span key={tIdx} className="text-purple-300/95 italic bg-purple-950/30 px-1 py-0.5 rounded mx-0.5 font-sans border border-purple-500/20">
                                      {token.text}
                                    </span>
                                  );
                                }
                                if (token.type === 'bold') {
                                  return (
                                    <strong key={tIdx} className="text-white font-bold">
                                      {token.text}
                                    </strong>
                                  );
                                }
                                return <span key={tIdx}>{token.text}</span>;
                              })}
                            </p>
                          );
                        })}
                        {(isGenerating || isContinuing) && (
                          <span className="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-0.5 align-middle" />
                        )}
                        <div ref={previewEndRef} />
                      </div>
                    ) : (
                      <div className="py-20 text-center text-slate-500 space-y-2 select-none">
                        <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
                        <p className="text-xs text-slate-400">當前章節尚無故事正文</p>
                        <p className="text-[11px] text-slate-600 max-w-sm mx-auto">
                          點選上方「✨ 串流生成完整章節」開始創作，或切換至「✏️ 純文字編輯」直接鍵入。
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <textarea
                    rows={22}
                    value={currentChapter.content}
                    onChange={(e) => handleUpdateChapter({ content: e.target.value })}
                    placeholder="在此手動撰寫故事正文，或點擊上方「串流生成完整章節」由 AI 一邊思考一邊打字..."
                    style={{ fontSize: `${contentFontSize}px`, lineHeight: 1.85 }}
                    className={`w-full p-4 bg-slate-950 rounded-xl text-slate-100 leading-relaxed font-sans focus:outline-none transition resize-y ${
                      isGenerating || isContinuing
                        ? 'border border-purple-500/80 ring-2 ring-purple-500/20 shadow-lg shadow-purple-500/10'
                        : 'border border-slate-800 focus:border-pink-500'
                    }`}
                  />
                )}

                {/* 續寫工具列 */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                    <CornerDownLeft className="w-4 h-4 text-slate-500 shrink-0" />
                    <input
                      type="text"
                      disabled={isGenerating || isContinuing}
                      value={continueInstruction}
                      onChange={(e) => setContinueInstruction(e.target.value)}
                      placeholder="續寫指示 (如：緊接著描寫男主角的心理震撼)"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                    />
                  </div>

                  {isContinuing ? (
                    <button
                      type="button"
                      onClick={handleStopGeneration}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition animate-pulse shrink-0"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      <span>停止續寫</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleContinueWriting}
                      disabled={isGenerating || !currentChapter.content.trim()}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 text-xs font-medium transition disabled:opacity-40 shrink-0"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>順著情節續寫</span>
                    </button>
                  )}
                </div>

                {/* 章節小結 */}
                <div className="pt-2">
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    本章情節小結 (選填，供後續章節銜接與前情回顧參考)
                  </label>
                  <input
                    type="text"
                    value={currentChapter.summary || ''}
                    onChange={(e) => handleUpdateChapter({ summary: e.target.value })}
                    placeholder="總結本章發生的關鍵進展 (例如：以太之心核心失竊，兩人決定前往下界)"
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>
            </div>
        ) : (
          <div className="lg:col-span-9 2xl:col-span-10 p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
            請從左側選擇或新增一個章節開始創作。
          </div>
        )}
      </div>
    </div>
  );
};
