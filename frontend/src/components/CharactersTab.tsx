import React, { useState, useRef } from 'react';
import type { Novel, Character } from '../types';
import { 
  Users, Plus, Trash2, Sparkles, Loader2, Upload, Link as LinkIcon, User
} from 'lucide-react';
import { api } from '../api/client';

interface Props {
  novel: Novel;
  onChange: (updated: Novel) => void;
}

export const CharactersTab: React.FC<Props> = ({ novel, onChange }) => {
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiCount, setAiCount] = useState(3);
  const [aiHint, setAiHint] = useState('');
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadingCharId, setUploadingCharId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeCharIdRef = useRef<string | null>(null);

  // 新增角色
  const handleAddCharacter = () => {
    const newId = `char-${Date.now().toString(36)}`;
    const newChar: Character = {
      id: newId,
      name: '新登場角色',
      role: '主角',
      gender: '未知',
      age: '20',
      appearance: '黑髮黑眸，眼神銳利...',
      profile: '個性堅忍，背負家族隱秘，渴望查明真相...',
      avatar_url: ''
    };
    onChange({
      ...novel,
      characters: [...novel.characters, newChar]
    });
  };

  // 刪除角色
  const handleDeleteCharacter = (charId: string) => {
    onChange({
      ...novel,
      characters: novel.characters.filter(c => c.id !== charId)
    });
  };

  // 更新角色欄位
  const handleUpdateCharacter = (charId: string, fields: Partial<Character>) => {
    onChange({
      ...novel,
      characters: novel.characters.map(c => c.id === charId ? { ...c, ...fields } : c)
    });
  };

  // 觸發上傳立繪
  const triggerUpload = (charId: string) => {
    activeCharIdRef.current = charId;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const charId = activeCharIdRef.current;
    if (!file || !charId) return;

    setUploadingCharId(charId);
    try {
      const url = await api.uploadAvatar(file);
      handleUpdateCharacter(charId, { avatar_url: url });
    } catch (err: any) {
      alert(err.message || '圖片上傳失敗');
    } finally {
      setUploadingCharId(null);
      e.target.value = '';
    }
  };

  // AI 發想角色
  const handleAiGenerate = async () => {
    setGenerating(true);
    setErrorMsg('');
    try {
      const generated = await api.generateCharacters({
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
        characters: [...novel.characters, ...generated]
      });

      setIsAiModalOpen(false);
      setAiHint('');
    } catch (e: any) {
      setErrorMsg(e.message || 'AI 角色發想失敗');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in duration-200">
      {/* 隱藏的檔案上傳 input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* 標題橫幅 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-900/30 via-slate-900/60 to-slate-900 border border-blue-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              第 3 層
            </span>
            <h1 className="text-xl font-bold text-slate-100">角色系統與立繪卡</h1>
          </div>
          <p className="text-xs text-slate-400">
            塑造有血有肉的人物陣容：姓名、定位、外貌特徵、內在動機與立繪圖片。
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 text-xs font-medium transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>AI 發想角色</span>
          </button>
          <button
            onClick={handleAddCharacter}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-lg shadow-blue-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>建立新角色</span>
          </button>
        </div>
      </div>

      {/* 角色卡列表 */}
      {novel.characters.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 space-y-3">
          <Users className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-medium text-slate-300">尚未建立任何角色</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            建立主角、反派與夥伴，為他們貼上立繪圖片或填寫性格背景。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {novel.characters.map((char) => (
            <div
              key={char.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4 shadow-lg hover:border-slate-700 transition"
            >
              {/* 卡片頂部：立繪與基本欄位 */}
              <div className="flex gap-4">
                {/* 角色圖片欄位 */}
                <div className="relative group shrink-0 w-24 h-32 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
                  {char.avatar_url ? (
                    <img
                      src={char.avatar_url}
                      alt={char.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="text-center p-2">
                      <User className="w-8 h-8 text-slate-600 mx-auto mb-1" />
                      <span className="text-[10px] text-slate-500">無立繪</span>
                    </div>
                  )}

                  {/* 圖片操作懸浮選單 */}
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition p-1">
                    <button
                      type="button"
                      onClick={() => triggerUpload(char.id)}
                      disabled={uploadingCharId === char.id}
                      className="w-full py-1 text-[10px] bg-blue-600 text-white rounded font-medium flex items-center justify-center gap-1 hover:bg-blue-500"
                    >
                      {uploadingCharId === char.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Upload className="w-3 h-3" />
                      )}
                      <span>上傳圖檔</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const url = prompt('請輸入圖片網址 (URL):', char.avatar_url || '');
                        if (url !== null) handleUpdateCharacter(char.id, { avatar_url: url });
                      }}
                      className="w-full py-1 text-[10px] bg-slate-800 text-slate-200 rounded font-medium flex items-center justify-center gap-1 hover:bg-slate-700"
                    >
                      <LinkIcon className="w-3 h-3" />
                      <span>圖片網址</span>
                    </button>
                    {char.avatar_url && (
                      <button
                        type="button"
                        onClick={() => handleUpdateCharacter(char.id, { avatar_url: '' })}
                        className="w-full py-0.5 text-[9px] text-rose-400 hover:text-rose-300"
                      >
                        移除圖片
                      </button>
                    )}
                  </div>
                </div>

                {/* 角色關鍵資訊 */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={char.name}
                      onChange={(e) => handleUpdateCharacter(char.id, { name: e.target.value })}
                      placeholder="角色姓名"
                      className="text-base font-bold text-slate-100 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 focus:outline-none px-1 py-0.5 transition w-full"
                    />
                    <button
                      onClick={() => handleDeleteCharacter(char.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                      title="刪除角色"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase block">定位</label>
                      <input
                        type="text"
                        value={char.role}
                        onChange={(e) => handleUpdateCharacter(char.id, { role: e.target.value })}
                        placeholder="主角/反派..."
                        className="w-full text-xs px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-blue-300 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase block">性別</label>
                      <input
                        type="text"
                        value={char.gender || ''}
                        onChange={(e) => handleUpdateCharacter(char.id, { gender: e.target.value })}
                        placeholder="男/女..."
                        className="w-full text-xs px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase block">年齡</label>
                      <input
                        type="text"
                        value={char.age || ''}
                        onChange={(e) => handleUpdateCharacter(char.id, { age: e.target.value })}
                        placeholder="24"
                        className="w-full text-xs px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">外貌特徵與穿著</label>
                    <textarea
                      rows={2}
                      value={char.appearance || ''}
                      onChange={(e) => handleUpdateCharacter(char.id, { appearance: e.target.value })}
                      placeholder="具體的髮色、身形、招牌衣飾或武器道具..."
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* 角色身世背景、性格特點與核心動機 */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">
                  性格特質、背景經歷與核心動機 (Why he/she fights)
                </label>
                <textarea
                  rows={3}
                  value={char.profile}
                  onChange={(e) => handleUpdateCharacter(char.id, { profile: e.target.value })}
                  placeholder="說明其核心性格、內心陰影、執念、弱點與人際關係..."
                  className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 resize-y"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI 發想角色彈窗 */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-slate-100">AI 構思角色陣容</h3>
              </div>
              <button onClick={() => setIsAiModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              AI 將根據《{novel.title}》的主線架構、世界觀及已有地點，創造出一組性格迥異、衝突張力十足的人物。
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  生成人數
                </label>
                <div className="flex gap-2">
                  {[2, 3, 4].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAiCount(c)}
                      className={`px-3 py-1.5 text-xs rounded-xl border transition ${
                        aiCount === c ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {c} 位角色
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  期望偏好或特定角色方向 (選填)
                </label>
                <input
                  type="text"
                  value={aiHint}
                  onChange={(e) => setAiHint(e.target.value)}
                  placeholder="例如：一位深不可測的反派幕僚、神秘的機械師同伴..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition"
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
                className="flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-600/20 transition disabled:opacity-50"
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
