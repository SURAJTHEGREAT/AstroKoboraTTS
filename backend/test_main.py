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
    await engine.dispose()

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

@pytest.mark.asyncio
async def test_tts_disconnect():
    # Mocking request.is_disconnected is tricky with TestClient,
    # but we can verify the logic by ensuring the loop respects a mock
    from unittest.mock import AsyncMock, MagicMock
    from main import tts_endpoint, TTSRequest

    mock_db = AsyncMock()
    mock_execute_result = MagicMock()
    mock_execute_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_execute_result

    mock_request = MagicMock()
    # Mock headers for api_auth_middleware
    mock_request.headers = {}
    # Simulate disconnection BEFORE first chunk starts processing
    # The loop does:
    # for i, text_chunk in enumerate(chunks):
    #     if await request.is_disconnected(): break
    # We use a side_effect that returns True, but then we might need to handle subsequent calls if any
    mock_request.is_disconnected = AsyncMock(return_value=True)

    body = TTSRequest(message="This is a test message that should be chunked into multiple parts.")

    # We need a mock kokoro_model
    import main
    original_model = main.kokoro_model
    main.kokoro_model = MagicMock()
    main.kokoro_model.create.return_value = ([0.1, 0.2], 24000)

    try:
        response = await tts_endpoint(mock_request, body, mock_db)

        chunks = []
        async for chunk in response.body_iterator:
            chunks.append(chunk)

        # Should have stopped after first chunk (plus thinking/text status)
        # 1. Thinking
        # 2. Text status
        # 3. First audio chunk
        # Then it checks is_disconnected and breaks

        assert len(chunks) < 10 # Should not process all chunks of a long message
        # chunks are strings when using body_iterator on StreamingResponse in this context?
        # Actually it depends on how it's yielded. main yields strings.
        # chunks are likely bytes in body_iterator
        # Should have NO audio chunks because we disconnected immediately
        assert not any(b"audio" in c if isinstance(c, bytes) else "audio" in c for c in chunks)
        # Verify it didn't reach the "done" status because it broke early
        assert not any(b"done" in c if isinstance(c, bytes) else "done" in c for c in chunks)

    finally:
        main.kokoro_model = original_model
