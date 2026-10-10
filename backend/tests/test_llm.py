import pytest
import json
import os
from unittest.mock import patch, MagicMock
from backend.llm import call_json, strip_code_fences, compute_cache_key
from google.genai.errors import APIError

def test_strip_code_fences():
    raw = "```json\n{\"test\": 123}\n```"
    assert strip_code_fences(raw) == '{"test": 123}'
    
    raw_no_fence = '{"test": 123}'
    assert strip_code_fences(raw_no_fence) == '{"test": 123}'

def test_call_json_missing_key():
    with patch.dict('os.environ', clear=True): # Clear env to ensure no key
        with pytest.raises(ValueError, match="GEMINI_API_KEY is missing"):
            call_json("Sys", "User")

def test_call_json_missing_model():
    with patch.dict('os.environ', {'GEMINI_API_KEY': 'dummy'}, clear=True):
        with pytest.raises(ValueError, match="GEMINI_MODEL is missing"):
            call_json("Sys", "User")

@patch('backend.llm.genai.Client')
def test_call_json_success(mock_client_class):
    mock_instance = mock_client_class.return_value
    mock_response = MagicMock()
    mock_response.text = '{"status": "ok"}'
    mock_instance.models.generate_content.return_value = mock_response
    
    with patch.dict('os.environ', {'GEMINI_API_KEY': 'dummy', 'GEMINI_MODEL': 'gemini-3.5-flash-lite', 'LLM_CACHE': '0'}):
        result = call_json("Sys", "User")
        
    assert result == {"status": "ok"}
    mock_instance.models.generate_content.assert_called_once()

@patch('backend.llm.genai.Client')
def test_call_json_invalid_json(mock_client_class):
    mock_instance = mock_client_class.return_value
    mock_response = MagicMock()
    mock_response.text = 'not json'
    mock_instance.models.generate_content.return_value = mock_response
    
    with patch.dict('os.environ', {'GEMINI_API_KEY': 'dummy', 'GEMINI_MODEL': 'gemini-3.5-flash-lite', 'LLM_CACHE': '0'}):
        with pytest.raises(ValueError, match="Invalid JSON returned by the model"):
            call_json("Sys", "User")

@patch('backend.llm.time.sleep')
@patch('backend.llm.genai.Client')
def test_call_json_retry_on_429(mock_client_class, mock_sleep):
    mock_error = APIError("Rate limit: requests per minute exceeded", 429, "Too Many Requests")
    
    mock_instance = mock_client_class.return_value
    mock_response = MagicMock()
    mock_response.text = '{"status": "recovered"}'
    
    # Fail twice, succeed on third
    mock_instance.models.generate_content.side_effect = [mock_error, mock_error, mock_response]
    
    with patch.dict('os.environ', {'GEMINI_API_KEY': 'dummy', 'GEMINI_MODEL': 'gemini-3.5-flash-lite', 'LLM_CACHE': '0'}):
        result = call_json("Sys", "User")
        
    assert result == {"status": "recovered"}
    assert mock_instance.models.generate_content.call_count == 3
    assert mock_sleep.call_count == 2
    mock_sleep.assert_any_call(1)
    mock_sleep.assert_any_call(2)

@patch('backend.llm.time.sleep')
@patch('backend.llm.genai.Client')
def test_call_json_429_per_day_fails_fast(mock_client_class, mock_sleep):
    mock_error = APIError("Quota exceeded: GenerateContent requests per day per project", 429, "Resource Exhausted")
    mock_instance = mock_client_class.return_value
    mock_instance.models.generate_content.side_effect = mock_error
    
    with patch.dict('os.environ', {'GEMINI_API_KEY': 'dummy', 'GEMINI_MODEL': 'gemini-3.5-flash-lite', 'LLM_CACHE': '0'}):
        with pytest.raises(RuntimeError, match="Daily quota exhausted for model 'gemini-3.5-flash-lite'"):
            call_json("Sys", "User")
            
    assert mock_instance.models.generate_content.call_count == 1
    mock_sleep.assert_not_called()

@patch('backend.llm.time.sleep')
@patch('backend.llm.genai.Client')
def test_call_json_max_retries_exceeded(mock_client_class, mock_sleep):
    mock_error = APIError("Server Error", 500, "Internal Server Error")
    mock_instance = mock_client_class.return_value
    mock_instance.models.generate_content.side_effect = mock_error
    
    with patch.dict('os.environ', {'GEMINI_API_KEY': 'dummy', 'GEMINI_MODEL': 'gemini-3.5-flash-lite', 'LLM_CACHE': '0'}):
        with pytest.raises(APIError):
            call_json("Sys", "User")
        
    assert mock_instance.models.generate_content.call_count == 4
    assert mock_sleep.call_count == 3

@patch('backend.llm.genai.Client')
def test_llm_cache_disabled_by_default(mock_client_class, tmp_path):
    mock_instance = mock_client_class.return_value
    mock_response = MagicMock()
    mock_response.text = '{"cached": false}'
    mock_instance.models.generate_content.return_value = mock_response

    with patch('backend.llm.CACHE_DIR', tmp_path):
        with patch.dict('os.environ', {'GEMINI_API_KEY': 'dummy', 'GEMINI_MODEL': 'gemini-3.5-flash-lite'}, clear=True):
            res1 = call_json("Sys", "User")
            res2 = call_json("Sys", "User")

    assert res1 == {"cached": False}
    assert res2 == {"cached": False}
    assert mock_instance.models.generate_content.call_count == 2

@patch('backend.llm.genai.Client')
def test_llm_cache_hit_skips_api(mock_client_class, tmp_path):
    mock_instance = mock_client_class.return_value
    mock_response = MagicMock()
    mock_response.text = '{"cached": true}'
    mock_instance.models.generate_content.return_value = mock_response

    with patch('backend.llm.CACHE_DIR', tmp_path):
        with patch.dict('os.environ', {'GEMINI_API_KEY': 'dummy', 'GEMINI_MODEL': 'gemini-3.5-flash-lite', 'LLM_CACHE': '1'}, clear=True):
            res1 = call_json("Sys", "User")
            res2 = call_json("Sys", "User")

    assert res1 == {"cached": True}
    assert res2 == {"cached": True}
    assert mock_instance.models.generate_content.call_count == 1

def test_llm_cache_different_model_different_key():
    k1 = compute_cache_key("model-a", "Sys", "User")
    k2 = compute_cache_key("model-b", "Sys", "User")
    assert k1 != k2
