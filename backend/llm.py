import os
import json
import time
import hashlib
import re
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import APIError

load_dotenv("backend/.env")
load_dotenv(".env")

CACHE_DIR = Path(".llm_cache")

def compute_cache_key(model: str, system_prompt: str, user_content: str, schema: dict = None) -> str:
    schema_str = json.dumps(schema, sort_keys=True) if schema is not None else ""
    payload = f"{model}:{system_prompt}:{user_content}:{schema_str}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

def strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        # Remove first line (e.g., ```json)
        text = text.split("\n", 1)[-1]
    if text.endswith("```"):
        # Remove the last line
        text = text.rsplit("\n", 1)[0]
    return text.strip()

def call_json(system_prompt: str, user_content: str, schema: dict = None) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is missing. Set it in backend/.env")

    model = os.getenv("GEMINI_MODEL")
    if not model:
        raise ValueError("GEMINI_MODEL is missing. Set it in backend/.env")

    use_cache = os.getenv("LLM_CACHE") == "1"
    cache_file = None
    if use_cache:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_key = compute_cache_key(model, system_prompt, user_content, schema)
        cache_file = CACHE_DIR / f"{cache_key}.json"
        if cache_file.exists():
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass

    client = genai.Client(api_key=api_key)

    config_kwargs = {
        "system_instruction": system_prompt,
        "response_mime_type": "application/json",
        "http_options": {"timeout": 60000}
    }
    if schema:
        config_kwargs["response_schema"] = schema
        
    config = types.GenerateContentConfig(**config_kwargs)

    max_tries = 4
    for attempt in range(max_tries):
        try:
            response = client.models.generate_content(
                model=model,
                contents=user_content,
                config=config
            )
            raw_text = response.text
            clean_text = strip_code_fences(raw_text)
            try:
                result = json.loads(clean_text)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON returned by the model: {clean_text}") from e
                
            if use_cache and cache_file is not None:
                try:
                    with open(cache_file, "w", encoding="utf-8") as f:
                        json.dump(result, f, indent=2)
                except Exception:
                    pass
            return result
                
        except Exception as e:
            err_str = str(e).lower()
            code_val = getattr(e, 'code', None)
            try:
                code_int = int(code_val) if code_val is not None else 0
            except (ValueError, TypeError):
                code_int = 0
            
            is_daily_limit = ("per day" in err_str or "per-day" in err_str or "daily" in err_str or "per_day" in err_str)
            if (code_int == 429 or "429" in err_str or "resource_exhausted" in err_str) and is_daily_limit:
                raise RuntimeError(f"Daily quota exhausted for model '{model}': {e}") from e

            if code_int == 429 or (500 <= code_int < 600) or "429" in err_str or "500" in err_str or "502" in err_str or "503" in err_str or "timeout" in err_str or "resource_exhausted" in err_str:
                if attempt == max_tries - 1:
                    raise
                wait_sec = float(2 ** attempt)
                match = re.search(r'retry in (\d+(?:\.\d+)?)s', err_str)
                if match:
                    wait_sec = max(wait_sec, float(match.group(1)) + 1.0)
                time.sleep(wait_sec)
            else:
                raise
