import React, { useState, useEffect, useRef } from 'react';
import type {
  CharacterCard,
  CharacterCardListItem,
  ChatSession,
  ChatSessionListItem,
  ChatMessage
} from '../types';
import { api } from '../api/client';
import {
  MessageSquareHeart, ArrowLeft, Plus, Trash2, Send, RotateCcw, Sparkles,
  Brain, BookOpen, UserCircle2, Settings, Search, FileUp, ChevronLeft,
  ChevronRight, Edit3, Check, X, Copy, Waves, SlidersHorizontal, Loader2,
  MessageCircle, FolderOpen
} from 'lucide-react';

interface Props {
  cards: CharacterCardListItem[];
  currentCard: CharacterCard | null;
  onSelectCard: (id: string) => Promise<void> | void;
  onImportCardSuccess: (card: CharacterCard) => void;
  onBackToStudio: () => void;
  onOpenSettings: () => void;
}

// 輔助函式：替換 {{char}} 與 {{user}} 並將 *動作描寫* 與一般台詞分段美化渲染
const renderFormattedRoleplayText = (rawText: string, charName: string, userName: string) => {
  if (!rawText) return null;
  const replaced = rawText
    .replace(/\{\{char\}\}/gi, charName)
    .replace(/\{\{user\}\}/gi, userName);

  const paragraphs = replaced.split(/\n\n+/);
  return paragraphs.map((para, pIdx) => {
    const trimmed = para.trim();
    if (!trimmed) return null;

    // 切分 *...* 星號動作描寫片段
    const parts = trimmed.split(/(\*[^*]+\*)/g);
    return (
      <p key={pIdx} className="leading-relaxed tracking-wide">
        {parts.map((part, idx) => {
          if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return (
              <span
                key={idx}
                className="italic text-amber-200/85 font-serif px-0.5"
              >
                {part.slice(1, -1)}
              </span>
            );
          }
          return <span key={idx} className="text-slate-100">{part}</span>;
        })}
      </p>
    );
  });
};

export const CharacterChatFrontstageView: React.FC<Props> = ({
  cards,
  currentCard,
  onSelectCard,
  onImportCardSuccess,
  onBackToStudio,
  onOpenSettings
}) => {
  // 視圖模式：'hall' (角色選擇大廳) vs 'chat' (沉浸式角色聊天室)
  const [subView, setSubView] = useState<'hall' | 'chat'>('hall');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // 聊天室狀態
  const [sessionsList, setSessionsList] = useState<ChatSessionListItem[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [summarizingMemory, setSummarizingMemory] = useState(false);
  const [reindexingRag, setReindexingRag] = useState(false);
  const [ragStatusMsg, setRagStatusMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 玩家輸入與單次導演指令
  const [inputText, setInputText] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');
  const [showDirectorInput, setShowDirectorInput] = useState(false);

  // 訊息編輯狀態
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingMsgContent, setEditingMsgContent] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [expandedRagMsgId, setExpandedRagMsgId] = useState<string | null>(null);

  // 右側固定記憶與人設側邊欄
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'memory' | 'persona' | 'lore'>('memory');

  // 新建對話選擇開場白 Modal
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [selectedGreetingIdx, setSelectedGreetingIdx] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (subView === 'chat') {
      scrollToBottom();
    }
  }, [activeSession?.messages.length, sendingReply, subView]);

  // 當選擇某張角色卡進入聊天室時，載入該角色的所有對話 Session，若無則自動建立一個
  const handleEnterCharacterChat = async (cardItemId: string) => {
    setLoadingSession(true);
    setErrorMessage(null);
    setSubView('chat');
    try {
      await onSelectCard(cardItemId);
      const list = await api.listChatSessions(cardItemId);
      setSessionsList(list);
      if (list.length > 0) {
        const fullSession = await api.getChatSession(list[0].id);
        setActiveSession(fullSession);
      } else {
        const created = await api.createChatSession({
          character_id: cardItemId,
          greeting_index: 0
        });
        setActiveSession(created);
        const updatedList = await api.listChatSessions(cardItemId);
        setSessionsList(updatedList);
      }
    } catch (err: any) {
      setErrorMessage(err.message || '載入角色對話失敗');
    } finally {
      setLoadingSession(false);
    }
  };

  // 切換同一個角色的不同對話存檔
  const handleSelectSession = async (sessionId: string) => {
    if (!sessionId || sessionId === activeSession?.id) return;
    setLoadingSession(true);
    setErrorMessage(null);
    try {
      const full = await api.getChatSession(sessionId);
      setActiveSession(full);
    } catch (err: any) {
      setErrorMessage(err.message || '切換對話紀錄失敗');
    } finally {
      setLoadingSession(false);
    }
  };

  // 開啟新對話存檔 (可指定開場白索引)
  const handleCreateNewSession = async (greetingIdx: number = 0) => {
    if (!currentCard) return;
    setLoadingSession(true);
    setIsNewChatModalOpen(false);
    try {
      const created = await api.createChatSession({
        character_id: currentCard.id,
        user_name: activeSession?.user_name || currentCard.user_persona_name || '你',
        greeting_index: greetingIdx
      });
      setActiveSession(created);
      const list = await api.listChatSessions(currentCard.id);
      setSessionsList(list);
    } catch (err: any) {
      setErrorMessage(err.message || '開啟新對話失敗');
    } finally {
      setLoadingSession(false);
    }
  };

  // 刪除當前對話存檔
  const handleDeleteCurrentSession = async () => {
    if (!activeSession || !currentCard) return;
    if (!window.confirm(`確定要刪除對話紀錄「${activeSession.title}」嗎？`)) return;
    try {
      await api.deleteChatSession(activeSession.id);
      const list = await api.listChatSessions(currentCard.id);
      setSessionsList(list);
      if (list.length > 0) {
        const nextFull = await api.getChatSession(list[0].id);
        setActiveSession(nextFull);
      } else {
        await handleCreateNewSession(0);
      }
    } catch (err: any) {
      alert(err.message || '刪除對話失敗');
    }
  };

  // 發送玩家訊息並推演 AI 回覆
  const handleSendMessage = async () => {
    if (!currentCard || !activeSession || !inputText.trim() || sendingReply) return;
    const msgToSend = inputText.trim();
    const directorHint = customInstruction.trim();

    // 保存發送前的快照，若出錯可完整復原
    const prevSessionSnapshot: ChatSession = JSON.parse(JSON.stringify(activeSession));

    // 樂觀更新畫面：先顯示玩家發出的氣泡
    const optimisticUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: msgToSend,
      swipes: [msgToSend],
      swipe_id: 0,
      timestamp: new Date().toLocaleTimeString()
    };
    setActiveSession({
      ...activeSession,
      messages: [...activeSession.messages, optimisticUserMsg]
    });
    setInputText('');
    setSendingReply(true);
    setErrorMessage(null);

    try {
      const res = await api.sendCharacterChatReply({
        session_id: activeSession.id,
        character_id: currentCard.id,
        user_message: msgToSend,
        is_regenerate: false,
        custom_instruction: directorHint || undefined
      });
      setActiveSession(res.session);
      const list = await api.listChatSessions(currentCard.id);
      setSessionsList(list);
    } catch (err: any) {
      setErrorMessage(err.message || 'AI 回覆生成失敗，已為你還原發送前狀態');
      setActiveSession(prevSessionSnapshot);
      setInputText(msgToSend);
    } finally {
      setSendingReply(false);
    }
  };

  // 重新生成最後一則 AI 回覆 (Swipe Regenerate)
  const handleRegenerateLastReply = async () => {
    if (!currentCard || !activeSession || sendingReply) return;
    if (activeSession.messages.length === 0) return;

    setSendingReply(true);
    setErrorMessage(null);
    try {
      const res = await api.sendCharacterChatReply({
        session_id: activeSession.id,
        character_id: currentCard.id,
        is_regenerate: true,
        custom_instruction: customInstruction.trim() || undefined
      });
      setActiveSession(res.session);
    } catch (err: any) {
      setErrorMessage(err.message || '重新生成回覆失敗');
    } finally {
      setSendingReply(false);
    }
  };

  // 左右切換某則訊息的 Swipe 分支 (包含切換多重開場白或多重生成回覆)
  const handleCycleSwipe = async (msgIndex: number, direction: -1 | 1) => {
    if (!activeSession) return;
    const targetMsg = activeSession.messages[msgIndex];
    if (!targetMsg || !targetMsg.swipes || targetMsg.swipes.length <= 1) return;

    const total = targetMsg.swipes.length;
    const nextIdx = (targetMsg.swipe_id + direction + total) % total;
    const updatedMessages = [...activeSession.messages];
    updatedMessages[msgIndex] = {
      ...targetMsg,
      swipe_id: nextIdx,
      content: targetMsg.swipes[nextIdx]
    };

    const nextSession: ChatSession = {
      ...activeSession,
      messages: updatedMessages
    };
    setActiveSession(nextSession);
    try {
      await api.saveChatSession(nextSession);
    } catch (e) {
      console.error('Failed to save swipe change:', e);
    }
  };

  // 儲存編輯後的單則訊息
  const handleSaveEditedMessage = async (msgId: string) => {
    if (!activeSession) return;
    const updatedMessages = activeSession.messages.map((m) => {
      if (m.id !== msgId) return m;
      const nextSwipes = [...(m.swipes || [m.content])];
      nextSwipes[m.swipe_id || 0] = editingMsgContent;
      return {
        ...m,
        content: editingMsgContent,
        swipes: nextSwipes
      };
    });
    const nextSession: ChatSession = {
      ...activeSession,
      messages: updatedMessages
    };
    setActiveSession(nextSession);
    setEditingMsgId(null);
    try {
      await api.saveChatSession(nextSession);
    } catch (e) {
      console.error('Failed to save edited message:', e);
    }
  };

  // 刪除某則訊息及其後續所有分支（回溯對話）
  const handleDeleteMessageFromIndex = async (msgIndex: number) => {
    if (!activeSession) return;
    if (!window.confirm('確定要刪除此則訊息以及其後方的所有對話內容，回溯到此時間點嗎？')) return;
    const updatedMessages = activeSession.messages.slice(0, msgIndex);
    const nextSession: ChatSession = {
      ...activeSession,
      messages: updatedMessages
    };
    setActiveSession(nextSession);
    try {
      await api.saveChatSession(nextSession);
    } catch (e) {
      console.error('Failed to delete messages:', e);
    }
  };

  // 更新 Session 的長時記憶摘要或玩家人設
  const handlePersistSessionPatch = async (patch: Partial<ChatSession>) => {
    if (!activeSession) return;
    const nextSession: ChatSession = { ...activeSession, ...patch };
    setActiveSession(nextSession);
    try {
      await api.saveChatSession(nextSession);
    } catch (e) {
      console.error('Failed to save session patch:', e);
    }
  };

  // AI 一鍵提煉/更新長時記憶核心摘要
  const handleSummarizeMemoryByAI = async () => {
    if (!currentCard || !activeSession || summarizingMemory) return;
    setSummarizingMemory(true);
    try {
      const updated = await api.summarizeChatMemory({
        session_id: activeSession.id,
        character_id: currentCard.id
      });
      setActiveSession(updated);
    } catch (err: any) {
      alert(err.message || 'AI 提煉記憶摘要失敗');
    } finally {
      setSummarizingMemory(false);
    }
  };

  // 手動觸發重構此對話的 RAG 向量索引
  const handleReindexChatRag = async () => {
    if (!activeSession || reindexingRag) return;
    setReindexingRag(true);
    setRagStatusMsg(null);
    try {
      const res = await api.reindexChatRag(activeSession.id);
      setRagStatusMsg(res.message || '已更新 RAG 語意索引');
      setTimeout(() => setRagStatusMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || '重構 RAG 索引失敗');
    } finally {
      setReindexingRag(false);
    }
  };

  // 在角色大廳直接匯入 SillyTavern 角色卡 (.png / .json)
  const handleImportAtHall = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const imported = await api.importCharacterCard(file);
      onImportCardSuccess(imported);
    } catch (err: any) {
      alert(err.message || '匯入角色卡失敗');
    } finally {
      setImporting(false);
      if (importFileInputRef.current) importFileInputRef.current.value = '';
    }
  };

  // 收集所有標籤供大廳篩選
  const allTags = Array.from(
    new Set(cards.flatMap((c) => c.tags || []))
  );

  const filteredCards = cards.filter((c) => {
    const matchSearch =
      !searchQuery.trim() ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.creator_notes || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchTag = !selectedTag || (c.tags || []).includes(selectedTag);
    return matchSearch && matchTag;
  });

  // ==================== 視圖 1：角色選擇大廳 (Character Hall) ====================
  if (subView === 'hall' || !currentCard) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {/* 頂部導覽列 */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-rose-600/30">
              <MessageSquareHeart className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold bg-gradient-to-r from-rose-200 via-pink-200 to-fuchsia-200 bg-clip-text text-transparent">
                角色聊天大廳 · SillyTavern 酒館相容模式
              </h1>
              <p className="text-[10px] text-slate-400 font-mono">
                選擇角色卡即可展開具備「三層長時記憶 + 世界書 + RAG 歷史回撈」的沉浸式對話
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              ref={importFileInputRef}
              type="file"
              accept=".png,.json"
              onChange={handleImportAtHall}
              className="hidden"
            />
            <button
              onClick={() => importFileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-xs font-bold text-rose-200 transition"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4 text-rose-400" />}
              <span>匯入角色卡 (.png / .json)</span>
            </button>

            <button
              onClick={onBackToStudio}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-rose-400" />
              <span>前往角色後台工坊</span>
            </button>

            <button
              onClick={onOpenSettings}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              title="AI 模型與 API 設定"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* 搜尋與標籤篩選列 */}
        <div className="max-w-6xl w-full mx-auto px-6 pt-8 pb-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[260px] max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋角色名稱、簡介或設定..."
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            {allTags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setSelectedTag('')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                    !selectedTag
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  全部 ({cards.length})
                </button>
                {allTags.map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTag(selectedTag === t ? '' : t)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                      selectedTag === t
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 角色卡網格 */}
        <main className="max-w-6xl w-full mx-auto px-6 pb-16 flex-1">
          {filteredCards.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-slate-800/80 space-y-4">
              <UserCircle2 className="w-14 h-14 mx-auto text-slate-700" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-300">尚未找到符合條件的角色卡</p>
                <p className="text-xs text-slate-500">
                  你可以前往「角色後台工坊」建立新角色，或直接點擊上方「匯入角色卡 (.png / .json)」載入 SillyTavern 角色卡
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCards.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleEnterCharacterChat(item.id)}
                  className="group rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-rose-500/60 overflow-hidden shadow-xl hover:shadow-rose-500/10 transition-all duration-300 cursor-pointer flex flex-col transform hover:-translate-y-1"
                >
                  {/* 角色立繪封面 */}
                  <div className="relative aspect-[4/4.5] w-full bg-slate-950 overflow-hidden">
                    {item.avatar_url ? (
                      <img
                        src={item.avatar_url}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-rose-950/60 via-slate-900 to-fuchsia-950/60 flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-20 h-20 rounded-full bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-3xl font-black text-rose-200 mb-3">
                          {item.name[0]}
                        </div>
                        <span className="text-xs text-slate-400 font-serif italic line-clamp-2 px-4">
                          {item.personality || '點擊展開對話'}
                        </span>
                      </div>
                    )}

                    {/* 底部漸層遮罩與名稱 */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-4 pt-12">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-lg font-extrabold text-white truncate">
                          {item.name}
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/60 text-rose-300 border border-rose-500/30 shrink-0">
                          v{item.character_version || '1.0'}
                        </span>
                      </div>
                      {item.personality && (
                        <p className="text-xs text-rose-200/90 truncate mt-0.5">
                          {item.personality}
                        </p>
                      )}
                    </div>

                    {/* 右上角統計徽章 */}
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                      {item.lore_items_count > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950/85 text-cyan-300 border border-cyan-500/40 backdrop-blur-sm">
                          📌 世界書 {item.lore_items_count}
                        </span>
                      )}
                      {item.chat_sessions_count > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/85 text-rose-200 border border-rose-500/40 backdrop-blur-sm">
                          💬 {item.total_messages_count} 則對話
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 卡片內容區 */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      {(item.tags || []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.tags.slice(0, 4).map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded-md text-[10px] bg-slate-800 text-slate-300"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                        {item.creator_notes || item.description || item.scenario || '點擊進入與角色展開深度對話...'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-500 font-mono">
                        開場白分支: {1 + (item.alternate_greetings_count || 0)} 組
                      </span>
                      <span className="font-bold text-rose-400 group-hover:text-rose-300 flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" />
                        立即開始聊天 →
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // ==================== 視圖 2：沉浸式角色聊天室 (Roleplay Chat Room) ====================
  const userName = activeSession?.user_name || currentCard.user_persona_name || '你';
  const allGreetingsCount = 1 + (currentCard.alternate_greetings?.length || 0);

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden relative">
      {/* 頂部固定導覽列 */}
      <header className="h-15 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 py-2.5 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSubView('hall')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition border border-slate-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>角色大廳</span>
          </button>

          {/* 當前聊天角色標題與狀態 */}
          <div className="flex items-center gap-2.5 pl-1">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-white">{currentCard.name}</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 font-mono">
                  長時記憶 + RAG 已啟用
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate max-w-[220px] sm:max-w-xs">
                {currentCard.personality || currentCard.scenario || '沉浸式角色扮演對話'}
              </p>
            </div>
          </div>
        </div>

        {/* 右側：對話存檔切換、開新局、編輯角色、右側記憶欄開關 */}
        <div className="flex items-center gap-2">
          {/* 對話存檔選擇器 */}
          <div className="hidden md:flex items-center gap-1.5 bg-slate-950/90 border border-slate-800 rounded-xl px-2.5 py-1">
            <FolderOpen className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <select
              value={activeSession?.id || ''}
              onChange={(e) => handleSelectSession(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none max-w-[170px] truncate"
            >
              {sessionsList.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-slate-200">
                  {s.title} ({s.messages_count}則)
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              if (allGreetingsCount > 1) {
                setSelectedGreetingIdx(0);
                setIsNewChatModalOpen(true);
              } else {
                handleCreateNewSession(0);
              }
            }}
            title="開啟一段全新的對話分支"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-xs font-bold text-rose-200 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">新對話</span>
          </button>

          {sessionsList.length > 1 && (
            <button
              onClick={handleDeleteCurrentSession}
              title="刪除此對話紀錄"
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onBackToStudio}
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 transition"
          >
            <Edit3 className="w-3.5 h-3.5 text-rose-400" />
            <span>編輯角色卡</span>
          </button>

          <button
            onClick={() => setShowRightSidebar(!showRightSidebar)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
              showRightSidebar
                ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-200'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">記憶與人設欄</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="AI 模型設定"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 主體三欄佈局：左側常駐角色立繪欄 + 中間對話流 + 右側固定長時記憶/RAG/人設面板 */}
      <div className="flex-1 flex min-h-0 relative z-10">
        {/* ★ 左側常駐：高清角色立繪展示欄 (Prominent Left Character Portrait Panel) */}
        <aside className="w-64 sm:w-72 md:w-80 xl:w-96 border-r border-slate-800/90 bg-slate-900/95 flex flex-col shrink-0 z-20 select-none">
          {/* 上方主立繪展示區 (100% 飽滿清晰、自適應完整顯示全圖) */}
          <div className="flex-1 relative overflow-hidden bg-slate-950 flex items-center justify-center p-3">
            {currentCard.avatar_url ? (
              <>
                {/* 柔和同色系模糊氛圍襯底，避免黑邊生硬 */}
                <img
                  src={currentCard.avatar_url}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-35 scale-110 pointer-events-none"
                />
                {/* 清晰完整的主角色立繪 */}
                <img
                  src={currentCard.avatar_url}
                  alt={currentCard.name}
                  className="relative z-10 w-full h-full object-contain rounded-xl drop-shadow-[0_12px_28px_rgba(0,0,0,0.85)] transition-transform duration-500 hover:scale-[1.02]"
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-rose-600/30 to-fuchsia-600/30 border border-rose-500/40 flex items-center justify-center text-4xl font-black text-rose-200 shadow-xl">
                  {currentCard.name[0]}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-300">{currentCard.name}</p>
                  <p className="text-xs text-slate-500">尚未設定角色立繪圖片</p>
                </div>
                <button
                  type="button"
                  onClick={onBackToStudio}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-xs font-bold text-rose-300 transition"
                >
                  前往後台上傳角色圖
                </button>
              </div>
            )}
          </div>

          {/* 下方角色名牌與特徵資訊區 */}
          <div className="p-4 border-t border-slate-800/90 bg-slate-900/95 space-y-2.5 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-extrabold text-white truncate">
                {currentCard.name}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-500/30 shrink-0">
                v{currentCard.character_version || '1.0'}
              </span>
            </div>

            {currentCard.personality && (
              <p className="text-xs text-rose-200/90 font-medium line-clamp-2 leading-relaxed">
                {currentCard.personality}
              </p>
            )}

            {(currentCard.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {currentCard.tags.slice(0, 5).map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-md text-[10px] bg-slate-800 text-slate-300 border border-slate-700/60"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {currentCard.creator_notes && (
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed pt-1 border-t border-slate-800/80">
                {currentCard.creator_notes}
              </p>
            )}
          </div>
        </aside>

        {/* 中間主對話區 */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 訊息捲動容器 */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* 場景提示橫幅 */}
              {currentCard.scenario && (
                <div className="p-3.5 rounded-2xl bg-slate-900/75 border border-slate-800/90 backdrop-blur-md text-xs text-slate-300 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-rose-300 mr-1.5">【當前場景 Scenario】：</span>
                    <span>
                      {currentCard.scenario
                        .replace(/\{\{char\}\}/gi, currentCard.name)
                        .replace(/\{\{user\}\}/gi, userName)}
                    </span>
                  </div>
                </div>
              )}

              {loadingSession ? (
                <div className="py-20 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-rose-400 animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">正在載入對話與長時記憶索引...</p>
                </div>
              ) : (
                (activeSession?.messages || []).map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  const isLastAssistant =
                    !isUser && idx === (activeSession?.messages.length || 0) - 1;
                  const swipesCount = msg.swipes?.length || 1;
                  const currentSwipeIdx = msg.swipe_id || 0;

                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex gap-3.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {/* 頭像 */}
                      <div className="shrink-0 mt-1">
                        {isUser ? (
                          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-600 flex items-center justify-center font-bold text-xs text-white shadow-md">
                            {userName[0] || '你'}
                          </div>
                        ) : currentCard.avatar_url ? (
                          <img
                            src={currentCard.avatar_url}
                            alt={currentCard.name}
                            className="w-10 h-10 rounded-2xl object-cover border border-rose-500/40 shadow-md"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center font-bold text-sm text-white shadow-md">
                            {currentCard.name[0]}
                          </div>
                        )}
                      </div>

                      {/* 氣泡主體 */}
                      <div
                        className={`group max-w-2xl flex-1 space-y-2 ${
                          isUser ? 'items-end' : 'items-start'
                        }`}
                      >
                        {/* 發言者名稱與長時記憶/RAG 喚醒徽章 */}
                        <div
                          className={`flex flex-wrap items-center gap-2 ${
                            isUser ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <span className="text-xs font-bold text-slate-300">
                            {isUser ? userName : currentCard.name}
                          </span>
                          {idx === 0 && !isUser && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-500/30">
                              開場白 #{currentSwipeIdx + 1}
                            </span>
                          )}

                          {/* 喚醒之世界書徽章 */}
                          {msg.triggered_lore &&
                            msg.triggered_lore.map((lore, lIdx) => (
                              <span
                                key={lore.id || lIdx}
                                title={
                                  lore.trigger_reason
                                    ? `${lore.trigger_reason}：${lore.content || ''}`
                                    : lore.content
                                }
                                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 inline-flex items-center gap-1"
                              >
                                <Brain className="w-3 h-3 text-cyan-400" />
                                📌 喚醒世界書：【{lore.title}】
                              </span>
                            ))}

                          {/* RAG 歷史對話深海回撈徽章 */}
                          {msg.recalled_rag && msg.recalled_rag.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedRagMsgId(
                                  expandedRagMsgId === msg.id ? null : msg.id
                                )
                              }
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-950/80 hover:bg-purple-900/80 text-purple-200 border border-purple-500/40 inline-flex items-center gap-1 transition"
                            >
                              <Waves className="w-3 h-3 text-purple-400" />
                              🌊 RAG 回撈歷史記憶 ({msg.recalled_rag.length} 處)
                            </button>
                          )}
                        </div>

                        {/* 若展開 RAG 歷史回撈詳情 */}
                        {expandedRagMsgId === msg.id &&
                          msg.recalled_rag &&
                          msg.recalled_rag.length > 0 && (
                            <div className="p-3 rounded-xl bg-purple-950/50 border border-purple-500/40 text-xs space-y-2 backdrop-blur-md">
                              <div className="flex items-center justify-between text-purple-200 font-bold text-[11px]">
                                <span>🌊 本回合自早期對話回撈的記憶片段：</span>
                                <button
                                  onClick={() => setExpandedRagMsgId(null)}
                                  className="text-slate-400 hover:text-white"
                                >
                                  ✕
                                </button>
                              </div>
                              {msg.recalled_rag.map((r) => (
                                <div
                                  key={r.id}
                                  className="p-2 rounded-lg bg-slate-950/80 border border-purple-500/20 space-y-1"
                                >
                                  <div className="flex items-center justify-between text-[10px] font-mono text-purple-300">
                                    <span>早期第 {r.turn_index} 輪對話</span>
                                    <span>{r.reason}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-300 whitespace-pre-wrap">
                                    {r.text}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                        {/* 訊息內容框 (支援編輯模式或格式化渲染) */}
                        <div
                          className={`p-4 rounded-2xl shadow-lg backdrop-blur-md ${
                            isUser
                              ? 'bg-gradient-to-r from-indigo-950/85 to-slate-900/90 border border-indigo-500/40 rounded-tr-sm'
                              : 'bg-slate-900/88 border border-slate-800/95 rounded-tl-sm'
                          }`}
                        >
                          {editingMsgId === msg.id ? (
                            <div className="space-y-2">
                              <textarea
                                rows={5}
                                value={editingMsgContent}
                                onChange={(e) => setEditingMsgContent(e.target.value)}
                                className="w-full p-2.5 bg-slate-950 border border-rose-500/50 rounded-xl text-xs sm:text-sm text-slate-100 leading-relaxed focus:outline-none"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingMsgId(null)}
                                  className="px-3 py-1 rounded-lg bg-slate-800 text-xs text-slate-300 flex items-center gap-1"
                                >
                                  <X className="w-3.5 h-3.5" /> 取消
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditedMessage(msg.id)}
                                  className="px-3 py-1 rounded-lg bg-rose-600 text-xs font-bold text-white flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" /> 儲存修改
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm sm:text-[15px] space-y-2.5">
                              {renderFormattedRoleplayText(
                                msg.content,
                                currentCard.name,
                                userName
                              )}
                            </div>
                          )}
                        </div>

                        {/* 底部工具列：Swipe 分支切換器 (< 1/N >) + 重新生成 + 編輯 + 刪除 + 複製 */}
                        <div
                          className={`flex items-center gap-2 text-[11px] text-slate-500 ${
                            isUser ? 'justify-end' : 'justify-between'
                          }`}
                        >
                          {/* 左側：多重開場白或多重回覆 Swipe 切換器 */}
                          {!isUser && swipesCount > 1 ? (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 font-mono">
                              <button
                                type="button"
                                onClick={() => handleCycleSwipe(idx, -1)}
                                className="hover:text-rose-400 p-0.5"
                                title="上一個分支版本"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-[10px] px-1">
                                {currentSwipeIdx + 1} / {swipesCount}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCycleSwipe(idx, 1)}
                                className="hover:text-rose-400 p-0.5"
                                title="下一個分支版本"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div />
                          )}

                          {/* 右側操作按鈕 */}
                          <div className="flex items-center gap-2 opacity-70 group-hover:opacity-100 transition">
                            {isLastAssistant && idx > 0 && (
                              <button
                                type="button"
                                onClick={handleRegenerateLastReply}
                                disabled={sendingReply}
                                className="hover:text-rose-400 flex items-center gap-1"
                                title="重新生成新回覆分支 (Swipe)"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>重生成</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setEditingMsgId(msg.id);
                                setEditingMsgContent(msg.content);
                              }}
                              className="hover:text-cyan-400 flex items-center gap-1"
                              title="編輯此則訊息"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>編輯</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(msg.content);
                                setCopiedMsgId(msg.id);
                                setTimeout(() => setCopiedMsgId(null), 1500);
                              }}
                              className="hover:text-emerald-400 flex items-center gap-1"
                              title="複製文字"
                            >
                              {copiedMsgId === msg.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {idx > 0 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessageFromIndex(idx)}
                                className="hover:text-rose-400 flex items-center gap-1"
                                title="刪除此則及後續訊息"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* AI 正在輸入動畫 */}
              {sendingReply && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-600/30 border border-rose-500/40 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-rose-400 animate-spin" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 space-y-1">
                    <p className="font-bold text-rose-300">
                      {currentCard.name} 正在思考並組織回應...
                    </p>
                    <p className="text-[10px] text-slate-500">
                      同步檢索長時記憶時間線、角色世界書與 RAG 歷史對話庫
                    </p>
                  </div>
                </div>
              )}

              {/* 錯誤提示橫幅 */}
              {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-xs text-rose-200 flex items-center justify-between gap-3">
                  <span>⚠️ {errorMessage}</span>
                  <button
                    onClick={() => setErrorMessage(null)}
                    className="px-2.5 py-1 rounded-lg bg-rose-900 hover:bg-rose-800 text-white font-bold shrink-0"
                  >
                    關閉
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 底部玩家對話輸入艙 */}
          <div className="border-t border-slate-800/80 bg-slate-900/90 backdrop-blur-md p-3 sm:p-4 shrink-0">
            <div className="max-w-3xl mx-auto space-y-2">
              {/* 單次導演特別指示 (選填展開) */}
              {showDirectorInput && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-500/30">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <input
                    type="text"
                    value={customInstruction}
                    onChange={(e) => setCustomInstruction(e.target.value)}
                    placeholder="單次導演指令（例如：讓她突然想起某個秘密、表現得稍微吃醋一點...）"
                    className="flex-1 bg-transparent text-xs text-purple-100 placeholder-purple-300/40 focus:outline-none"
                  />
                  {customInstruction && (
                    <button
                      type="button"
                      onClick={() => setCustomInstruction('')}
                      className="text-xs text-purple-300 hover:text-white"
                    >
                      清除
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="flex-1 bg-slate-950 border border-slate-800 focus-within:border-rose-500/60 rounded-2xl p-2.5 transition">
                  <textarea
                    rows={2}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`以「${userName}」的身份與 ${currentCard.name} 對話... (可用 *星號* 描寫動作，Enter 發送，Shift+Enter 換行)`}
                    className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
                  />
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-900 text-[11px] text-slate-500">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInputText((prev) => `${prev}**`)}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-300/90 font-serif italic"
                      >
                        + *動作描寫*
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDirectorInput(!showDirectorInput)}
                        className={`px-2 py-0.5 rounded transition ${
                          showDirectorInput || customInstruction
                            ? 'bg-purple-900/60 text-purple-200'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-400'
                        }`}
                      >
                        🎬 導演指示
                      </button>
                    </div>
                    <span className="font-mono text-[10px]">
                      Enter 發送 · Shift+Enter 換行
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || sendingReply}
                  className="h-12 px-5 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/25 transition shrink-0"
                >
                  {sendingReply ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>發送</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 右側固定顯示：長時記憶・RAG・玩家人設側邊欄 */}
        {showRightSidebar && (
          <aside className="w-80 sm:w-96 border-l border-slate-800/90 bg-slate-900/95 backdrop-blur-md flex flex-col shrink-0 z-20">
            {/* 側邊欄子頁籤切換 */}
            <div className="p-2.5 border-b border-slate-800 grid grid-cols-3 gap-1 bg-slate-950/60">
              <button
                onClick={() => setSidebarTab('memory')}
                className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition ${
                  sidebarTab === 'memory'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>長時記憶/RAG</span>
              </button>
              <button
                onClick={() => setSidebarTab('persona')}
                className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition ${
                  sidebarTab === 'persona'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserCircle2 className="w-3.5 h-3.5" />
                <span>玩家人設</span>
              </button>
              <button
                onClick={() => setSidebarTab('lore')}
                className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition ${
                  sidebarTab === 'lore'
                    ? 'bg-rose-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>世界書 ({currentCard.lore_items?.length || 0})</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
              {/* 分頁 1：長時記憶與 RAG 控制中心 */}
              {sidebarTab === 'memory' && activeSession && (
                <>
                  {/* 三層記憶架構運作狀態 */}
                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                        <Waves className="w-4 h-4 text-cyan-400" />
                        三位一體記憶與 RAG 引擎
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300">
                        運作中
                      </span>
                    </div>
                    <ul className="text-[11px] text-slate-400 space-y-1 font-mono">
                      <li>• 短期完整視窗：最近 8 則對話原文</li>
                      <li>
                        • 早期大事記時間線：
                        {(activeSession.messages?.length || 0) > 8
                          ? `已自動壓縮前 ${(activeSession.messages?.length || 0) - 8} 則歷史`
                          : '滿 8 則對話後自動啟動壓縮'}
                      </li>
                      <li>
                        • RAG 深海語意回撈：共{' '}
                        {Math.ceil((activeSession.messages?.length || 0) / 2)} 輪對話納入檢索
                      </li>
                    </ul>
                    <div className="pt-1 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleReindexChatRag}
                        disabled={reindexingRag}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-cyan-300 font-semibold flex items-center gap-1 transition"
                      >
                        {reindexingRag ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        <span>重構對話 RAG 向量索引</span>
                      </button>
                      {ragStatusMsg && (
                        <span className="text-[10px] text-emerald-400">{ragStatusMsg}</span>
                      )}
                    </div>
                  </div>

                  {/* 長時記憶核心摘要 (Memory Summary) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-200">
                        📌 長時記憶核心摘要 (Memory Summary)
                      </label>
                      <button
                        type="button"
                        onClick={handleSummarizeMemoryByAI}
                        disabled={summarizingMemory || (activeSession.messages?.length || 0) < 2}
                        className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:opacity-40 text-[11px] font-bold text-white flex items-center gap-1 shadow"
                      >
                        {summarizingMemory ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        <span>AI 提煉記憶摘要</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      記載雙方關係變化、重要約定與已發生事件，每回合永久作為最高優先級長時記憶注入。
                    </p>
                    <textarea
                      rows={9}
                      value={activeSession.memory_summary || ''}
                      onChange={(e) =>
                        setActiveSession({
                          ...activeSession,
                          memory_summary: e.target.value
                        })
                      }
                      onBlur={(e) =>
                        handlePersistSessionPatch({ memory_summary: e.target.value })
                      }
                      placeholder="點擊上方「AI 提煉記憶摘要」自動濃縮目前對話進展，或手動寫入你希望角色永遠記住的設定與往事..."
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </>
              )}

              {/* 分頁 2：玩家人設 ({{user}} Persona) */}
              {sidebarTab === 'persona' && activeSession && (
                <div className="space-y-4">
                  <div>
                    <label className="block font-bold text-slate-200 mb-1">
                      對話存檔標題
                    </label>
                    <input
                      type="text"
                      value={activeSession.title}
                      onChange={(e) =>
                        setActiveSession({ ...activeSession, title: e.target.value })
                      }
                      onBlur={(e) => handlePersistSessionPatch({ title: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-emerald-300 mb-1">
                      你的稱呼 (<code className="text-emerald-300">{'{{user}}'}</code>)
                    </label>
                    <input
                      type="text"
                      value={activeSession.user_name}
                      onChange={(e) =>
                        setActiveSession({ ...activeSession, user_name: e.target.value })
                      }
                      onBlur={(e) =>
                        handlePersistSessionPatch({ user_name: e.target.value })
                      }
                      placeholder="例如：你、卡爾、學長..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-200 mb-1">
                      你的人設與身份背景 (User Persona)
                    </label>
                    <p className="text-[11px] text-slate-400 mb-2">
                      告訴 {currentCard.name} 你是誰、你的外貌或你們之間的關係前提。
                    </p>
                    <textarea
                      rows={6}
                      value={activeSession.user_persona || ''}
                      onChange={(e) =>
                        setActiveSession({
                          ...activeSession,
                          user_persona: e.target.value
                        })
                      }
                      onBlur={(e) =>
                        handlePersistSessionPatch({ user_persona: e.target.value })
                      }
                      placeholder="例如：與汐音相識多年的委託人，能夠看見常人看不見的星界微光..."
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* 分頁 3：角色世界書與設定速覽 */}
              {sidebarTab === 'lore' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <span className="font-bold text-rose-300">角色設定簡介</span>
                    <p className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed max-h-44 overflow-y-auto">
                      {currentCard.description
                        .replace(/\{\{char\}\}/gi, currentCard.name)
                        .replace(/\{\{user\}\}/gi, userName) || '尚無角色描述'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <span className="font-bold text-cyan-300 block">
                      角色專屬世界書 ({currentCard.lore_items?.length || 0})
                    </span>
                    {(!currentCard.lore_items || currentCard.lore_items.length === 0) ? (
                      <p className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-500">
                        此角色尚未配置專屬世界書詞條。
                      </p>
                    ) : (
                      currentCard.lore_items.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-cyan-200 text-[11px]">
                              📌 {item.title}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                              {item.is_constant ? '常駐生效' : item.category}
                            </span>
                          </div>
                          {item.keywords && item.keywords.length > 0 && (
                            <p className="text-[10px] font-mono text-slate-400">
                              關鍵字: {item.keywords.join(', ')}
                            </p>
                          )}
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {item.content
                              .replace(/\{\{char\}\}/gi, currentCard.name)
                              .replace(/\{\{user\}\}/gi, userName)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* 開啟新對話並選擇開場白分支 Modal */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">
                選擇「{currentCard.name}」的開場白情境
              </h3>
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {[currentCard.first_mes, ...(currentCard.alternate_greetings || [])].map(
                (greet, gIdx) => (
                  <div
                    key={gIdx}
                    onClick={() => setSelectedGreetingIdx(gIdx)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition space-y-1 ${
                      selectedGreetingIdx === gIdx
                        ? 'bg-rose-950/40 border-rose-500 text-slate-100'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-rose-300">
                      {gIdx === 0 ? '★ 主開場白 (#1)' : `備選開場白 (#${gIdx + 1})`}
                    </div>
                    <p className="text-xs line-clamp-3 leading-relaxed">
                      {(greet || '')
                        .replace(/\{\{char\}\}/gi, currentCard.name)
                        .replace(/\{\{user\}\}/gi, userName)}
                    </p>
                  </div>
                )
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:bg-slate-800 rounded-xl"
              >
                取消
              </button>
              <button
                onClick={() => handleCreateNewSession(selectedGreetingIdx)}
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 rounded-xl shadow-lg"
              >
                以此開場白展開新對話
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
