import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from main import app
from database import Base, get_db
import pytest_asyncio

# Setup test db
SQLALCHEMY_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
engine = create_async_engine(SQLALCHEMY_DATABASE_URL, echo=False)
TestingSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=AsyncSession)

async def override_get_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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
