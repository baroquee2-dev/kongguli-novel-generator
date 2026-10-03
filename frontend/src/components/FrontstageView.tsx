import React, { useState, useEffect, useMemo } from 'react';
import type { Novel, NovelListItem } from '../types';
import { 
  BookOpen, ArrowLeft, List, Library, Clock, ChevronRight, ChevronLeft, 
  PenTool, FileText, Compass, ChevronDown, Hash
} from 'lucide-react';

interface Props {
  novels: NovelListItem[];
  currentNovel: Novel | null;
  onSelectNovel: (id: string) => void;
  onBackToStudio: () => void;
}

export const FrontstageView: React.FC<Props> = ({
  novels,
  currentNovel,
  onSelectNovel,
  onBackToStudio,
}) => {
  // 當前閱讀的章節 ID (null 表示在小說書介與目錄首頁)
  const [readingChapterId, setReadingChapterId] = useState<string | null>(null);

  // 讀者閱讀個人化設定 (自動持久化儲存)
  const [readerTheme, setReaderTheme] = useState<'dark' | 'sepia' | 'pitch'>('dark');
  const [readerFontSize, setReaderFontSize] = useState<number>(18);
  const [readerFontFamily, setReaderFontFamily] = useState<'serif' | 'sans'>('serif');
  const [readerWidth, setReaderWidth] = useState<'normal' | 'wide' | 'narrow'>('normal');

  // 書庫切換下拉
  const [shelfOpen, setShelfOpen] = useState(false);
  // 章節目錄抽屜
  const [catalogDrawerOpen, setCatalogDrawerOpen] = useState(false);

  // 排序後的章節
  const sortedChapters = useMemo(() => {
    if (!currentNovel?.chapters) return [];
    return [...currentNovel.chapters].sort((a, b) => a.chapter_number - b.chapter_number);
  }, [currentNovel?.chapters]);

  // 當前閱讀中的章節物件
  const currentReadingChapter = useMemo(() => {
    if (!readingChapterId) return null;
    return sortedChapters.find(c => c.id === readingChapterId) || null;
  }, [readingChapterId, sortedChapters]);

  // 當前章節在列表中的索引
  const currentChapterIndex = useMemo(() => {
    if (!readingChapterId) return -1;
    return sortedChapters.findIndex(c => c.id === readingChapterId);
  }, [readingChapterId, sortedChapters]);

  // 上一章與下一章
  const prevChapter = currentChapterIndex > 0 ? sortedChapters[currentChapterIndex - 1] : null;
  const nextChapter = currentChapterIndex >= 0 && currentChapterIndex < sortedChapters.length - 1 
    ? sortedChapters[currentChapterIndex + 1] 
    : null;

  // 全書總字數
  const totalWordCount = useMemo(() => {
    if (!sortedChapters) return 0;
    return sortedChapters.reduce((acc, c) => acc + (c.word_count || 0), 0);
  }, [sortedChapters]);

  // 切換章節時自動滾動到最上方
  useEffect(() => {
    if (readingChapterId) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [readingChapterId]);

  // 切換小說時重設閱讀進度回書頁
  useEffect(() => {
    setReadingChapterId(null);
  }, [currentNovel?.id]);

  // 主題樣式設定
  const themeClasses = {
    dark: 'bg-slate-950 text-slate-200 border-slate-800',
    sepia: 'bg-[#fbf0d9] text-[#2c2214] border-[#e4d4b2]',
    pitch: 'bg-black text-neutral-300 border-neutral-900',
  }[readerTheme];

  const readerContainerClasses = {
    dark: 'bg-slate-900/60 border-slate-800 text-slate-100',
    sepia: 'bg-[#f7ebd0] border-[#ecd8b3] text-[#251b0f]',
    pitch: 'bg-neutral-950 border-neutral-900 text-neutral-200',
  }[readerTheme];

  const readerWidthClasses = {
    narrow: 'max-w-2xl',
    normal: 'max-w-3xl',
    wide: 'max-w-4xl',
  }[readerWidth];

  return (
    <div className={`min-h-screen ${themeClasses} transition-colors duration-200 font-sans flex flex-col`}>
      {/* ================= 前台頂部導覽列 ================= */}
      <header className={`sticky top-0 z-40 h-16 border-b backdrop-blur-md px-4 sm:px-8 flex items-center justify-between transition-colors duration-200 ${
        readerTheme === 'sepia' 
          ? 'bg-[#fbf0d9]/90 border-[#e5d5b5]' 
          : 'bg-slate-900/90 border-slate-800'
      }`}>
        {/* 左側：前台標誌與切換書庫 */}
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={() => setReadingChapterId(null)}
            className="flex items-center gap-2.5 group text-left"
            title="回到小說總覽首頁"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-purple-600/20 group-hover:scale-105 transition">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-wide bg-gradient-to-r from-purple-300 via-pink-300 to-amber-200 bg-clip-text text-transparent">
                  孔固力故事館
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  讀者前台
                </span>
              </div>
              <span className="block text-[10px] text-slate-400 font-mono">
                純粹沉浸式閱讀體驗
              </span>
            </div>
          </button>

          {/* 作品切換下拉 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShelfOpen(!shelfOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
                readerTheme === 'sepia'
                  ? 'bg-[#f4e4c2] border-[#dfceaa] text-[#42321e] hover:bg-[#ebd8b2]'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Library className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="max-w-[140px] truncate">
                {currentNovel?.title || '選擇作品'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>

            {shelfOpen && (
              <div 
                className="absolute left-0 mt-2 w-72 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-slate-100"
                onClick={() => setShelfOpen(false)}
              >
                <div className="px-3.5 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-2 mb-1">
                  <span>小說藏書庫 ({novels.length})</span>
                  <span className="text-[10px] text-purple-400">點選直接換書</span>
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  {novels.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => onSelectNovel(n.id)}
                      className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-slate-800 transition ${
                        n.id === currentNovel?.id ? 'text-purple-300 font-bold bg-purple-600/10' : 'text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate pr-2 min-w-0">
                        {n.cover_url ? (
                          <img
                            src={n.cover_url}
                            alt=""
                            className="w-7 h-9 rounded object-cover border border-slate-700/80 shrink-0 shadow-sm"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-7 h-9 rounded bg-gradient-to-br from-purple-800 to-slate-800 flex items-center justify-center text-[9px] text-purple-200 border border-slate-700/80 shrink-0 font-bold">
                            書
                          </div>
                        )}
                        <div className="truncate">
                          <p className="truncate font-medium">{n.title}</p>
                          <p className="text-[10px] text-slate-500 font-normal">
                            {n.genre} · {n.tone}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] text-purple-400/80 shrink-0 font-mono">
                        {n.chapters_count} 章
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右側：閱讀設定與切換至後台按鈕 */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* 若在閱讀正文中，顯示快速選單 */}
          {readingChapterId && (
            <button
              type="button"
              onClick={() => setCatalogDrawerOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition ${
                readerTheme === 'sepia'
                  ? 'bg-[#f4e4c2] border-[#dfceaa] text-[#42321e]'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:bg-slate-800'
              }`}
              title="展開章節目錄"
            >
              <List className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">章節目錄</span>
            </button>
          )}

          {/* 閱讀器樣式設定 (字體大小、主題、字型) */}
          <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/10">
            {/* 字體大小調節 */}
            <button
              type="button"
              onClick={() => setReaderFontSize(prev => Math.max(14, prev - 2))}
              className="p-1.5 rounded-lg hover:bg-white/10 text-xs font-bold"
              title="縮小字級"
            >
              A-
            </button>
            <span className="text-[11px] font-mono px-1 select-none opacity-70">
              {readerFontSize}
            </span>
            <button
              type="button"
              onClick={() => setReaderFontSize(prev => Math.min(28, prev + 2))}
              className="p-1.5 rounded-lg hover:bg-white/10 text-xs font-bold"
              title="放大字級"
            >
              A+
            </button>

            <div className="w-[1px] h-3.5 bg-white/10 mx-1" />

            {/* 字型切換 */}
            <button
              type="button"
              onClick={() => setReaderFontFamily(prev => prev === 'serif' ? 'sans' : 'serif')}
              className="px-2 py-1 rounded-lg hover:bg-white/10 text-xs font-medium"
              title="切換字型 (宋體/黑體)"
            >
              {readerFontFamily === 'serif' ? '宋體' : '黑體'}
            </button>

            <div className="w-[1px] h-3.5 bg-white/10 mx-1" />

            {/* 主題切換 (暗黑 / 羊皮紙 / 墨黑) */}
            <button
              type="button"
              onClick={() => {
                if (readerTheme === 'dark') setReaderTheme('sepia');
                else if (readerTheme === 'sepia') setReaderTheme('pitch');
                else setReaderTheme('dark');
              }}
              className="px-2 py-1 rounded-lg hover:bg-white/10 text-xs font-medium flex items-center gap-1"
              title="切換閱讀底色風格 (暗夜 / 暖黃羊皮 / 墨黑)"
            >
              <span className={`w-2.5 h-2.5 rounded-full border border-white/30 ${
                readerTheme === 'dark' ? 'bg-slate-900' : readerTheme === 'sepia' ? 'bg-[#fbf0d9]' : 'bg-black'
              }`} />
              <span className="hidden md:inline">
                {readerTheme === 'dark' ? '暗夜' : readerTheme === 'sepia' ? '羊皮紙' : '墨黑'}
              </span>
            </button>

            <div className="w-[1px] h-3.5 bg-white/10 mx-1 hidden sm:block" />

            {/* 版面寬度切換 */}
            <button
              type="button"
              onClick={() => {
                if (readerWidth === 'normal') setReaderWidth('wide');
                else if (readerWidth === 'wide') setReaderWidth('narrow');
                else setReaderWidth('normal');
              }}
              className="px-2 py-1 rounded-lg hover:bg-white/10 text-xs font-medium hidden sm:inline"
              title="切換閱讀版面寬度 (適中/寬版/精簡)"
            >
              {readerWidth === 'normal' ? '適中版' : readerWidth === 'wide' ? '寬幅' : '精簡'}
            </button>
          </div>

          {/* 🌟 核心切換按鈕：返回創作後台 */}
          <button
            type="button"
            onClick={onBackToStudio}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:opacity-90 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0"
            title="返回多層式劇本創作系統進行編輯與生成"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">切換至創作後台</span>
            <span className="sm:hidden">後台</span>
          </button>
        </div>
      </header>


      {/* ================= 前台主體內容區 ================= */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {!currentNovel ? (
          <div className="text-center py-24 space-y-4">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto animate-pulse" />
            <p className="text-slate-400 text-sm">目前藏書庫尚無選定小說，請於左上方選擇一部作品。</p>
          </div>
        ) : readingChapterId && currentReadingChapter ? (
          /* ================= 模式 1：正文沉浸式閱讀器 ================= */
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* 閱讀器頂端輔助列 */}
            <div className={`flex items-center justify-between border-b pb-4 ${
              readerTheme === 'sepia' ? 'border-[#e4d4b2]' : 'border-slate-800'
            }`}>
              <button
                type="button"
                onClick={() => setReadingChapterId(null)}
                className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 transition"
              >
                <ArrowLeft className="w-4 h-4 text-purple-400" />
                <span>返回《{currentNovel.title}》目錄</span>
              </button>

              <div className="flex items-center gap-3 text-xs opacity-75">
                <span>第 {currentReadingChapter.chapter_number} / {sortedChapters.length} 章</span>
                <span>·</span>
                <span>{currentReadingChapter.word_count || 0} 字</span>
              </div>
            </div>

            {/* 正文閱讀紙張 */}
            <article className={`mx-auto ${readerWidthClasses} ${readerContainerClasses} p-6 sm:p-12 rounded-3xl shadow-xl border space-y-8`}>
              {/* 章節標題 */}
              <header className="space-y-3 text-center border-b pb-6 border-current/10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Hash className="w-3 h-3" />
                  <span>第 {currentReadingChapter.chapter_number} 章</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {currentReadingChapter.title}
                </h1>
              </header>

              {/* 正文段落渲染 */}
              <div 
                className={`leading-relaxed space-y-6 ${
                  readerFontFamily === 'serif' 
                    ? 'font-serif tracking-normal' 
                    : 'font-sans tracking-wide'
                }`}
                style={{ fontSize: `${readerFontSize}px`, lineHeight: 1.85 }}
              >
                {currentReadingChapter.content && currentReadingChapter.content.trim() ? (
                  currentReadingChapter.content.split('\n\n').map((paragraph, idx) => {
                    const clean = paragraph.trim();
                    if (!clean) return null;
                    return (
                      <p 
                        key={idx} 
                        className="text-justify indent-8 select-text"
                      >
                        {clean}
                      </p>
                    );
                  })
                ) : (
                  <div className="py-20 text-center space-y-3 opacity-60">
                    <FileText className="w-10 h-10 mx-auto" />
                    <p className="text-sm">本章故事尚未生成或撰寫。</p>
                    <p className="text-xs">作者正在揮毫構思中，請點擊右上角「切換至創作後台」進行創作。</p>
                  </div>
                )}
              </div>
            </article>

            {/* 底部章節翻頁導覽 */}
            <div className={`max-w-3xl mx-auto flex items-center justify-between gap-4 pt-4 border-t ${
              readerTheme === 'sepia' ? 'border-[#e4d4b2]' : 'border-slate-800'
            }`}>
              {prevChapter ? (
                <button
                  type="button"
                  onClick={() => setReadingChapterId(prevChapter.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-current/20 hover:bg-current/10 text-xs font-semibold transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="truncate max-w-[150px]">上一章：{prevChapter.title}</span>
                </button>
              ) : (
                <div className="text-xs opacity-40 px-4 py-2.5">已是第一章</div>
              )}

              <button
                type="button"
                onClick={() => setReadingChapterId(null)}
                className="px-4 py-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 text-xs font-bold hover:bg-purple-600/30 transition"
              >
                目錄
              </button>

              {nextChapter ? (
                <button
                  type="button"
                  onClick={() => setReadingChapterId(nextChapter.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-current/20 hover:bg-current/10 text-xs font-semibold transition"
                >
                  <span className="truncate max-w-[150px]">下一章：{nextChapter.title}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="text-xs opacity-40 px-4 py-2.5">全書最新章節</div>
              )}
            </div>
          </div>
        ) : (
          /* ================= 模式 2：小說主題展台與全書目錄 ================= */
          <div className="space-y-12 animate-in fade-in duration-200">
            {/* 頂部書籍主題大卡 (Hero Showcase) */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-purple-950/40 to-slate-900 border border-purple-500/30 p-6 sm:p-10 shadow-2xl">
              <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                {/* 精緻立體書封模型 */}
                <div className="w-44 h-60 sm:w-52 sm:h-72 rounded-2xl bg-gradient-to-tr from-purple-800 via-indigo-700 to-pink-600 p-1 shadow-2xl shadow-purple-950/60 shrink-0 mx-auto md:mx-0 overflow-hidden group hover:scale-[1.02] transition duration-300 relative">
                  {currentNovel.cover_url ? (
                    <div className="h-full w-full rounded-xl overflow-hidden relative border border-white/15 bg-slate-950 shadow-inner group">
                      <img
                        src={currentNovel.cover_url}
                        alt={currentNovel.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {/* 書脊立體光影陰影效果 */}
                      <div className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-black/60 via-black/20 to-transparent pointer-events-none" />
                      <div className="absolute inset-y-0 left-3 w-[1px] bg-white/20 pointer-events-none" />
                      {/* 底部微漸層文字標籤 */}
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none flex items-end p-3">
                        <span className="text-[11px] text-white/95 font-medium truncate drop-shadow-md">
                          {currentNovel.title}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full w-full rounded-xl bg-slate-950/90 p-4 flex flex-col justify-between border border-white/10">
                      <div className="space-y-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {currentNovel.genre || '長篇小說'}
                        </span>
                        <h2 className="text-lg font-black text-white leading-tight line-clamp-3">
                          {currentNovel.title}
                        </h2>
                      </div>

                      <div className="space-y-1 pt-4 border-t border-white/10 text-[11px] text-slate-400">
                        <p>基調：{currentNovel.tone || '精彩紛呈'}</p>
                        <p>章節：{sortedChapters.length} 回全</p>
                        <p className="font-mono text-purple-300 font-bold">{totalWordCount.toLocaleString()} 字</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 書籍主題與故事簡介 (不含劇本、角色卡等後台雜訊) */}
                <div className="flex-1 space-y-5">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {currentNovel.genre}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        風格基調：{currentNovel.tone}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        總計 {sortedChapters.length} 章 · {totalWordCount.toLocaleString()} 字
                      </span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                      {currentNovel.title}
                    </h1>
                  </div>

                  {/* 核心故事梗概與世界觀主題 (只呈現故事本身) */}
                  <div className="space-y-3 bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80">
                    <h3 className="text-xs font-bold text-purple-300 flex items-center gap-1.5 uppercase tracking-wider">
                      <Compass className="w-3.5 h-3.5" />
                      <span>故事簡介與世界主題</span>
                    </h3>
                    <p className="text-slate-300 text-sm leading-relaxed text-justify font-serif">
                      {currentNovel.main_plot || currentNovel.world_background || '這是一部波瀾壯闊的精彩冒險，跟隨主角的腳步踏入未知的奇境旅程...'}
                    </p>
                  </div>

                  {/* 閱讀 CTA 按鈕 */}
                  <div className="flex items-center gap-3 pt-2 flex-wrap">
                    {sortedChapters.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setReadingChapterId(sortedChapters[0].id)}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:opacity-90 text-white font-extrabold text-sm shadow-xl shadow-purple-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>立即閱讀第一章</span>
                      </button>
                    )}

                    <a
                      href="#chapter-catalog"
                      className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-slate-200 font-bold text-sm transition"
                    >
                      <List className="w-4 h-4 text-purple-400" />
                      <span>瀏覽全書目錄 ({sortedChapters.length} 章)</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>


            {/* ================= 全書章節故事目錄 (Table of Chapters) ================= */}
            <section id="chapter-catalog" className="space-y-4 pt-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                    <List className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">全書故事章節目錄</h2>
                    <p className="text-xs text-slate-400">點選任一章節即可立即暢讀正文故事</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-purple-400 bg-purple-950/40 px-3 py-1 rounded-full border border-purple-500/30">
                  共 {sortedChapters.length} 回
                </span>
              </div>

              {sortedChapters.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-xs">
                  目前小說尚未建立任何章節。
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {sortedChapters.map((ch) => {
                    const hasContent = Boolean(ch.content && ch.content.trim());
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setReadingChapterId(ch.id)}
                        className="group text-left p-4 rounded-2xl bg-slate-900/70 hover:bg-slate-800/90 border border-slate-800/90 hover:border-purple-500/50 shadow-md transition flex flex-col justify-between gap-3 relative overflow-hidden"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-purple-400 font-mono">
                              第 {ch.chapter_number} 章
                            </span>
                            {hasContent ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                                {ch.word_count || ch.content.replace(/\s+/g, '').length} 字
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-500">
                                待更新
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-sm text-slate-200 group-hover:text-purple-300 transition line-clamp-1">
                            {ch.title}
                          </h3>
                        </div>

                        {/* 摘要節錄 (僅正文故事片段，絕無大綱/提示詞) */}
                        <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2 font-serif opacity-80">
                          {hasContent 
                            ? ch.content.slice(0, 120).replace(/\n/g, ' ') 
                            : '（作者正在醞釀本章劇情...）'}
                        </p>

                        <div className="flex items-center justify-end text-[11px] font-semibold text-purple-400 group-hover:translate-x-1 transition">
                          <span>開始閱讀</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* ================= 浮動章節目錄抽屜 Modal ================= */}
      {catalogDrawerOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-150"
          onClick={() => setCatalogDrawerOpen(false)}
        >
          <div 
            className="w-full max-w-sm bg-slate-900 border-l border-slate-800 h-full p-6 space-y-4 overflow-y-auto text-slate-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 truncate pr-2">
                {currentNovel?.cover_url ? (
                  <img
                    src={currentNovel.cover_url}
                    alt=""
                    className="w-7 h-9 rounded object-cover border border-slate-700/80 shrink-0 shadow-sm"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-7 h-9 rounded bg-purple-900/40 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                    <List className="w-4 h-4" />
                  </div>
                )}
                <div className="truncate">
                  <h3 className="font-bold text-sm text-slate-100 truncate">
                    {currentNovel?.title || '作品目錄'}
                  </h3>
                  <p className="text-[10px] text-purple-400 font-mono">
                    全書目錄 ({sortedChapters.length} 回)
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setCatalogDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              {sortedChapters.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setReadingChapterId(ch.id);
                    setCatalogDrawerOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between transition ${
                    ch.id === readingChapterId 
                      ? 'bg-purple-600/20 text-purple-300 font-bold border border-purple-500/40' 
                      : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <span className="truncate pr-2">
                    第 {ch.chapter_number} 章：{ch.title}
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                    {ch.word_count || 0}字
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 前台頁尾 */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500 font-mono space-y-1">
        <p>KongGuLi 自動小說生成器 · 讀者前台模式</p>
        <p className="text-[10px] opacity-60">故事正文純淨展示，不含劇本、角色與世界書後台設定</p>
      </footer>
    </div>
  );
};
