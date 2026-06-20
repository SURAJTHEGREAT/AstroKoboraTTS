import pytest
from fastapi.testclient import TestClient
from main import app, NLLB_LANG_MAP
from database import get_db
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from database import Base
import pytest_asyncio
from unittest.mock import MagicMock, patch
import json

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
async def test_chinese_tts_mapping():
    import main
    original_model = main.kokoro_model
    main.kokoro_model = MagicMock()
    # Mock create to return some dummy samples and sample_rate
    main.kokoro_model.create.return_value = ([0.1, 0.2], 24000)

    # Mock translate_text to just return the text as is to simplify
    with patch("main.translate_text", return_value="你好") as mock_translate:
        response = client.post("/api/tts", json={
            "message": "Hello",
            "voice": "af_heart",
            "source_lang": "eng_Latn",
            "target_lang": "zho_Hans"
        })

        assert response.status_code == 200

        # Consume the stream
        for line in response.iter_lines():
            pass

        # Verify that kokoro_model.create was called with 'cmn'
        # It's called once per chunk. "你好" is 1 chunk.
        main.kokoro_model.create.assert_called_with("你好", voice="zf_xiaobei", speed=1.0, lang="cmn")

    main.kokoro_model = original_model

def test_nllb_lang_map_zh():
    assert NLLB_LANG_MAP["zho_Hans"]["kokoro_lang"] == "cmn"
    assert NLLB_LANG_MAP["zho_Hans"]["default_voice"] == "zf_xiaobei"
