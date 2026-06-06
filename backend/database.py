from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base, relationship, Mapped, mapped_column
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean
from datetime import datetime
import os

data_dir = os.path.join(os.getcwd(), "data")
os.makedirs(data_dir, exist_ok=True)
db_path = os.path.join(data_dir, "metadata.db")

DATABASE_URL = f"sqlite+aiosqlite:///{db_path}"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

Base = declarative_base()

class Voice(Base):
    __tablename__ = "voices"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    voice_name = Column(String, nullable=False, unique=True)
    is_blended = Column(Boolean, default=False)
    voice_a = Column(String, nullable=True)
    voice_b = Column(String, nullable=True)
    ratio = Column(Float, nullable=True, default=0.5)
    file_path = Column(String, nullable=True)
    original_filename = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ApiClient(Base):
    __tablename__ = "api_clients"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    client_name = Column(String, nullable=False)
    client_id = Column(String, nullable=False, unique=True, index=True)
    client_secret = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    stats = relationship("ApiClientStat", back_populates="client")

class ApiClientStat(Base):
    __tablename__ = "api_client_stats"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    client_id = Column(String, ForeignKey("api_clients.client_id"), nullable=False)
    words_processed = Column(Integer, nullable=False)
    ttfb_ms = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    client = relationship("ApiClient", back_populates="stats")

class TtsHistory(Base):
    __tablename__ = "tts_history"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    text = Column(Text, nullable=False)
    voice = Column(String, nullable=False)
    audio_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
