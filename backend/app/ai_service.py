import re
import json
import httpx
from typing import Optional, List, Dict, Any
from app.models import AISettings
from app.config import get_settings

def clean_json_string(text: str) -> str:
    """清理 AI 回傳的 Markdown 程式碼區塊標記，提取純 JSON"""
    text = text.strip()
    # 移除 ```json 或 ```
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        return match.group(1).strip()
    return text

def extract_json_data(text: str) -> Any:
    """超強容錯的 JSON 提取器，支援 Markdown 程式碼區塊、純文字截取與逗號修復"""
    text = text.strip()
    cleaned = clean_json_string(text)
    
    # 第一次直接嘗試解析
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # 嘗試抓取第一處 [ 到最後一處 ] (針對列表)
    left_bracket = cleaned.find('[')
    right_bracket = cleaned.rfind(']')
    if left_bracket != -1 and right_bracket > left_bracket:
        candidate = cleaned[left_bracket:right_bracket+1]
        try:
            return json.loads(candidate)
        except Exception:
            fixed = re.sub(r',\s*([\]}])', r'\1', candidate)
            try:
                return json.loads(fixed)
            except Exception:
                pass

    # 嘗試抓取第一處 { 到最後一處 } (針對物件)
    left_brace = cleaned.find('{')
    right_brace = cleaned.rfind('}')
    if left_brace != -1 and right_brace > left_brace:
        candidate = cleaned[left_brace:right_brace+1]
        try:
            return json.loads(candidate)
        except Exception:
            fixed = re.sub(r',\s*([\]}])', r'\1', candidate)
            try:
                return json.loads(fixed)
            except Exception:
                pass

    # 若依然失敗，丟出乾淨易懂的錯誤訊息
    preview = text[:150] + ("..." if len(text) > 150 else "")
    raise Exception(f"AI 回應格式未能成功轉換為 JSON。原始文字開頭：{preview}")

class AIService:
    @staticmethod
    async def call_llm(
        system_prompt: str,
        user_prompt: str,
        settings: Optional[AISettings] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> str:
        """統一的 LLM 呼叫入口，支援 OpenAI, Gemini, Claude, Ollama/Custom"""
        cfg = settings or get_settings()
        temp = temperature if temperature is not None else cfg.temperature
        tokens = max_tokens if max_tokens is not None else cfg.max_tokens

        provider = (cfg.provider or "openai").lower()

        if provider == "gemini":
            return await AIService._call_gemini(cfg, system_prompt, user_prompt, temp, tokens)
        elif provider == "claude":
            return await AIService._call_claude(cfg, system_prompt, user_prompt, temp, tokens)
        else:
            # openai or custom / ollama
            return await AIService._call_openai_compatible(cfg, system_prompt, user_prompt, temp, tokens)

    @staticmethod
    async def call_llm_stream(
        system_prompt: str,
        user_prompt: str,
        settings: Optional[AISettings] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ):
        """統一的 LLM 串流產生器，支援 OpenAI, Gemini, Claude, Ollama/Custom"""
        cfg = settings or get_settings()
        temp = temperature if temperature is not None else cfg.temperature
        tokens = max_tokens if max_tokens is not None else cfg.max_tokens

        provider = (cfg.provider or "openai").lower()

        if provider == "gemini":
            async for chunk in AIService._stream_gemini(cfg, system_prompt, user_prompt, temp, tokens):
                yield chunk
        elif provider == "claude":
            async for chunk in AIService._stream_claude(cfg, system_prompt, user_prompt, temp, tokens):
                yield chunk
        else:
            async for chunk in AIService._stream_openai_compatible(cfg, system_prompt, user_prompt, temp, tokens):
                yield chunk

    @staticmethod
    async def _stream_openai_compatible(
        cfg: AISettings,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        max_tokens: int
    ):
        provider = (cfg.provider or "openai").lower()
        base_url = (cfg.base_url or "").strip().rstrip("/")
        if not base_url:
            base_url = "https://openrouter.ai/api/v1" if provider == "openrouter" else "https://api.openai.com/v1"
        endpoint = f"{base_url}/chat/completions"
        headers = {"Content-Type": "application/json"}
        if cfg.api_key:
            headers["Authorization"] = f"Bearer {cfg.api_key}"
        if provider == "openrouter" or "openrouter.ai" in base_url:
            headers["HTTP-Referer"] = "http://localhost:5173"
            headers["X-Title"] = "KongGuLi-孔固力自動小說生成器"

        model = cfg.model.strip()
        if not model:
            model = "anthropic/claude-3.5-sonnet" if provider == "openrouter" else "gpt-4o"
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }

        yielded_chars_count = 0
        content_filter_triggered = False

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", endpoint, headers=headers, json=payload) as resp:
                if resp.status_code != 200:
                    err = await resp.aread()
                    err_msg = err.decode('utf-8', errors='ignore')
                    raise Exception(f"AI API 請求失敗 (HTTP {resp.status_code}): {err_msg}")
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            choices = chunk.get("choices", [])
                            if choices:
                                choice = choices[0]
                                finish_reason = choice.get("finish_reason")
                                if finish_reason == "content_filter":
                                    content_filter_triggered = True

                                delta = choice.get("delta", {})
                                content = delta.get("content")
                                if content:
                                    yielded_chars_count += len(content)
                                    yield content
                        except Exception:
                            pass

        if content_filter_triggered:
            raise Exception("【AI 拒絕回答】內容觸發了模型的安全審查過濾機制 (content_filter)，請調整章節設定或敏感描寫後重試。")

        if yielded_chars_count == 0:
            raise Exception(f"【AI 回傳空白】AI 模型 ({model}) 請求成功但未輸出任何文字內容 (產出字數為 0)。請檢查模型名稱是否正確，或嘗試換用其他模型。")

    @staticmethod
    async def _stream_gemini(
        cfg: AISettings,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        max_tokens: int
    ):
        if not cfg.api_key:
            raise Exception("請先在設定中填寫 Google Gemini 的 API Key")
        model = cfg.model.strip() or "gemini-2.5-flash"
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={cfg.api_key}"
        payload: Dict[str, Any] = {
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens
            }
        }
        if system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

        yielded_chars_count = 0
        refusal_reason = None

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", endpoint, json=payload) as resp:
                if resp.status_code != 200:
                    err = await resp.aread()
                    err_msg = err.decode('utf-8', errors='ignore')
                    raise Exception(f"Gemini API 請求失敗 (HTTP {resp.status_code}): {err_msg}")
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        try:
                            chunk = json.loads(data_str)
                        except Exception:
                            continue

                        # 檢查提示詞層級阻擋 (promptFeedback)
                        prompt_feedback = chunk.get("promptFeedback", {})
                        block_reason = prompt_feedback.get("blockReason")
                        if block_reason:
                            safety_ratings = prompt_feedback.get("safetyRatings", [])
                            raise Exception(f"【AI 拒絕回答】提示詞觸發 Gemini 安全過濾審查機制 (blockReason: {block_reason})。詳細評級: {safety_ratings}")

                        candidates = chunk.get("candidates", [])
                        if candidates:
                            cand = candidates[0]
                            finish_reason = cand.get("finishReason")
                            if finish_reason and finish_reason not in ("STOP", "MAX_TOKENS", None):
                                refusal_reason = finish_reason

                            parts = cand.get("content", {}).get("parts", [])
                            for p in parts:
                                text = p.get("text")
                                if text:
                                    yielded_chars_count += len(text)
                                    yield text

        if refusal_reason:
            if yielded_chars_count == 0:
                raise Exception(f"【AI 拒絕回答】Gemini 模型 ({model}) 觸發了安全策略審查，拒絕產出正文 (finishReason: {refusal_reason})。建議：調整小說情節、衝突或敏感描寫，或於設定中切換其他模型重試。")
            else:
                raise Exception(f"【AI 生成中途被阻斷】Gemini 觸發了安全策略 (finishReason: {refusal_reason})，已為您保留前面生成的 {yielded_chars_count} 字。")

        if yielded_chars_count == 0:
            raise Exception(f"【AI 回傳空白】Gemini 模型 ({model}) 呼叫成功但未輸出任何文字內容 (產出字數為 0)。可能原因：該模型版本在當前提示詞結構下未產出正文，建議切換為 gemini-2.5-flash 或 gemini-2.5-pro 重新嘗試。")

    @staticmethod
    async def _stream_claude(
        cfg: AISettings,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        max_tokens: int
    ):
        if not cfg.api_key:
            raise Exception("請先在設定中填寫 Anthropic Claude 的 API Key")
        model = cfg.model.strip() or "claude-3-5-sonnet-20241022"
        endpoint = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": cfg.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
            "stream": True
        }

        yielded_chars_count = 0
        refusal_detected = False

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", endpoint, headers=headers, json=payload) as resp:
                if resp.status_code != 200:
                    err = await resp.aread()
                    err_msg = err.decode('utf-8', errors='ignore')
                    raise Exception(f"Claude API 請求失敗 (HTTP {resp.status_code}): {err_msg}")
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        try:
                            chunk = json.loads(data_str)
                            event_type = chunk.get("type")
                            if event_type == "content_block_delta":
                                delta_text = chunk.get("delta", {}).get("text")
                                if delta_text:
                                    yielded_chars_count += len(delta_text)
                                    yield delta_text
                            elif event_type == "message_delta":
                                delta = chunk.get("delta", {})
                                if delta.get("stop_reason") == "refusal":
                                    refusal_detected = True
                            elif event_type == "error":
                                raise Exception(f"Claude 串流錯誤: {chunk.get('error')}")
                        except Exception as parse_err:
                            if "Claude 串流錯誤" in str(parse_err):
                                raise parse_err

        if refusal_detected:
            raise Exception("【AI 拒絕回答】Claude 偵測到敏感內容拒絕生成 (stop_reason: refusal)。")

        if yielded_chars_count == 0:
            raise Exception(f"【AI 回傳空白】Claude 模型 ({model}) 未輸出任何文字內容 (產出字數為 0)。")


    @staticmethod
    async def _call_openai_compatible(
        cfg: AISettings,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        max_tokens: int
    ) -> str:
        provider = (cfg.provider or "openai").lower()
        base_url = (cfg.base_url or "").strip().rstrip("/")
        if not base_url:
            base_url = "https://openrouter.ai/api/v1" if provider == "openrouter" else "https://api.openai.com/v1"
        
        endpoint = f"{base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json"
        }
        if cfg.api_key:
            headers["Authorization"] = f"Bearer {cfg.api_key}"
        if provider == "openrouter" or "openrouter.ai" in base_url:
            headers["HTTP-Referer"] = "http://localhost:5173"
            headers["X-Title"] = "KongGuLi-孔固力自動小說生成器"

        model = cfg.model.strip()
        if not model:
            model = "anthropic/claude-3.5-sonnet" if provider == "openrouter" else "gpt-4o"

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(endpoint, headers=headers, json=payload)
            if resp.status_code != 200:
                raise Exception(f"AI API 請求失敗 (HTTP {resp.status_code}): {resp.text}")
            data = resp.json()
            choices = data.get("choices", [])
            if not choices:
                raise Exception(f"【AI 回傳異常】未收到任何生成選項: {data}")
            
            choice = choices[0]
            if choice.get("finish_reason") == "content_filter":
                raise Exception("【AI 拒絕回答】觸發內容安全過濾機制 (content_filter)。請調整設定或描述後重試。")

            content = choice.get("message", {}).get("content", "")
            if not content or not content.strip():
                raise Exception(f"【AI 回傳空白】AI 模型 ({model}) 回傳了空白內容。")
            return content

    @staticmethod
    async def _call_gemini(
        cfg: AISettings,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        max_tokens: int
    ) -> str:
        if not cfg.api_key:
            raise Exception("請先在設定中填寫 Google Gemini 的 API Key")
        
        model = cfg.model.strip() or "gemini-2.5-flash"
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={cfg.api_key}"
        
        payload: Dict[str, Any] = {
            "contents": [
                {
                    "parts": [{"text": user_prompt}]
                }
            ],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens
            }
        }
        if system_prompt:
            payload["systemInstruction"] = {
                "parts": [{"text": system_prompt}]
            }

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(endpoint, json=payload)
            if resp.status_code != 200:
                raise Exception(f"Gemini API 請求失敗 (HTTP {resp.status_code}): {resp.text}")
            data = resp.json()

            # 檢查提示詞層級阻擋 (promptFeedback)
            prompt_feedback = data.get("promptFeedback", {})
            block_reason = prompt_feedback.get("blockReason")
            if block_reason:
                safety_ratings = prompt_feedback.get("safetyRatings", [])
                raise Exception(f"【AI 拒絕回答】提示詞觸發 Gemini 安全審查機制 (blockReason: {block_reason})。評級: {safety_ratings}")

            candidates = data.get("candidates", [])
            if not candidates:
                raise Exception(f"【AI 回傳異常】Gemini 未回傳任何候選內容。原始回應: {data}")

            cand = candidates[0]
            finish_reason = cand.get("finishReason")
            if finish_reason and finish_reason not in ("STOP", "MAX_TOKENS", None):
                raise Exception(f"【AI 拒絕回答】Gemini 因安全或過濾機制停止生成 (finishReason: {finish_reason})")

            try:
                parts = cand["content"]["parts"]
                text = "".join(p.get("text", "") for p in parts)
                if not text or not text.strip():
                    raise Exception(f"【AI 回傳空白】Gemini 模型 ({model}) 回傳了空白文字。")
                return text
            except (KeyError, IndexError):
                raise Exception(f"【AI 回傳格式異常】無法自 Gemini 回應中提取正文文字: {cand}")

    @staticmethod
    async def _call_claude(
        cfg: AISettings,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        max_tokens: int
    ) -> str:
        if not cfg.api_key:
            raise Exception("請先在設定中填寫 Anthropic Claude 的 API Key")

        model = cfg.model.strip() or "claude-3-5-sonnet-20241022"
        endpoint = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": cfg.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": user_prompt}
            ]
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(endpoint, headers=headers, json=payload)
            if resp.status_code != 200:
                raise Exception(f"Claude API 請求失敗 (HTTP {resp.status_code}): {resp.text}")
            data = resp.json()
            if data.get("stop_reason") == "refusal":
                raise Exception("【AI 拒絕回答】Claude 偵測到敏感內容拒絕生成 (stop_reason: refusal)。")
            try:
                parts = data.get("content", [])
                text = "".join(p.get("text", "") for p in parts if p.get("type") == "text")
                if not text or not text.strip():
                    raise Exception(f"【AI 回傳空白】Claude 模型 ({model}) 回傳了空白文字。")
                return text
            except (KeyError, IndexError):
                raise Exception(f"無法解析 Claude 回應: {data}")

    @staticmethod
    async def fetch_models(settings: Optional[AISettings] = None) -> List[str]:
        """自動根據 API Key 與平台獲取遠端或本地支援的模型清單"""
        cfg = settings or get_settings()
        provider = (cfg.provider or "openai").lower()

        if provider == "gemini":
            return await AIService._fetch_gemini_models(cfg)
        elif provider == "claude":
            return await AIService._fetch_claude_models(cfg)
        elif provider == "openrouter":
            return await AIService._fetch_openrouter_models(cfg)
        else:
            return await AIService._fetch_openai_models(cfg)

    @staticmethod
    async def _fetch_openai_models(cfg: AISettings) -> List[str]:
        base_url = (cfg.base_url or "").strip().rstrip("/")
        if not base_url:
            base_url = "https://api.openai.com/v1"
        endpoint = f"{base_url}/models"
        headers = {}
        if cfg.api_key:
            headers["Authorization"] = f"Bearer {cfg.api_key}"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(endpoint, headers=headers)
                if resp.status_code != 200:
                    return ["gpt-4o", "gpt-4o-mini", "o1-mini", "gpt-4-turbo", "gpt-3.5-turbo"]
                data = resp.json()
                raw_models = [item["id"] for item in data.get("data", [])]
                
                # 若為官方 OpenAI，過濾非對話/非寫作模型 (如語音、繪圖、向量嵌入)
                if "openai.com" in base_url:
                    ignored_keywords = ["whisper", "tts", "embedding", "dall-e", "moderation", "davinci", "babbage"]
                    filtered = [
                        m for m in raw_models
                        if not any(k in m.lower() for k in ignored_keywords)
                    ]
                    # 依熱門程度偏好排序
                    priority = ["gpt-4o", "gpt-4o-mini", "o1-mini", "o1-preview", "gpt-4-turbo"]
                    sorted_models = sorted(
                        filtered,
                        key=lambda x: (0, priority.index(x)) if x in priority else (1, x)
                    )
                    return sorted_models if sorted_models else raw_models
                
                return sorted_models if 'sorted_models' in locals() and sorted_models else raw_models
        except Exception:
            return ["gpt-4o", "gpt-4o-mini", "o1-mini"]

    @staticmethod
    async def _fetch_gemini_models(cfg: AISettings) -> List[str]:
        if not cfg.api_key:
            return ["gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash"]
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models?key={cfg.api_key}"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(endpoint)
                if resp.status_code != 200:
                    return ["gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash"]
                data = resp.json()
                models = []
                for item in data.get("models", []):
                    # 只取支援內容生成的模型
                    methods = item.get("supportedGenerationMethods", [])
                    if "generateContent" in methods:
                        name = item.get("name", "").replace("models/", "")
                        # 排除非文本模型如 embedding/aqa 等
                        if not any(k in name for k in ["embedding", "aqa", "imagen", "text-embedding"]):
                            models.append(name)
                
                # 排序讓 flash/pro 新版排前
                preferred = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-pro", "gemini-1.5-flash"]
                sorted_models = sorted(
                    models,
                    key=lambda x: (0, preferred.index(x)) if x in preferred else (1, x)
                )
                return sorted_models if sorted_models else ["gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash"]
        except Exception:
            return ["gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash"]

    @staticmethod
    async def _fetch_claude_models(cfg: AISettings) -> List[str]:
        default_claude = [
            "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku-20241022",
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307"
        ]
        if not cfg.api_key:
            return default_claude
        endpoint = "https://api.anthropic.com/v1/models"
        headers = {
            "x-api-key": cfg.api_key,
            "anthropic-version": "2023-06-01"
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(endpoint, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    models = [item["id"] for item in data.get("data", [])]
                    if models:
                        return models
        except Exception:
            pass
        return default_claude

    @staticmethod
    async def _fetch_openrouter_models(cfg: AISettings) -> List[str]:
        default_openrouter = [
            "anthropic/claude-3.5-sonnet",
            "deepseek/deepseek-chat",
            "deepseek/deepseek-r1",
            "google/gemini-2.5-flash",
            "google/gemini-2.5-pro",
            "openai/gpt-4o",
            "openai/gpt-4o-mini",
            "meta-llama/llama-3.3-70b-instruct",
            "mistralai/mistral-large-2411",
            "qwen/qwen-2.5-72b-instruct"
        ]
        endpoint = "https://openrouter.ai/api/v1/models"
        headers = {
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "KongGuLi-孔固力自動小說生成器"
        }
        if cfg.api_key:
            headers["Authorization"] = f"Bearer {cfg.api_key}"

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(endpoint, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    raw_models = [item["id"] for item in data.get("data", []) if "id" in item]
                    if raw_models:
                        # 依熱門模型優先置頂
                        preferred_prefixes = [
                            "anthropic/claude-3.5-sonnet",
                            "deepseek/deepseek-chat",
                            "deepseek/deepseek-r1",
                            "google/gemini-2.5-flash",
                            "google/gemini-2.5-pro",
                            "openai/gpt-4o",
                            "openai/gpt-4o-mini",
                            "meta-llama/llama-3.3-70b-instruct"
                        ]
                        def sort_key(m: str):
                            for idx, prefix in enumerate(preferred_prefixes):
                                if m == prefix or m.startswith(prefix):
                                    return (0, idx, m)
                            return (1, 0, m)

                        sorted_models = sorted(raw_models, key=sort_key)
                        return sorted_models
        except Exception as e:
            print(f"Error fetching OpenRouter models: {e}")
        return default_openrouter

    @staticmethod
    async def test_connection(settings: AISettings) -> dict:
        """測試 API Key 與連線狀態，並自動獲取可用模型清單"""
        try:
            res = await AIService.call_llm(
                system_prompt="你是一位簡答助理。",
                user_prompt="請回覆『連線成功』四個字。",
                settings=settings,
                max_tokens=20
            )
            # 自動獲取該提供者旗下的模型清單
            models = await AIService.fetch_models(settings)
            return {
                "success": True, 
                "message": f"連線測試成功！AI 回應: {res.strip()}",
                "models": models
            }
        except Exception as e:
            return {"success": False, "error": str(e), "models": []}
