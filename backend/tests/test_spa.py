import pytest
from fastapi.testclient import TestClient
from pathlib import Path
from backend.main import app, ROOT_DIR

def test_api_health_works():
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}

def test_spa_fallback_unknown_non_api_path():
    client = TestClient(app)
    frontend_dist = ROOT_DIR / "frontend" / "dist"
    index_html = frontend_dist / "index.html"
    
    # Verify index.html exists in frontend/dist
    assert index_html.exists(), "frontend/dist/index.html must exist for SPA fallback"
    expected_bytes = index_html.read_bytes()

    # Test root path
    resp_root = client.get("/")
    assert resp_root.status_code == 200
    assert resp_root.content == expected_bytes

    # Test unknown non-api path
    resp_unknown = client.get("/some/unknown/spa-route")
    assert resp_unknown.status_code == 200
    assert resp_unknown.content == expected_bytes

    # Test frontend client-side route
    resp_audit = client.get("/audit")
    assert resp_audit.status_code == 200
    assert resp_audit.content == expected_bytes

def test_non_existent_api_path_returns_404():
    client = TestClient(app)
    # Unknown API path should NOT return index.html, it should return 404
    resp = client.get("/api/non-existent-endpoint")
    assert resp.status_code == 404
