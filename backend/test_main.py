import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from main import app, ADMIN_USERNAME, ADMIN_PASSWORD
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

@pytest.mark.asyncio
async def test_admin_verify_endpoint():
    # Test with configured credentials
    verify_data = {
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    }
    response = client.post("/api/admin/verify", json=verify_data)
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Test with wrong credentials
    verify_data = {
        "username": "wrong",
        "password": "wrong"
    }
    response = client.post("/api/admin/verify", json=verify_data)
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_direct_analytics():
    # 1. Trigger a direct TTS request (no auth headers)
    # We need to mock kokoro_model so it doesn't fail if model files are missing
    import main
    from unittest.mock import MagicMock
    from database import ApiClient
    from sqlalchemy import select

    # We need to manually initialize the "direct" client since startup_event
    # might not run or use the right DB in TestClient setup sometimes depending on how it's called
    async with TestingSessionLocal() as db:
        result = await db.execute(select(ApiClient).where(ApiClient.client_id == "direct"))
        if not result.scalar_one_or_none():
            direct_client = ApiClient(
                client_name="direct",
                client_id="direct",
                client_secret="test_secret"
            )
            db.add(direct_client)
            await db.commit()

    original_model = main.kokoro_model
    main.kokoro_model = MagicMock()
    main.kokoro_model.create.return_value = ([0.1, 0.2], 24000)

    try:
        # We use a short message to avoid too many chunks
        response = client.post("/api/tts", json={"message": "Hello", "voice": "af_heart"})
        assert response.status_code == 200
        # Consume the stream to trigger tracking
        for _ in response.iter_lines():
            pass

        # 2. Check analytics
        analytics_data = {
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        }
        response = client.post("/api/analytics", json=analytics_data)
        assert response.status_code == 200
        stats = response.json()

        # Should find a client named "direct"
        direct_stats = next((s for s in stats if s["client_name"] == "direct"), None)
        assert direct_stats is not None
        assert direct_stats["total_files_generated"] >= 1
        assert direct_stats["total_words_processed"] == 1
    finally:
        main.kokoro_model = original_model

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
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD,
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
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD,
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
