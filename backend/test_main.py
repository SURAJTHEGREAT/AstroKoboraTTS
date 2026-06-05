import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from main import app
from database import Base, get_db
import pytest_asyncio
import asyncio

# Setup test db
SQLALCHEMY_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
engine = create_async_engine(SQLALCHEMY_DATABASE_URL, echo=False)
TestingSessionLocal = async_sessionmaker(expire_on_commit=False, class_=AsyncSession, bind=engine)

@pytest_asyncio.fixture(autouse=True, scope="function")
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def test_read_voices():
    response = client.get("/api/voices")
    assert response.status_code == 200
    assert response.json() == []

def test_missing_message_tts():
    response = client.post("/api/tts", json={"message": ""})
    assert response.status_code == 400

def test_invalid_credentials_clients():
    response = client.post("/api/clients", json={"username": "wrong", "password": "wrong", "clientName": "Test"})
    assert response.status_code == 401

def test_blend_voices():
    blend_data = {
        "username": "admin",
        "password": "password",
        "voiceName": "TestBlend",
        "voiceA": "af_heart",
        "voiceB": "am_adam",
        "ratio": 0.5
    }
    response = client.post("/api/blend", json=blend_data)
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["voiceName"] == "TestBlend"

    # Verify it appears in voices list
    response = client.get("/api/voices")
    assert response.status_code == 200
    voices = response.json()
    assert len(voices) == 1
    assert voices[0]["voice_name"] == "TestBlend"

def test_blend_duplicate_name():
    blend_data = {
        "username": "admin",
        "password": "password",
        "voiceName": "Duplicate",
        "voiceA": "af_heart",
        "voiceB": "am_adam",
        "ratio": 0.5
    }
    response = client.post("/api/blend", json=blend_data)
    assert response.status_code == 200

    response = client.post("/api/blend", json=blend_data)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]
