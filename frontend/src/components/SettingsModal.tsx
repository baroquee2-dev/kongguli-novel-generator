import React, { useState, useEffect, useRef } from 'react';
import type { AISettings, ProviderConfig } from '../types';
import { api } from '../api/client';
import { 
  X, Key, Cpu, Zap, CheckCircle2, AlertCircle, Loader2, RefreshCw, Edit3, ListFilter, Search
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onSave: (newSettings: AISettings) => void;
}

const defaultProviders: Record<string, ProviderConfig> = {
  openai: { api_key: '', base_url: 'https://api.openai.com/v1', model: 'gpt-4o' },
  openrouter: { api_key: '', base_url: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-3.5-sonnet' },
  gemini: { api_key: '', base_url: '', model: 'gemini-2.5-flash' },
  claude: { api_key: '', base_url: '', model: 'claude-3-5-sonnet-20241022' },
  custom: { api_key: '', base_url: 'http://localhost:11434/v1', model: 'llama3' },
};

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, settings, onSave }) => {
  const [currentProvider, setCurrentProvider] = useState<AISettings['provider']>('openai');
  const [providers, setProviders] = useState<Record<string, ProviderConfig>>(defaultProviders);
  const [temperature, setTemperature] = useState<number>(0.75);
  const [maxTokens, setMaxTokens] = useState<number>(4000);

  const [testing, setTesting] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isCustomInput, setIsCustomInput] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const prevOpenRef = useRef(false);
  const LOCAL_STORAGE_KEY_PREFIX = 'novel_weaver_models_cache_';

  // 初始化預設推薦模型列表
  const getDefaultModels = (provider: AISettings['provider']) => {
    if (provider === 'openai') return ['gpt-4o', 'gpt-4o-mini', 'o1-mini', 'o1-preview', 'gpt-4-turbo'];
    if (provider === 'openrouter') return [
      'anthropic/claude-3.5-sonnet',
      'deepseek/deepseek-chat',
      'deepseek/deepseek-r1',
      'google/gemini-2.5-flash',
      'google/gemini-2.5-pro',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'meta-llama/llama-3.3-70b-instruct'
    ];
    if (provider === 'gemini') return ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'];
    if (provider === 'claude') return ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'];
    return ['deepseek-chat', 'llama3', 'qwen2.5:14b', 'mistral'];
  };

  // 從 localStorage 讀取快取
  const getLocalModelsCache = (prov: string): string[] | null => {
    try {
      const data = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${prov}`);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return null;
  };

  // 寫入 localStorage 快取
  const setLocalModelsCache = (prov: string, models: string[]) => {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${prov}`, JSON.stringify(models));
    } catch (e) {}
  };

  // 取得某 provider 應顯示的模型列表 (三層防護：Provider物件 -> LocalStorage -> 預設列表，絕不重置)
  const getProviderModels = (prov: AISettings['provider'], cfg?: ProviderConfig): string[] => {
    if (cfg?.cached_models && cfg.cached_models.length > 0) {
      return cfg.cached_models;
    }
    const local = getLocalModelsCache(prov);
    if (local && local.length > 0) {
      return local;
    }
    const defaultList = getDefaultModels(prov);
    if (cfg?.model && !defaultList.includes(cfg.model)) {
      return [cfg.model, ...defaultList];
    }
    return defaultList;
  };

  useEffect(() => {
    // 關鍵防護：只有在彈窗從關閉變成開啟時才進行初始同步，防止彈窗開啟期間因外部渲染被重置
    if (isOpen && !prevOpenRef.current) {
      const initialProviders: Record<string, ProviderConfig> = {
        ...defaultProviders,
        ...(settings.providers || {})
      };

      // 檢查 localStorage 補全未攜帶快取的平台
      (['openai', 'openrouter', 'gemini', 'claude', 'custom'] as const).forEach(p => {
        if (!initialProviders[p]?.cached_models || initialProviders[p].cached_models.length === 0) {
          const local = getLocalModelsCache(p);
          if (local) {
            initialProviders[p] = {
              ...initialProviders[p],
              cached_models: local
            };
          }
        }
      });

      // 向下相容同步
      const prov = settings.provider || 'openai';
      if (settings.api_key && (!initialProviders[prov] || !initialProviders[prov].api_key)) {
        initialProviders[prov] = {
          ...initialProviders[prov],
          api_key: settings.api_key,
          base_url: settings.base_url || initialProviders[prov]?.base_url || '',
          model: settings.model || initialProviders[prov]?.model || defaultProviders[prov].model,
        };
      }

      setProviders(initialProviders);
      setCurrentProvider(prov);
      setTemperature(settings.temperature ?? 0.75);
      setMaxTokens(settings.max_tokens ?? 4000);

      // 載入當前平台完整模型清單
      const initialModels = getProviderModels(prov, initialProviders[prov]);
      setAvailableModels(initialModels);
      setTestResult(null);
      setIsCustomInput(false);

      // 自動預載：若當前平台有 Key 且尚未抓取過完整清單，在背景靜默拉取一次
      const activeCfg = initialProviders[prov];
      const hasKey = !!activeCfg?.api_key || prov === 'custom';
      const isDefaultListOnly = initialModels.length <= 5;
      if (hasKey && isDefaultListOnly) {
        api.getModels({
          provider: prov,
          api_key: activeCfg?.api_key || '',
          base_url: activeCfg?.base_url || '',
          model: activeCfg?.model || '',
          temperature: 0.75,
          max_tokens: 4000
        }).then(fetched => {
          if (fetched && fetched.length > 0) {
            setAvailableModels(fetched);
            setLocalModelsCache(prov, fetched);
            setProviders(prev => ({
              ...prev,
              [prov]: {
                ...(prev[prov] || defaultProviders[prov]),
                cached_models: fetched
              }
            }));
          }
        }).catch(() => {});
      }
    }
    prevOpenRef.current = isOpen;
  }, [settings, isOpen]);

  if (!isOpen) return null;

  // 獲取當前所選供應商的專屬設定
  const currentConfig: ProviderConfig = providers[currentProvider] || defaultProviders[currentProvider];

  // 更新當前供應商的專屬欄位
  const updateCurrentConfig = (fields: Partial<ProviderConfig>) => {
    setProviders(prev => ({
      ...prev,
      [currentProvider]: {
        ...(prev[currentProvider] || defaultProviders[currentProvider]),
        ...fields
      }
    }));
  };

  const handleProviderChange = (newProvider: AISettings['provider']) => {
    setCurrentProvider(newProvider);
    const targetConfig = providers[newProvider] || defaultProviders[newProvider];
    // 切換時載入該 provider 的專屬快取清單，防止被重置為預設少數模型
    const targetModels = getProviderModels(newProvider, targetConfig);
    setAvailableModels(targetModels);
    setTestResult(null);
    setModelSearchQuery('');

    // 若新切換的平台有 Key 且模型數很少，自動嘗試抓取完整清單
    if ((targetConfig.api_key || newProvider === 'custom') && targetModels.length <= 5) {
      api.getModels({
        provider: newProvider,
        api_key: targetConfig.api_key || '',
        base_url: targetConfig.base_url || '',
        model: targetConfig.model || '',
        temperature,
        max_tokens: maxTokens
      }).then(fetched => {
        if (fetched && fetched.length > 0) {
          setAvailableModels(fetched);
          setLocalModelsCache(newProvider, fetched);
          setProviders(prev => ({
            ...prev,
            [newProvider]: {
              ...(prev[newProvider] || defaultProviders[newProvider]),
              cached_models: fetched
            }
          }));
        }
      }).catch(() => {});
    }
  };

  // 組合當前用於連線與儲存的完整 AISettings 物件
  const buildCurrentPayload = (): AISettings => {
    return {
      provider: currentProvider,
      api_key: currentConfig.api_key || '',
      base_url: currentConfig.base_url || '',
      model: currentConfig.model || defaultProviders[currentProvider].model,
      temperature,
      max_tokens: maxTokens,
      providers
    };
  };

  // 測試連線並自動更新模型清單與永久快取
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const payload = buildCurrentPayload();
    try {
      const res = await api.testConnection(payload);
      setTestResult(res);
      // 若回傳了模型列表，自動更新下拉選單並永久快取 (LocalStorage + 後端落盤)
      if (res.success && res.models && res.models.length > 0) {
        setAvailableModels(res.models);
        setLocalModelsCache(currentProvider, res.models);
        const nextModel = res.models.includes(currentConfig.model) ? currentConfig.model : res.models[0];
        
        const updatedProviders = {
          ...providers,
          [currentProvider]: {
            ...currentConfig,
            model: nextModel,
            cached_models: res.models
          }
        };
        setProviders(updatedProviders);

        // 背景即刻自動存檔同步，防止任何意外遺失
        const updatedPayload = { ...payload, model: nextModel, providers: updatedProviders };
        api.saveSettings(updatedPayload).catch(() => {});
        onSave(updatedPayload);
      }
    } catch (e: any) {
      setTestResult({ success: false, error: e.message || '連線測試失敗' });
    } finally {
      setTesting(false);
    }
  };

  // 單獨手動刷新模型選單並寫入永久快取
  const handleFetchModels = async () => {
    setFetchingModels(true);
    const payload = buildCurrentPayload();
    try {
      const models = await api.getModels(payload);
      if (models && models.length > 0) {
        setAvailableModels(models);
        setLocalModelsCache(currentProvider, models);
        const nextModel = models.includes(currentConfig.model) ? currentConfig.model : models[0];
        
        const updatedProviders = {
          ...providers,
          [currentProvider]: {
            ...currentConfig,
            model: nextModel,
            cached_models: models
          }
        };
        setProviders(updatedProviders);

        // 背景即刻自動存檔同步
        const updatedPayload = { ...payload, model: nextModel, providers: updatedProviders };
        api.saveSettings(updatedPayload).catch(() => {});
        onSave(updatedPayload);

        setTestResult({
          success: true,
          message: `已成功取得 ${models.length} 個可用模型並已永久儲存！`
        });
      }
    } catch (e: any) {
      setTestResult({ success: false, error: e.message || '獲取模型清單失敗，請確認 API Key 與網路' });
    } finally {
      setFetchingModels(false);
    }
  };

  const handleSave = () => {
    const payload = buildCurrentPayload();
    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">AI 模型連線設定</h2>
              <p className="text-[11px] text-slate-400">自填 API Key，連線後自動抓取可用模型選單</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Provider 選擇 */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              AI 供應商 / 平台 (各平台專屬獨立儲存 Key 與模型)
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                { id: 'openai', label: 'OpenAI' },
                { id: 'openrouter', label: 'OpenRouter' },
                { id: 'gemini', label: 'Google Gemini' },
                { id: 'claude', label: 'Claude' },
                { id: 'custom', label: '自訂 / Ollama' },
              ].map((item) => {
                const isSelected = currentProvider === item.id;
                const hasKey = !!providers[item.id]?.api_key?.trim();
                const isCustomConfigured = item.id === 'custom' && !!providers[item.id]?.base_url?.trim();
                const isConfigured = hasKey || isCustomConfigured;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleProviderChange(item.id as AISettings['provider'])}
                    className={`relative px-2.5 py-2 text-xs font-medium rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? 'bg-purple-600/20 border-purple-500 text-purple-200 shadow-sm font-bold ring-1 ring-purple-500/30'
                        : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                    }`}
                  >
                    <span className="truncate w-full">{item.label}</span>
                    {isConfigured ? (
                      <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-normal">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        已設金鑰
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-500 font-normal">未設定</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>
                {currentProvider === 'openai' && 'OpenAI 專屬 API Key'}
                {currentProvider === 'openrouter' && 'OpenRouter 專屬 API Key'}
                {currentProvider === 'gemini' && 'Google Gemini 專屬 API Key'}
                {currentProvider === 'claude' && 'Anthropic Claude 專屬 API Key'}
                {currentProvider === 'custom' && '自訂平台 API Key'}
              </span>
              {currentProvider === 'openrouter' ? (
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-purple-400 hover:text-purple-300 underline font-mono flex items-center gap-1"
                >
                  獲取 OpenRouter 金鑰 ↗
                </a>
              ) : currentProvider === 'custom' ? (
                <span className="text-slate-500 text-[11px]">(本地 Ollama 可留空)</span>
              ) : (
                <span className="text-[11px] text-purple-400/80 font-mono">獨立保存</span>
              )}
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                value={currentConfig.api_key || ''}
                onChange={(e) => updateCurrentConfig({ api_key: e.target.value })}
                placeholder={
                  currentProvider === 'openrouter'
                    ? '在此貼上 OpenRouter 金鑰 (sk-or-v1-...)'
                    : currentProvider === 'custom'
                      ? '選填 (若有設 key 則填入)'
                      : `在此貼上 ${currentProvider.toUpperCase()} 專屬 API Key`
                }
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 transition font-mono"
              />
            </div>
          </div>

          {/* Base URL (自訂或代理) */}
          {(currentProvider === 'custom' || currentProvider === 'openai' || currentProvider === 'openrouter') && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Base URL {currentProvider === 'openrouter' && '(預設: https://openrouter.ai/api/v1)'} {currentProvider === 'openai' && '(選填，自建 OpenAI 反向代理時填)'}
              </label>
              <input
                type="text"
                value={currentConfig.base_url || ''}
                onChange={(e) => updateCurrentConfig({ base_url: e.target.value })}
                placeholder={
                  currentProvider === 'openrouter'
                    ? "https://openrouter.ai/api/v1"
                    : currentProvider === 'custom'
                      ? "例如: http://localhost:11434/v1"
                      : "https://api.openai.com/v1"
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 transition font-mono"
              />
            </div>
          )}

          {/* 模型選擇：下拉選單 + 自動獲取清單 */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ListFilter className="w-3.5 h-3.5 text-purple-400" />
                <span>{currentProvider.toUpperCase()} 模型選擇 (Model)</span>
                {availableModels.length > 0 && (
                  <span className="text-[10px] text-emerald-400 font-mono font-normal">
                    ({availableModels.length} 個可用{currentConfig.cached_models && currentConfig.cached_models.length > 0 ? ' · 已快取' : ''})
                  </span>
                )}
              </label>

              <div className="flex items-center gap-2">
                {/* 重新整理/載入模型清單按鈕 */}
                <button
                  type="button"
                  onClick={handleFetchModels}
                  disabled={fetchingModels || (!currentConfig.api_key && currentProvider !== 'custom')}
                  title="重新連線獲取模型清單"
                  className="flex items-center gap-1 text-[11px] text-purple-300 hover:text-purple-200 px-2 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 transition disabled:opacity-40"
                >
                  <RefreshCw className={`w-3 h-3 ${fetchingModels ? 'animate-spin' : ''}`} />
                  <span>{fetchingModels ? '載入中...' : '讀取模型清單'}</span>
                </button>

                {/* 切換手動輸入 */}
                <button
                  type="button"
                  onClick={() => setIsCustomInput(!isCustomInput)}
                  title={isCustomInput ? '切換為下拉選單' : '切換為自訂手動輸入'}
                  className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 下拉選單 或 自訂手動輸入框 */}
            {isCustomInput ? (
              <input
                type="text"
                value={currentConfig.model || ''}
                onChange={(e) => updateCurrentConfig({ model: e.target.value })}
                placeholder="請手動輸入精確的模型名稱"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-sm font-mono text-purple-200 focus:outline-none focus:border-purple-500 transition"
              />
            ) : (
              <>
                {/* 模型關鍵字搜尋框與快速篩選標籤 — 僅在模型數量較多時顯示 */}
                {availableModels.length > 20 && (
                  <div className="space-y-1.5 mb-1.5">
                    {/* 當前選定模型預覽 */}
                    <div className="flex items-center justify-between bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-slate-400 shrink-0 text-[11px]">目前選用：</span>
                        <span className="font-mono text-purple-300 font-bold truncate text-[11px]" title={currentConfig.model}>
                          {currentConfig.model || '未設定'}
                        </span>
                      </div>
                      {currentConfig.model && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0 ml-2">
                          已選定
                        </span>
                      )}
                    </div>

                    {/* 搜尋輸入框 */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={modelSearchQuery}
                        onChange={(e) => setModelSearchQuery(e.target.value)}
                        placeholder="搜尋模型名稱 (例如：claude, gemini, llama, deepseek, free...)"
                        className="w-full pl-8 pr-8 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-purple-500 transition"
                      />
                      {modelSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setModelSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                          title="清除搜尋"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* 快速篩選標籤 */}
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      <span className="text-[10px] text-slate-500 shrink-0">快篩：</span>
                      {['free', 'claude', 'deepseek', 'gemini', 'gpt-4', 'llama', 'qwen'].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setModelSearchQuery(modelSearchQuery.toLowerCase() === tag ? '' : tag)}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition ${
                            modelSearchQuery.toLowerCase() === tag
                              ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <select
                  value={currentConfig.model || ''}
                  onChange={(e) => updateCurrentConfig({ model: e.target.value })}
                  size={availableModels.length > 20 ? 8 : 1}
                  className={`w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-sm font-mono text-purple-200 focus:outline-none focus:border-purple-500 transition cursor-pointer ${
                    availableModels.length > 20 ? 'overflow-y-auto' : ''
                  }`}
                >
                  {(() => {
                    const q = modelSearchQuery.toLowerCase().trim();
                    const filtered = q
                      ? availableModels.filter(m => m.toLowerCase().includes(q))
                      : availableModels;
                    
                    const options = [];
                    // 若當前所選模型不在過濾後的結果中，在頂部保留顯示以利視覺定位與狀態維持
                    if (currentConfig.model && !filtered.includes(currentConfig.model)) {
                      options.push(
                        <option key="__current__" value={currentConfig.model}>
                          ⭐ {currentConfig.model} (當前選定)
                        </option>
                      );
                    }

                    if (filtered.length > 0) {
                      filtered.forEach((m) => {
                        options.push(
                          <option key={m} value={m}>
                            {m === currentConfig.model ? `✓ ${m}` : m}
                          </option>
                        );
                      });
                    } else {
                      options.push(
                        <option key="__empty__" disabled value="">
                          找不到符合「{modelSearchQuery}」的模型
                        </option>
                      );
                    }
                    return options;
                  })()}
                </select>

                {modelSearchQuery && (
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    篩選結果：{availableModels.filter(m => m.toLowerCase().includes(modelSearchQuery.toLowerCase().trim())).length} / {availableModels.length} 個模型
                  </p>
                )}
              </>
            )}

            {/* 快速推薦標籤 */}
            <div className="flex gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-slate-500 self-center">熱門：</span>
              {getDefaultModels(currentProvider).slice(0, 4).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => updateCurrentConfig({ model: m })}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-md border transition ${
                    currentConfig.model === m
                      ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Temperature & Max tokens */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex justify-between">
                <span>創意溫度</span>
                <span className="text-purple-400 font-mono">{temperature}</span>
              </label>
              <input
                type="range"
                min="0.2"
                max="1.2"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                單次最大輸出 Tokens
              </label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 2000)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-purple-500 transition font-mono"
              />
            </div>
          </div>

          {/* 測試連線結果提示 */}
          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <div className="flex-1 break-all">
                {testResult.success ? testResult.message : testResult.error}
              </div>
            </div>
          )}
        </div>

        {/* 底部按鈕 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700/80 transition disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
            <span>{testing ? '連線測試並抓取模型中...' : '測試連線 & 獲取模型'}</span>
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg shadow-purple-600/20 transition"
            >
              儲存設定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
