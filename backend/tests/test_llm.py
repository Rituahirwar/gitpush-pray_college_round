import pytest
import json
import os
from unittest.mock import patch, MagicMock
from backend.llm import call_json, strip_code_fences
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

@patch('backend.llm.genai.Client')
def test_call_json_success(mock_client_class):
    mock_instance = mock_client_class.return_value
    mock_response = MagicMock()
    mock_response.text = '{"status": "ok"}'
    mock_instance.models.generate_content.return_value = mock_response
    
    with patch.dict('os.environ', {'GEMINI_API_KEY': 'dummy'}):
        result = call_json("Sys", "User")
        
    assert result == {"status": "ok"}
    mock_instance.models.generate_content.assert_called_once()

@patch('backend.llm.genai.Client')
def test_call_json_invalid_json(mock_client_class):
    mock_instance = mock_client_class.return_value
    mock_response = MagicMock()
    mock_response.text = 'not json'
    mock_instance.models.generate_content.return_value = mock_response
    
    with patch.dict('os.environ', {'GEMINI_API_KEY': 'dummy'}):
        with pytest.raises(ValueError, match="Invalid JSON returned by the model"):
            call_json("Sys", "User")

@patch('backend.llm.time.sleep')
@patch('backend.llm.genai.Client')
def test_call_json_retry_on_429(mock_client_class, mock_sleep):
    mock_error = APIError("Rate limit", 429, "Too Many Requests")
    
    mock_instance = mock_client_class.return_value
    mock_response = MagicMock()
    mock_response.text = '{"status": "recovered"}'
    
    # Fail twice, succeed on third
    mock_instance.models.generate_content.side_effect = [mock_error, mock_error, mock_response]
    
    with patch.dict('os.environ', {'GEMINI_API_KEY': 'dummy'}):
        result = call_json("Sys", "User")
        
    assert result == {"status": "recovered"}
    assert mock_instance.models.generate_content.call_count == 3
    assert mock_sleep.call_count == 2
    mock_sleep.assert_any_call(1)
    mock_sleep.assert_any_call(2)

@patch('backend.llm.time.sleep')
@patch('backend.llm.genai.Client')
def test_call_json_max_retries_exceeded(mock_client_class, mock_sleep):
    mock_error = APIError("Server Error", 500, "Internal Server Error")
    mock_instance = mock_client_class.return_value
    mock_instance.models.generate_content.side_effect = mock_error
    
    with patch.dict('os.environ', {'GEMINI_API_KEY': 'dummy'}):
        with pytest.raises(APIError):
            call_json("Sys", "User")
        
    assert mock_instance.models.generate_content.call_count == 4
    assert mock_sleep.call_count == 3
