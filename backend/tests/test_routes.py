from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_routes_exist():
    # Documents endpoint should require auth (401), not 404
    response = client.get("/api/v1/documents")
    assert response.status_code == 401

    # Upload endpoint should require auth (401), not 404
    response = client.post("/api/v1/documents/upload")
    assert response.status_code == 401

    # Auth register endpoint should accept requests
    response = client.post("/api/v1/auth/register", json={"email": "test@example.com", "password": "pass"})
    assert response.status_code in [201, 400]
