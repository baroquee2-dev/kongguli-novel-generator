import type { AISettings, Novel, NovelListItem, Location, Character, LoreItem } from '../types';

const API_BASE = 'http://localhost:8000/api';

export const api = {
  // 設定
  async getSettings(): Promise<AISettings> {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('獲取設定失敗');
    return res.json();
  },
  async saveSettings(settings: AISettings): Promise<AISettings> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('保存設定失敗');
    return res.json();
  },
  async testConnection(settings: AISettings): Promise<{ success: boolean; message?: string; error?: string; models?: string[] }> {
    const res = await fetch(`${API_BASE}/settings/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return res.json();
  },
  async getModels(settings: AISettings): Promise<string[]> {
    const res = await fetch(`${API_BASE}/settings/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('獲取模型清單失敗');
    const data = await res.json();
    return data.models || [];
  },

  // 小說 CRUD
  async listNovels(): Promise<NovelListItem[]> {
    const res = await fetch(`${API_BASE}/novels`);
    if (!res.ok) throw new Error('獲取小說列表失敗');
    return res.json();
  },
  async getNovel(id: string): Promise<Novel> {
    const res = await fetch(`${API_BASE}/novels/${id}`);
    if (!res.ok) throw new Error('載入小說失敗');
    return res.json();
  },
  async saveNovel(novel: Novel): Promise<Novel> {
    const res = await fetch(`${API_BASE}/novels/${novel.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novel),
    });
    if (!res.ok) throw new Error('保存小說失敗');
    return res.json();
  },
  async createNovel(novel: Partial<Novel>): Promise<Novel> {
    const res = await fetch(`${API_BASE}/novels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novel),
    });
    if (!res.ok) throw new Error('建立小說失敗');
    return res.json();
  },
  async deleteNovel(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/novels/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('刪除小說失敗');
  },
  async initSample(): Promise<Novel> {
    const res = await fetch(`${API_BASE}/novels/init-sample`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('建立範例失敗');
    return res.json();
  },
  getExportUrl(id: string): string {
    return `${API_BASE}/novels/${id}/export`;
  },

  // 圖片上傳
  async uploadAvatar(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('http://localhost:8000/api/upload-avatar', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('上傳圖片失敗');
    const data = await res.json();
    return `http://localhost:8000${data.url}`;
  },

  // AI 輔助
  async generateOutline(data: { rough_idea: string; genre?: string; tone?: string; title?: string; global_style_guide?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/ai/generate-outline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'AI 發想大綱失敗');
    }
    return res.json();
  },
  async generateLocations(data: {
    novel_title: string;
    genre: string;
    main_plot: string;
    world_background: string;
    global_style_guide?: string;
    count?: number;
    hint?: string;
  }): Promise<Location[]> {
    const res = await fetch(`${API_BASE}/ai/generate-locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'AI 發想地點失敗');
    }
    return res.json();
  },
  async generateCharacters(data: {
    novel_title: string;
    genre: string;
    main_plot: string;
    world_background: string;
    global_style_guide?: string;
    count?: number;
    hint?: string;
  }): Promise<Character[]> {
    const res = await fetch(`${API_BASE}/ai/generate-characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'AI 發想角色失敗');
    }
    return res.json();
  },
  async generateChapter(data: {
    novel_id: string;
    chapter_id: string;
    target_words?: number;
    custom_instruction?: string;
  }): Promise<{ content: string }> {
    const res = await fetch(`${API_BASE}/ai/generate-chapter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'AI 生成章節正文失敗');
    }
    return res.json();
  },
  async continueWriting(data: {
    novel_id: string;
    chapter_id: string;
    current_content: string;
    instruction?: string;
    target_words?: number;
  }): Promise<{ added_content: string }> {
    const res = await fetch(`${API_BASE}/ai/continue-writing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'AI 續寫失敗');
    }
    return res.json();
  },
  async streamChapter(
    data: {
      novel_id: string;
      chapter_id: string;
      target_words?: number;
      custom_instruction?: string;
    },
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/ai/generate-chapter-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: '連線失敗' }));
      throw new Error(err.detail || '串流生成失敗');
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('瀏覽器不支援 ReadableStream');

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let receivedChars = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6).trim();
        if (payload === '[DONE]') {
          if (receivedChars === 0) {
            throw new Error('AI 生成結束，但未收到任何文字內容（AI 回傳空白）');
          }
          return;
        }

        let parsed: any;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }

        if (parsed.error) {
          throw new Error(parsed.error);
        }
        if (parsed.text) {
          receivedChars += parsed.text.length;
          onChunk(parsed.text);
        }
      }
    }

    if (receivedChars === 0) {
      throw new Error('AI 連線已結束，但未接收到任何文字（AI 回傳空白或未響應）');
    }
  },
  async streamContinueWriting(
    data: {
      novel_id: string;
      chapter_id: string;
      current_content: string;
      instruction?: string;
      target_words?: number;
    },
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/ai/continue-writing-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: '連線失敗' }));
      throw new Error(err.detail || '串流續寫失敗');
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('瀏覽器不支援 ReadableStream');

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let receivedChars = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6).trim();
        if (payload === '[DONE]') {
          if (receivedChars === 0) {
            throw new Error('AI 續寫結束，但未收到任何文字內容（AI 回傳空白）');
          }
          return;
        }

        let parsed: any;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }

        if (parsed.error) {
          throw new Error(parsed.error);
        }
        if (parsed.text) {
          receivedChars += parsed.text.length;
          onChunk(parsed.text);
        }
      }
    }

    if (receivedChars === 0) {
      throw new Error('AI 連線已結束，但未接收到任何文字（AI 回傳空白或未響應）');
    }
  },

  // 長時記憶：AI 提煉章節小結
  async generateChapterSummary(data: { novel_id: string; chapter_id: string }): Promise<{ summary: string; novel: Novel }> {
    const res = await fetch(`${API_BASE}/ai/generate-chapter-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: '提煉章節小結失敗' }));
      throw new Error(err.detail || '提煉章節小結失敗');
    }
    return res.json();
  },

  // 長時記憶第二階段：AI 分析提煉世界書伏筆卡片
  async analyzeLoreItems(data: { novel_id: string; count?: number; hint?: string }): Promise<{ items: LoreItem[] }> {
    const res = await fetch(`${API_BASE}/ai/analyze-lore-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: '提煉世界書伏筆卡片失敗' }));
      throw new Error(err.detail || '提煉世界書伏筆卡片失敗');
    }
    return res.json();
  },

  // 預覽章節觸發之伏筆卡片
  async previewChapterLore(novelId: string, chapterId: string): Promise<{
    triggered_items: Array<{ id: string; title: string; category: string; trigger_reason: string; keywords: string[]; content: string }>;
    all_items: LoreItem[];
    lore_prompt_text: string;
  }> {
    const res = await fetch(`${API_BASE}/novels/${novelId}/chapters/${chapterId}/preview-lore`);
    if (!res.ok) {
      throw new Error('獲取章節伏筆預覽失敗');
    }
    return res.json();
  },
};

