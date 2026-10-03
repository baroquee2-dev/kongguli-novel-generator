import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Novel, NovelListItem } from '../types';
import { 
  BookOpen, ArrowLeft, List, Library, Clock, ChevronRight, ChevronLeft, 
  PenTool, Compass, Search, Flame, Dices, Layers, FileText,
  SlidersHorizontal
} from 'lucide-react';

interface Props {
  novels: NovelListItem[];
  currentNovel: Novel | null;
  onSelectNovel: (id: string) => void;
  onBackToStudio: () => void;
}

// 格式化字數顯示 (例如：2.4 萬字 或 3,250 字)
const formatWords = (count: number = 0) => {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)} 萬字`;
  }
  return `${count.toLocaleString()} 字`;
};

// 根據書籍 ID 與題材產生經典精裝書皮配色漸層
const getBookCoverTheme = (id: string, genre: string = '') => {
  const hash = (id + (genre || '')).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const themes = [
    {
      bg: 'from-purple-900 via-indigo-950 to-slate-950',
      border: 'border-purple-500/40',
      accent: 'text-purple-300',
      tagBg: 'bg-purple-500/20 text-purple-200 border-purple-500/30',
      glow: 'shadow-purple-950/70',
    },
    {
      bg: 'from-amber-900 via-yellow-950 to-slate-950',
      border: 'border-amber-500/40',
      accent: 'text-amber-300',
      tagBg: 'bg-amber-500/20 text-amber-200 border-amber-500/30',
      glow: 'shadow-amber-950/70',
    },
    {
      bg: 'from-emerald-900 via-teal-950 to-slate-950',
      border: 'border-emerald-500/40',
      accent: 'text-emerald-300',
      tagBg: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30',
      glow: 'shadow-emerald-950/70',
    },
    {
      bg: 'from-rose-900 via-red-950 to-slate-950',
      border: 'border-rose-500/40',
      accent: 'text-rose-300',
      tagBg: 'bg-rose-500/20 text-rose-200 border-rose-500/30',
      glow: 'shadow-rose-950/70',
    },
    {
      bg: 'from-blue-900 via-cyan-950 to-slate-950',
      border: 'border-blue-500/40',
      accent: 'text-blue-300',
      tagBg: 'bg-blue-500/20 text-blue-200 border-blue-500/30',
      glow: 'shadow-blue-950/70',
    },
  ];
  return themes[hash % themes.length];
};

export const FrontstageView: React.FC<Props> = ({
  novels,
  currentNovel,
  onSelectNovel,
  onBackToStudio,
}) => {
  // 檢視模式：'bookstore' (商業書城大廳) | 'book_detail' (單書專頁與章節目錄) | 'reader' (正文沉浸式閱讀)
  const [viewMode, setViewMode] = useState<'bookstore' | 'book_detail' | 'reader'>('bookstore');

  // 當前閱讀的章節 ID (null 表示不在閱讀器中)
  const [readingChapterId, setReadingChapterId] = useState<string | null>(null);

  // 跨小說跳轉至第一章標記
  const [pendingReadFirstChapter, setPendingReadFirstChapter] = useState(false);

  // 搜尋與篩選
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedTone, setSelectedTone] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'chapters' | 'words' | 'newest'>('featured');

  // 主打書推薦 ID (預設為當前選擇作品，或第一本)
  const [spotlightNovelId, setSpotlightNovelId] = useState<string>(
    currentNovel?.id || (novels.length > 0 ? novels[0].id : '')
  );

  // 讀者閱讀設定
  const [readerTheme, setReaderTheme] = useState<'dark' | 'sepia' | 'pitch' | 'paper'>('dark');
  const [readerFontSize, setReaderFontSize] = useState<number>(18);
  const [readerFontFamily, setReaderFontFamily] = useState<'serif' | 'sans'>('serif');
  const [readerWidth, setReaderWidth] = useState<'normal' | 'wide' | 'narrow'>('normal');

  // 閱讀滾動進度條 (0 - 100%)
  const [scrollProgress, setScrollProgress] = useState(0);

  // 浮動章節目錄抽屜
  const [catalogDrawerOpen, setCatalogDrawerOpen] = useState(false);

  // 橫向書架滾動 ref
  const shelfScrollRef = useRef<HTMLDivElement>(null);

  // 當前選中小說的排序後章節
  const sortedChapters = useMemo(() => {
    if (!currentNovel?.chapters) return [];
    return [...currentNovel.chapters].sort((a, b) => a.chapter_number - b.chapter_number);
  }, [currentNovel?.chapters]);

  // 當前閱讀中的章節物件
  const currentReadingChapter = useMemo(() => {
    if (!readingChapterId) return null;
    return sortedChapters.find(c => c.id === readingChapterId) || null;
  }, [readingChapterId, sortedChapters]);

  // 當前章節索引
  const currentChapterIndex = useMemo(() => {
    if (!readingChapterId) return -1;
    return sortedChapters.findIndex(c => c.id === readingChapterId);
  }, [readingChapterId, sortedChapters]);

  const prevChapter = currentChapterIndex > 0 ? sortedChapters[currentChapterIndex - 1] : null;
  const nextChapter = currentChapterIndex >= 0 && currentChapterIndex < sortedChapters.length - 1 
    ? sortedChapters[currentChapterIndex + 1] 
    : null;

  // 當前小說總字數
  const currentNovelWordCount = useMemo(() => {
    if (!sortedChapters) return 0;
    return sortedChapters.reduce((acc, c) => acc + (c.word_count || 0), 0);
  }, [sortedChapters]);

  // 所有分類清單 (去重)
  const allGenres = useMemo(() => {
    const set = new Set<string>();
    novels.forEach(n => {
      if (n.genre && n.genre.trim()) {
        n.genre.split(/[,、/，\s]+/).forEach(g => {
          if (g.trim()) set.add(g.trim());
        });
      }
    });
    return Array.from(set);
  }, [novels]);

  // 所有基調清單 (去重)
  const allTones = useMemo(() => {
    const set = new Set<string>();
    novels.forEach(n => {
      if (n.tone && n.tone.trim()) set.add(n.tone.trim());
    });
    return Array.from(set);
  }, [novels]);

  // 搜尋與篩選後的小說清單
  const filteredNovels = useMemo(() => {
    return novels.filter(n => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || 
        n.title.toLowerCase().includes(q) ||
        (n.genre && n.genre.toLowerCase().includes(q)) ||
        (n.tone && n.tone.toLowerCase().includes(q)) ||
        (n.main_plot && n.main_plot.toLowerCase().includes(q));

      const matchGenre = selectedGenre === 'all' || 
        (n.genre && n.genre.includes(selectedGenre));

      const matchTone = selectedTone === 'all' || 
        (n.tone && n.tone.includes(selectedTone));

      return matchQuery && matchGenre && matchTone;
    }).sort((a, b) => {
      if (sortBy === 'chapters') return b.chapters_count - a.chapters_count;
      if (sortBy === 'words') return (b.total_word_count || 0) - (a.total_word_count || 0);
      return 0; // featured / default
    });
  }, [novels, searchQuery, selectedGenre, selectedTone, sortBy]);

  // 主打作品物件
  const spotlightNovel = useMemo(() => {
    if (spotlightNovelId) {
      const found = novels.find(n => n.id === spotlightNovelId);
      if (found) return found;
    }
    return currentNovel ? novels.find(n => n.id === currentNovel.id) || novels[0] : novels[0] || null;
  }, [spotlightNovelId, novels, currentNovel]);

  // 監聽閱讀模式下的滾動進度條
  useEffect(() => {
    if (viewMode !== 'reader') return;
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const progress = (window.scrollY / totalHeight) * 100;
        setScrollProgress(Math.min(100, Math.max(0, progress)));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [viewMode, readingChapterId]);

  // 切換章節或作品時平滑滾動到頂端
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [viewMode, readingChapterId, currentNovel?.id]);

  // 處理非同步選擇小說並自動進入第一章閱讀
  useEffect(() => {
    if (pendingReadFirstChapter && currentNovel) {
      const chapters = [...currentNovel.chapters].sort((a, b) => a.chapter_number - b.chapter_number);
      if (chapters.length > 0) {
        setReadingChapterId(chapters[0].id);
        setViewMode('reader');
      } else {
        setViewMode('book_detail');
      }
      setPendingReadFirstChapter(false);
    }
  }, [currentNovel, pendingReadFirstChapter]);

  // 橫向書架左右滾動操作
  const scrollShelf = (direction: 'left' | 'right') => {
    if (shelfScrollRef.current) {
      const offset = direction === 'left' ? -380 : 380;
      shelfScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // 立即開讀某本小說
  const handleQuickRead = (novelId: string) => {
    if (currentNovel?.id === novelId) {
      const chapters = sortedChapters;
      if (chapters.length > 0) {
        setReadingChapterId(chapters[0].id);
        setViewMode('reader');
      } else {
        setViewMode('book_detail');
      }
    } else {
      setPendingReadFirstChapter(true);
      onSelectNovel(novelId);
    }
  };

  // 檢視某本小說專頁與目錄
  const handleViewDetail = (novelId: string) => {
    if (currentNovel?.id !== novelId) {
      onSelectNovel(novelId);
    }
    setReadingChapterId(null);
    setViewMode('book_detail');
  };

  // 隨機挑選一本好書
  const handleSurprisePick = () => {
    if (novels.length === 0) return;
    const randomIndex = Math.floor(Math.random() * novels.length);
    const picked = novels[randomIndex];
    handleViewDetail(picked.id);
  };

  // 閱讀器主題色調
  const themeClasses = {
    dark: 'bg-[#090b10] text-slate-200 border-slate-800',
    sepia: 'bg-[#f7ebd4] text-[#2c2214] border-[#e4d4b2]',
    pitch: 'bg-black text-neutral-300 border-neutral-900',
    paper: 'bg-[#fbfaf6] text-[#1c1917] border-[#e7e5e4]',
  }[readerTheme];

  const readerContainerClasses = {
    dark: 'bg-slate-900/60 border-slate-800 text-slate-100',
    sepia: 'bg-[#f0e2c8] border-[#dfcdab] text-[#251b0f]',
    pitch: 'bg-neutral-950 border-neutral-900 text-neutral-200',
    paper: 'bg-white border-stone-200 text-stone-900 shadow-sm',
  }[readerTheme];

  const readerWidthClasses = {
    narrow: 'max-w-2xl',
    normal: 'max-w-3xl',
    wide: 'max-w-4xl',
  }[readerWidth];

  // 渲染立體書封核心組件
  const renderBookCover = (novelItem: { id: string; title: string; genre?: string; tone?: string; cover_url?: string; chapters_count?: number }, size: 'sm' | 'md' | 'lg' | 'hero' = 'md') => {
    const theme = getBookCoverTheme(novelItem.id, novelItem.genre);
    const sizeClasses = {
      sm: 'w-16 h-22 rounded-r-md rounded-l-xs text-[10px]',
      md: 'w-32 h-44 sm:w-36 sm:h-52 rounded-r-xl rounded-l-sm',
      lg: 'w-40 h-56 sm:w-48 sm:h-68 rounded-r-2xl rounded-l-sm',
      hero: 'w-48 h-68 sm:w-60 sm:h-84 rounded-r-2xl rounded-l-md shadow-2xl',
    }[size];

    return (
      <div className={`relative ${sizeClasses} overflow-hidden shrink-0 border ${theme.border} shadow-xl ${theme.glow} select-none group transition-transform duration-300`}>
        {novelItem.cover_url ? (
          <div className="w-full h-full relative">
            <img
              src={novelItem.cover_url}
              alt={novelItem.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {/* 精裝書脊陰影與折線 */}
            <div className="absolute inset-y-0 left-0 w-3.5 bg-gradient-to-r from-black/75 via-black/25 to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 left-3 w-[1px] bg-white/20 pointer-events-none" />
            {/* 底部微浮標籤 */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none flex items-end p-2.5">
              <span className="text-[11px] font-bold text-white/95 truncate drop-shadow-md">
                {novelItem.title}
              </span>
            </div>
          </div>
        ) : (
          /* 無自訂封面時，渲染精緻燙金風格排版 */
          <div className={`w-full h-full bg-gradient-to-br ${theme.bg} p-3 sm:p-4 flex flex-col justify-between relative`}>
            {/* 書脊陰影 */}
            <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 left-2.5 w-[1px] bg-white/10 pointer-events-none" />
            {/* 金邊裝飾框 */}
            <div className="absolute inset-2 border border-white/10 rounded pointer-events-none" />

            <div className="space-y-1 relative z-10">
              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/10 text-white/90 border border-white/20 backdrop-blur-sm">
                {novelItem.genre || '長篇小說'}
              </span>
              <h3 className="font-black text-white text-sm sm:text-base leading-snug line-clamp-3 pt-1 tracking-tight drop-shadow">
                {novelItem.title}
              </h3>
            </div>

            <div className="relative z-10 pt-2 border-t border-white/10 text-[10px] text-white/70 space-y-0.5 font-serif">
              <p className="truncate opacity-80">{novelItem.tone || '原創傳奇'}</p>
              <p className="font-mono text-white/90 font-bold text-[9px]">
                {novelItem.chapters_count !== undefined ? `${novelItem.chapters_count} 回全` : '完稿藏書'}
              </p>
            </div>
          </div>
        )}

        {/* 書頁厚度側邊立體邊線 */}
        <div className="absolute inset-y-0 right-0 w-[2px] bg-white/30 pointer-events-none" />
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${themeClasses} transition-colors duration-200 font-sans flex flex-col selection:bg-purple-600 selection:text-white`}>
      {/* 閱讀模式下的頂部滾動進度條 */}
      {viewMode === 'reader' && (
        <div 
          className="fixed top-0 left-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 z-50 transition-all duration-100"
          style={{ width: `${scrollProgress}%` }}
        />
      )}

      {/* ================= 商業書店頂級導覽列 ================= */}
      <header className={`sticky top-0 z-40 h-16 border-b backdrop-blur-xl px-4 sm:px-8 flex items-center justify-between transition-colors duration-200 ${
        readerTheme === 'sepia' 
          ? 'bg-[#f7ebd4]/95 border-[#e2d0ab]' 
          : readerTheme === 'paper'
          ? 'bg-[#fbfaf6]/95 border-[#e7e5e4]'
          : 'bg-[#090b10]/90 border-white/10'
      }`}>
        {/* 左側：書城標誌與主導覽 */}
        <div className="flex items-center gap-6">
          <button 
            type="button"
            onClick={() => {
              setViewMode('bookstore');
              setReadingChapterId(null);
            }}
            className="flex items-center gap-3 group text-left"
            title="回到商業書城大廳首頁"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-purple-600/30 group-hover:scale-105 group-hover:rotate-1 transition">
              <Library className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base sm:text-lg tracking-wider bg-gradient-to-r from-purple-300 via-pink-300 to-amber-200 bg-clip-text text-transparent">
                  孔固力書城
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30">
                  FLAGSHIP
                </span>
              </div>
              <span className="block text-[10px] text-slate-400 font-mono tracking-tight">
                KONGGULI ORIGINAL BOOKS
              </span>
            </div>
          </button>

          {/* 導覽分頁按鈕 */}
          <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-white/10">
            <button
              onClick={() => {
                setViewMode('bookstore');
                setReadingChapterId(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'bookstore'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Library className="w-3.5 h-3.5" />
              <span>全館書庫</span>
            </button>

            {currentNovel && (
              <button
                onClick={() => {
                  setViewMode('book_detail');
                  setReadingChapterId(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  viewMode === 'book_detail'
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="max-w-[130px] truncate">《{currentNovel.title}》</span>
              </button>
            )}

            {readingChapterId && currentReadingChapter && (
              <button
                onClick={() => setViewMode('reader')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  viewMode === 'reader'
                    ? 'bg-pink-600/20 text-pink-300 border border-pink-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="max-w-[120px] truncate">第 {currentReadingChapter.chapter_number} 章</span>
              </button>
            )}
          </nav>
        </div>

        {/* 右側：快捷功能、外觀切換與創作者後台入口 */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* 隨機挑一本好書按鈕 */}
          <button
            type="button"
            onClick={handleSurprisePick}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm transition"
            title="隨機翻開一部館藏小說探索"
          >
            <Dices className="w-3.5 h-3.5" />
            <span>隨機挑書</span>
          </button>

          {/* 閱讀環境配色切換 */}
          <div className="flex items-center p-0.5 rounded-xl border border-white/10 bg-white/5 text-xs">
            {(['dark', 'sepia', 'pitch', 'paper'] as const).map(t => (
              <button
                key={t}
                onClick={() => setReaderTheme(t)}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                  readerTheme === t ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title={`切換為${t === 'dark' ? '深邃夜讀' : t === 'sepia' ? '羊皮古籍' : t === 'pitch' ? '純黑極簡' : '晨曦柔白'}風格`}
              >
                {t === 'dark' ? '夜讀' : t === 'sepia' ? '羊皮' : t === 'pitch' ? '極黑' : '暖白'}
              </button>
            ))}
          </div>

          {/* 🌟 創作者後台入口按鈕 (清楚區隔商業前台與創作工作室) */}
          <button
            type="button"
            onClick={onBackToStudio}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:opacity-90 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0"
            title="返回劇本、角色卡與世界觀創作後台"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">創作者後台</span>
            <span className="sm:hidden">後台</span>
          </button>
        </div>
      </header>

      {/* ================= 前台主視圖區域 ================= */}
      <main className="flex-1 w-full">
        {/* ======================= VIEW 1: 商業小說書城大廳 ======================= */}
        {viewMode === 'bookstore' && (
          <div className="space-y-12 pb-20 animate-in fade-in duration-300">
            {/* 1. 商業旗艦 Hero Spotlight 主打展位 */}
            {spotlightNovel && (
              <section className="relative overflow-hidden bg-gradient-to-b from-purple-950/30 via-slate-950 to-[#090b10] border-b border-white/10 px-4 sm:px-8 py-10 lg:py-16">
                <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute -bottom-20 left-10 w-[400px] h-[400px] bg-pink-600/10 rounded-full blur-[100px] pointer-events-none" />

                <div className="max-w-6xl mx-auto flex flex-col-reverse lg:flex-row items-center gap-10 lg:gap-16">
                  {/* 主打文字與呼籲行動 */}
                  <div className="flex-1 space-y-6 text-center lg:text-left">
                    <div className="flex items-center justify-center lg:justify-start gap-2.5 flex-wrap">
                      <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-sm">
                        <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        本週旗艦主打
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {spotlightNovel.genre}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/10 text-slate-300 border border-white/10">
                        風格：{spotlightNovel.tone}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
                        {spotlightNovel.title}
                      </h1>
                      <p className="text-sm sm:text-base text-slate-300 font-serif leading-relaxed line-clamp-3 max-w-2xl mx-auto lg:mx-0">
                        {spotlightNovel.main_plot || '一部跌宕起伏的曠世之作，正等待著您翻開扉頁，步入這場震撼人心的文字盛宴。'}
                      </p>
                    </div>

                    {/* 數據標籤 */}
                    <div className="flex items-center justify-center lg:justify-start gap-6 text-xs text-slate-400 font-mono">
                      <div>
                        <span className="block text-slate-500 text-[10px]">全書規模</span>
                        <span className="text-white font-bold text-sm">{spotlightNovel.chapters_count} 回完</span>
                      </div>
                      <div className="w-[1px] h-6 bg-white/10" />
                      <div>
                        <span className="block text-slate-500 text-[10px]">總字數估算</span>
                        <span className="text-purple-300 font-bold text-sm">{formatWords(spotlightNovel.total_word_count)}</span>
                      </div>
                      <div className="w-[1px] h-6 bg-white/10" />
                      <div>
                        <span className="block text-slate-500 text-[10px]">閱讀時間</span>
                        <span className="text-amber-300 font-bold text-sm">約 {Math.max(1, Math.round((spotlightNovel.total_word_count || 3000) / 400))} 分鐘</span>
                      </div>
                    </div>

                    {/* 按鈕組 */}
                    <div className="flex items-center justify-center lg:justify-start gap-3 pt-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleQuickRead(spotlightNovel.id)}
                        className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-extrabold text-sm shadow-xl shadow-purple-600/30 hover:scale-105 transition transform active:scale-95"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>立即暢讀第 1 章</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleViewDetail(spotlightNovel.id)}
                        className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm border border-white/15 backdrop-blur-md transition"
                      >
                        <List className="w-4 h-4 text-purple-400" />
                        <span>查看章節目錄</span>
                      </button>

                      {novels.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const candidates = novels.filter(n => n.id !== spotlightNovel.id);
                            if (candidates.length > 0) {
                              const nextOne = candidates[Math.floor(Math.random() * candidates.length)];
                              setSpotlightNovelId(nextOne.id);
                            }
                          }}
                          className="flex items-center gap-1.5 px-4 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-amber-300 border border-white/10 transition text-sm font-semibold"
                          title="隨機換一部作品置頂推薦"
                        >
                          <Dices className="w-4 h-4 text-amber-400" />
                          <span>換一本推薦</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 右側：立體 3D 精裝實體書模型 */}
                  <div 
                    className="relative cursor-pointer hover:scale-105 transition-transform duration-500"
                    onClick={() => handleViewDetail(spotlightNovel.id)}
                    title="點擊查看此書詳細目錄與簡介"
                  >
                    {renderBookCover(spotlightNovel, 'hero')}
                  </div>
                </div>
              </section>
            )}

            {/* 2. 🌟 核心亮點：所有書本一字排開 · 實體圖書陳列架 (Horizontal Book Shelf) */}
            <section className="max-w-7xl mx-auto px-4 sm:px-8 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-lg bg-purple-500/20 text-purple-400">
                      <Layers className="w-4 h-4" />
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                      實體書架 · 一字排開挑選
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400">
                    全館 {novels.length} 部作品立體陳列，彷彿置身實體書店，點選即可翻開閱讀
                  </p>
                </div>

                {/* 左右滑動控制按鈕 */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => scrollShelf('left')}
                    className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white transition active:scale-95"
                    title="向左滑動書架"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollShelf('right')}
                    className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white transition active:scale-95"
                    title="向右滑動書架"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 橫向滑動陳列架容器 */}
              <div className="relative pt-6 pb-2">
                <div
                  ref={shelfScrollRef}
                  className="flex gap-6 sm:gap-8 overflow-x-auto pb-6 pt-2 px-2 scroll-smooth custom-scrollbar select-none"
                >
                  {novels.map((novel) => (
                    <div
                      key={novel.id}
                      className="group shrink-0 flex flex-col items-center cursor-pointer relative"
                      onClick={() => handleViewDetail(novel.id)}
                    >
                      {/* 書籍本體 */}
                      <div className="transform group-hover:-translate-y-4 group-hover:scale-105 transition-all duration-300">
                        {renderBookCover(novel, 'md')}
                      </div>

                      {/* 書本底部立體陰影 */}
                      <div className="w-24 sm:w-28 h-2 bg-black/70 rounded-full blur-md group-hover:w-32 transition-all duration-300 mt-2" />

                      {/* 書名與精簡資訊 */}
                      <div className="text-center mt-2.5 max-w-[130px] sm:max-w-[150px] space-y-0.5">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-purple-300 transition truncate">
                          {novel.title}
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate">
                          {novel.genre} · {novel.chapters_count} 回
                        </p>
                      </div>

                      {/* 懸浮時浮現的快速動作按鈕 */}
                      <div className="absolute inset-x-0 bottom-16 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 z-20 flex items-center justify-center gap-1.5 px-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickRead(novel.id);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-[11px] font-bold shadow-lg flex items-center gap-1"
                        >
                          <BookOpen className="w-3 h-3" /> 開讀
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetail(novel.id);
                          }}
                          className="px-2 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-white/20 text-[11px] font-medium shadow-lg"
                        >
                          目錄
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 實體書架木紋托底台 (Bookstore Shelf Ledge) */}
                <div className="h-3.5 w-full bg-gradient-to-r from-[#20150b] via-[#3d2714] to-[#20150b] rounded-b-md border-t-2 border-[#80532c]/50 shadow-2xl relative">
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-amber-400/20" />
                </div>
              </div>
            </section>

            {/* 3. 商業書城全館陳列專櫃 (Commercial Novel Grid with Filter & Search) */}
            <section className="max-w-7xl mx-auto px-4 sm:px-8 space-y-6 pt-6">
              {/* 篩選與搜尋工具列 */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* 即時搜尋框 */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜尋書名、題材類型、基調或劇情關鍵字..."
                      className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* 排序方式選單 */}
                  <div className="flex items-center gap-3 self-end md:self-auto">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" /> 排序：
                    </span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                    >
                      <option value="featured">🔥 熱門推薦</option>
                      <option value="chapters">📚 章節最多</option>
                      <option value="words">✍️ 字數最多</option>
                    </select>
                  </div>
                </div>

                {/* 分類標籤快速切換 */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 custom-scrollbar text-xs">
                  <span className="text-slate-500 shrink-0 font-medium">題材：</span>
                  <button
                    onClick={() => setSelectedGenre('all')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition shrink-0 ${
                      selectedGenre === 'all'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    全部題材
                  </button>
                  {allGenres.map((g) => (
                    <button
                      key={g}
                      onClick={() => setSelectedGenre(g)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition shrink-0 ${
                        selectedGenre === g
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>

                {/* 基調標籤快速切換 */}
                {allTones.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 custom-scrollbar text-xs border-t border-white/5">
                    <span className="text-slate-500 shrink-0 font-medium">基調：</span>
                    <button
                      onClick={() => setSelectedTone('all')}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition shrink-0 ${
                        selectedTone === 'all'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      全部基調
                    </button>
                    {allTones.map((t) => (
                      <button
                        key={t}
                        onClick={() => setSelectedTone(t)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition shrink-0 ${
                          selectedTone === t
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 書本卡片大網格 (Commercial Grid) */}
              {filteredNovels.length === 0 ? (
                <div className="py-20 text-center space-y-3 bg-white/[0.02] rounded-3xl border border-white/5">
                  <Search className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-slate-400 text-sm">查無符合搜尋與篩選條件的小說作品。</p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedGenre('all');
                      setSelectedTone('all');
                    }}
                    className="text-xs text-purple-400 hover:underline"
                  >
                    重設所有篩選條件
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredNovels.map((novel) => (
                    <div
                      key={novel.id}
                      className="group p-5 rounded-3xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-purple-500/40 shadow-xl transition-all duration-300 flex gap-5 cursor-pointer relative overflow-hidden"
                      onClick={() => handleViewDetail(novel.id)}
                    >
                      {/* 書卡左側：立體書封 */}
                      <div className="shrink-0 group-hover:scale-105 transition-transform duration-300">
                        {renderBookCover(novel, 'md')}
                      </div>

                      {/* 書卡右側：詳細介紹與快速動作 */}
                      <div className="flex-1 flex flex-col justify-between min-w-0 space-y-2">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              {novel.genre}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-slate-400">
                              {novel.tone}
                            </span>
                          </div>

                          <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-purple-300 transition line-clamp-2">
                            {novel.title}
                          </h3>

                          <p className="text-xs text-slate-400 line-clamp-3 font-serif leading-relaxed">
                            {novel.main_plot || '精緻編排的原創故事，點擊直接展開全書閱讀。'}
                          </p>
                        </div>

                        {/* 底部數據與按鈕列 */}
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                          <span className="text-[11px] font-mono text-slate-400">
                            共 <strong className="text-purple-300">{novel.chapters_count}</strong> 章 · {formatWords(novel.total_word_count)}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickRead(novel.id);
                            }}
                            className="flex items-center gap-1 px-3 py-1 rounded-xl bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/40 text-xs font-bold transition"
                          >
                            <span>開讀</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ======================= VIEW 2: 單書深度專頁與全書目錄 ======================= */}
        {viewMode === 'book_detail' && currentNovel && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10 animate-in fade-in duration-200">
            {/* 頂部返回導覽列 */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <button
                type="button"
                onClick={() => setViewMode('bookstore')}
                className="flex items-center gap-2 text-xs font-bold text-purple-400 hover:text-purple-300 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>返回商業書城大廳挑選其他書籍</span>
              </button>

              <span className="text-xs text-slate-400 font-mono">
                全書目錄 ({sortedChapters.length} 章)
              </span>
            </div>

            {/* 書籍主題大卡 (Hero Showcase) */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-purple-950/40 to-slate-900 border border-purple-500/30 p-6 sm:p-10 shadow-2xl">
              <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                {/* 立體書封模型 */}
                <div className="mx-auto md:mx-0">
                  {renderBookCover(currentNovel, 'hero')}
                </div>

                {/* 書籍主題與故事簡介 */}
                <div className="flex-1 space-y-5 text-center md:text-left">
                  <div className="space-y-2">
                    <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {currentNovel.genre}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        風格基調：{currentNovel.tone}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        總計 {sortedChapters.length} 章 · {currentNovelWordCount.toLocaleString()} 字
                      </span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                      {currentNovel.title}
                    </h1>
                  </div>

                  {/* 核心主線介紹 */}
                  <div className="space-y-2 text-slate-300 text-sm leading-relaxed font-serif bg-slate-950/40 p-4 rounded-2xl border border-white/5 text-left">
                    <h4 className="text-xs font-bold text-purple-400 flex items-center gap-1 font-sans">
                      <Compass className="w-3.5 h-3.5" /> 故事主線與梗概
                    </h4>
                    <p className="whitespace-pre-line">
                      {currentNovel.main_plot || '（本作暫未設定主線劇情梗概，請直接從下方目錄暢讀正文）'}
                    </p>
                  </div>

                  {/* 世界觀概述 */}
                  {currentNovel.world_background && (
                    <div className="space-y-1.5 text-slate-400 text-xs leading-relaxed font-serif bg-slate-950/20 p-3.5 rounded-xl border border-white/5 text-left">
                      <h4 className="text-[11px] font-bold text-slate-300 font-sans">世界觀與時代背景：</h4>
                      <p className="line-clamp-3">{currentNovel.world_background}</p>
                    </div>
                  )}

                  {/* 立即開讀按鈕列 */}
                  <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
                    {sortedChapters.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setReadingChapterId(sortedChapters[0].id);
                          setViewMode('reader');
                        }}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-purple-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>從第 1 章開始閱讀</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setViewMode('bookstore')}
                      className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-sm font-medium transition"
                    >
                      返回書城大廳
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 完整章節目錄大卡片 */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                    <List className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">全書章節目錄</h2>
                    <p className="text-xs text-slate-400">點選任一章節即可立即暢讀正文故事</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-purple-400 bg-purple-950/40 px-3 py-1 rounded-full border border-purple-500/30">
                  共 {sortedChapters.length} 回
                </span>
              </div>

              {sortedChapters.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-xs bg-white/[0.02] rounded-2xl border border-white/5">
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
                        onClick={() => {
                          setReadingChapterId(ch.id);
                          setViewMode('reader');
                        }}
                        className="group text-left p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-purple-500/50 shadow-md transition flex flex-col justify-between gap-3 relative overflow-hidden"
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
                              <span className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-slate-500">
                                待更新
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-sm text-slate-200 group-hover:text-purple-300 transition line-clamp-1">
                            {ch.title}
                          </h3>
                        </div>

                        {/* 摘要節錄 */}
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

        {/* ======================= VIEW 3: 正文沉浸式閱讀器 ======================= */}
        {viewMode === 'reader' && currentNovel && currentReadingChapter && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8 animate-in fade-in duration-200">
            {/* 閱讀器頂端輔助列 */}
            <div className={`flex flex-wrap items-center justify-between gap-3 border-b pb-4 ${
              readerTheme === 'sepia' 
                ? 'border-[#e4d4b2]' 
                : readerTheme === 'paper'
                ? 'border-stone-200'
                : 'border-white/10'
            }`}>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('bookstore')}
                  className="flex items-center gap-1.5 text-xs font-semibold text-purple-400 hover:opacity-80 transition"
                  title="回到商業書城大廳"
                >
                  <Library className="w-4 h-4" />
                  <span>書城大廳</span>
                </button>
                <span className="opacity-40">/</span>
                <button
                  type="button"
                  onClick={() => setViewMode('book_detail')}
                  className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 transition truncate max-w-[200px]"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-purple-400" />
                  <span>《{currentNovel.title}》目錄</span>
                </button>
              </div>

              {/* 閱讀控制按鈕群 */}
              <div className="flex items-center gap-3">
                {/* 目錄抽屜快速開關 */}
                <button
                  type="button"
                  onClick={() => setCatalogDrawerOpen(true)}
                  className="px-2.5 py-1 rounded-lg border border-current text-xs font-medium hover:opacity-80 transition flex items-center gap-1.5"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>目錄抽屜</span>
                </button>

                {/* 字體大小 */}
                <div className="flex items-center gap-1 border border-current/20 rounded-lg px-2 py-0.5 text-xs">
                  <button
                    onClick={() => setReaderFontSize(Math.max(14, readerFontSize - 2))}
                    className="hover:opacity-75 font-bold"
                    title="縮小字體"
                  >
                    A-
                  </button>
                  <span className="font-mono text-[11px] px-1">{readerFontSize}px</span>
                  <button
                    onClick={() => setReaderFontSize(Math.min(26, readerFontSize + 2))}
                    className="hover:opacity-75 font-bold"
                    title="放大字體"
                  >
                    A+
                  </button>
                </div>

                {/* 字型切換 (宋體/黑體) */}
                <button
                  type="button"
                  onClick={() => setReaderFontFamily(readerFontFamily === 'serif' ? 'sans' : 'serif')}
                  className="px-2 py-1 rounded-lg border border-current/20 text-xs font-serif hover:opacity-80 transition"
                  title="切換宋體明朝體與黑體"
                >
                  {readerFontFamily === 'serif' ? '宋體' : '黑體'}
                </button>

                {/* 版面寬度切換 */}
                <button
                  type="button"
                  onClick={() => {
                    if (readerWidth === 'normal') setReaderWidth('wide');
                    else if (readerWidth === 'wide') setReaderWidth('narrow');
                    else setReaderWidth('normal');
                  }}
                  className="px-2 py-1 rounded-lg border border-current/20 text-xs font-medium hover:opacity-80 transition hidden sm:inline"
                  title="切換排版寬幅"
                >
                  {readerWidth === 'normal' ? '適中' : readerWidth === 'wide' ? '寬幅' : '精簡'}
                </button>
              </div>
            </div>

            {/* 正文主要閱讀畫布 */}
            <article className={`${readerWidthClasses} mx-auto ${readerContainerClasses} rounded-3xl p-6 sm:p-12 lg:p-16 border shadow-2xl transition-all duration-200`}>
              {/* 章節標題 */}
              <div className="text-center space-y-3 pb-8 sm:pb-12 border-b border-current/10">
                <div className="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider opacity-75 border border-current/20">
                  第 {currentReadingChapter.chapter_number} 章 · 全書第 {currentChapterIndex + 1} / {sortedChapters.length} 回
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                  {currentReadingChapter.title}
                </h1>
                <div className="text-xs opacity-60 font-mono">
                  {currentReadingChapter.word_count || currentReadingChapter.content.length} 字
                </div>
              </div>

              {/* 正文內容段落 */}
              <div 
                className={`pt-8 sm:pt-12 leading-loose tracking-wide select-text space-y-6 ${
                  readerFontFamily === 'serif' ? 'font-serif' : 'font-sans'
                }`}
                style={{ fontSize: `${readerFontSize}px` }}
              >
                {currentReadingChapter.content && currentReadingChapter.content.trim() ? (
                  currentReadingChapter.content.split('\n\n').map((paragraph, idx) => {
                    const trimmed = paragraph.trim();
                    if (!trimmed) return null;
                    return (
                      <p key={idx} className="indent-8 text-justify">
                        {trimmed}
                      </p>
                    );
                  })
                ) : (
                  <div className="py-24 text-center space-y-3 opacity-60">
                    <p className="text-base font-serif">（本章正文正在由作者構思創作中，請稍候再讀）</p>
                  </div>
                )}
              </div>

              {/* 本章結尾翻頁導覽控制 */}
              <div className="mt-16 pt-8 border-t border-current/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                {prevChapter ? (
                  <button
                    type="button"
                    onClick={() => setReadingChapterId(prevChapter.id)}
                    className="w-full sm:w-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border border-current/20 hover:bg-current/5 transition text-xs font-bold"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="truncate max-w-[160px]">上一章：{prevChapter.title}</span>
                  </button>
                ) : (
                  <div className="text-xs opacity-40 px-4 py-2.5">本書開篇第 1 章</div>
                )}

                <button
                  type="button"
                  onClick={() => setViewMode('book_detail')}
                  className="text-xs font-bold text-purple-400 hover:underline"
                >
                  目錄總覽
                </button>

                {nextChapter ? (
                  <button
                    type="button"
                    onClick={() => setReadingChapterId(nextChapter.id)}
                    className="w-full sm:w-auto flex items-center justify-end gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition text-xs font-bold shadow-md"
                  >
                    <span className="truncate max-w-[160px]">下一章：{nextChapter.title}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="text-xs opacity-40 px-4 py-2.5">已是最新章節</div>
                )}
              </div>
            </article>
          </div>
        )}
      </main>

      {/* ================= 浮動章節目錄抽屜 Modal ================= */}
      {catalogDrawerOpen && currentNovel && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end animate-in fade-in duration-150"
          onClick={() => setCatalogDrawerOpen(false)}
        >
          <div 
            className="w-full max-w-sm bg-slate-900 border-l border-slate-800 h-full p-6 space-y-4 overflow-y-auto text-slate-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 truncate pr-2">
                {currentNovel.cover_url ? (
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
                    {currentNovel.title}
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
                    setViewMode('reader');
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

      {/* 商業書城頁尾 */}
      <footer className="border-t border-white/5 py-10 text-center text-xs text-slate-500 font-mono space-y-1 bg-[#07090e]">
        <p className="font-bold text-slate-400">孔固力原創小說書城 · KONGGULI ORIGINAL BOOKS</p>
        <p className="text-[10px] opacity-60">商業旗艦線上閱讀空間 · 故事本體純淨呈現</p>
      </footer>
    </div>
  );
};
