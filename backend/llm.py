import os
import json
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import APIError

load_dotenv("backend/.env")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

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
        
    client = genai.Client(api_key=api_key)

    config_kwargs = {
        "system_instruction": system_prompt,
        "response_mime_type": "application/json",
        "http_options": {"timeout": 60000} # google-genai timeout is in ms for http_options or wait, it might be timeout parameter
    }
    if schema:
        config_kwargs["response_schema"] = schema
        
    config = types.GenerateContentConfig(**config_kwargs)

    max_tries = 4
    for attempt in range(max_tries):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=user_content,
                config=config
            )
            raw_text = response.text
            clean_text = strip_code_fences(raw_text)
            try:
                return json.loads(clean_text)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON returned by the model: {clean_text}") from e
                
        except Exception as e:
            err_str = str(e).lower()
            code_val = getattr(e, 'code', None)
            try:
                code_int = int(code_val) if code_val is not None else 0
            except (ValueError, TypeError):
                code_int = 0
            
            if code_int == 429 or (500 <= code_int < 600) or "429" in err_str or "500" in err_str or "502" in err_str or "503" in err_str or "timeout" in err_str:
                if attempt == max_tries - 1:
                    raise
                time.sleep(2 ** attempt)
            else:
                raise
