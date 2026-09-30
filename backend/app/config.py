import os
import json
from pathlib import Path
from app.models import AISettings

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
SETTINGS_FILE = DATA_DIR / "settings.json"
NOVELS_DIR = DATA_DIR / "novels"
UPLOADS_DIR = DATA_DIR / "uploads"

# 確保目錄存在
DATA_DIR.mkdir(parents=True, exist_ok=True)
NOVELS_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_SETTINGS = AISettings(
    provider="openai",
    api_key="",
    base_url="",
    model="gpt-4o",
    temperature=0.75,
    max_tokens=4000
)

def get_settings() -> AISettings:
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                settings = AISettings(**data)
                
                # 向下相容：若舊版設定沒有 providers，自動遷移
                prov = settings.provider or "openai"
                if not settings.providers or prov not in settings.providers:
                    if not settings.providers:
                        settings.providers = {}
                    from app.models import ProviderConfig
                    settings.providers[prov] = ProviderConfig(
                        api_key=settings.api_key,
                        base_url=settings.base_url or "",
                        model=settings.model
                    )

                # 確保 openrouter 配置存在
                if "openrouter" not in settings.providers:
                    from app.models import ProviderConfig
                    settings.providers["openrouter"] = ProviderConfig(
                        api_key="",
                        base_url="https://openrouter.ai/api/v1",
                        model="anthropic/claude-3.5-sonnet",
                        cached_models=[]
                    )
                
                # 確保當前 active provider 的資料與頂層保持一致 (雙向互補同步)
                active_p = settings.providers.get(prov)
                if active_p:
                    if not active_p.api_key and settings.api_key:
                        active_p.api_key = settings.api_key
                    elif not settings.api_key and active_p.api_key:
                        settings.api_key = active_p.api_key
                    
                    if not active_p.base_url and settings.base_url:
                        active_p.base_url = settings.base_url
                    elif not settings.base_url and active_p.base_url:
                        settings.base_url = active_p.base_url
                    
                    if settings.model and active_p.model != settings.model:
                        active_p.model = settings.model
                    elif not settings.model and active_p.model:
                        settings.model = active_p.model
                
                return settings
        except Exception as e:
            print(f"Error reading settings: {e}")
    return DEFAULT_SETTINGS

def save_settings(settings: AISettings) -> AISettings:
    prov = settings.provider or "openai"
    from app.models import ProviderConfig
    
    # 確保 providers 結構完整並同步當前生效項目
    if not settings.providers:
        settings.providers = {}
        
    existing_cached = []
    if prov in settings.providers and settings.providers[prov]:
        existing_cached = getattr(settings.providers[prov], 'cached_models', []) or []
        
    settings.providers[prov] = ProviderConfig(
        api_key=settings.api_key,
        base_url=settings.base_url or "",
        model=settings.model,
        cached_models=existing_cached
    )
    
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings.model_dump(), f, ensure_ascii=False, indent=2)
    return settings
