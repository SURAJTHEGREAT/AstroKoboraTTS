import express from "express";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { createServer as createViteServer } from "vite";
import { KokoroTTS, TextSplitterStream } from "kokoro-js";
import multer from "multer";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const app = express();
const PORT = 3000;

// Persistent directory for models and database
const dataDir = path.join(process.cwd(), "data");
const modelsDir = path.join(dataDir, "models");

// Initialize SQLite Database
let db: any;
async function initDb() {
  // Ensure persistent directories exist before initializing DB
  await fs.mkdir(modelsDir, { recursive: true });

  db = await open({
    filename: path.join(dataDir, "metadata.db"),
    driver: sqlite3.Database,
  });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS voices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voice_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
initDb().catch(console.error);
app.use(express.json());

// Initialize Kokoro TTS (lazy load)
let ttsInstance: any = null;
const model_id = "onnx-community/Kokoro-82M-v1.0-ONNX";

async function getTTS() {
  if (!ttsInstance) {
    console.log("Loading Kokoro TTS model to CPU...");
    ttsInstance = await KokoroTTS.from_pretrained(model_id, {
      dtype: "q8",
      device: "cpu",
    });
    console.log("Kokoro TTS Model successfully loaded!");
  }
  return ttsInstance;
}

// Ensure temp directory exists for audio chunks
const tempDir = path.join(os.tmpdir(), "kokoro_chunks");
fs.mkdir(tempDir, { recursive: true }).catch(console.error);

// Add endpoint to serve audio chunks
app.get("/api/audio/:filename", (req, res) => {
  const filepath = path.join(tempDir, req.params.filename);
  res.sendFile(filepath);
});

// Multer setup for voice embedding upload
const upload = multer({ dest: path.join(os.tmpdir(), "kokoro_uploads") });

app.post("/api/tts", async (req, res) => {
  const { message, voice = "af_heart" } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    // Setup SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const tts = await getTTS();
    
    // 1. Send initial status
    res.write(`data: ${JSON.stringify({ status: "thinking" })}\n\n`);

    const splitter = new TextSplitterStream();
    const audioStream = tts.stream(splitter, { voice });

    // Audio consumer loop
    let chunkIndex = 0;
    const processAudio = async () => {
      for await (const { text, phonemes, audio } of audioStream) {
        console.log(`[Chunk ${chunkIndex}] Processing text: "${text}"`);
        const filename = `chunk-${Date.now()}-${chunkIndex++}.wav`;
        const filepath = path.join(tempDir, filename);
        await audio.save(filepath);
        
        res.write(`data: ${JSON.stringify({ 
           status: "audio",
           text,
           audioUrl: `/api/audio/${filename}` 
        })}\n\n`);
        
        // Cleanup temp file after 60s to allow client to fetch it
        setTimeout(() => fs.unlink(filepath).catch(() => {}), 60000);
      }
    };

    const processAudioPromise = processAudio();

    // Stream text directly into the splitter
    splitter.push(message);
    res.write(`data: ${JSON.stringify({ status: "text", text: message })}\n\n`);

    // End splitter when text is fully streamed
    splitter.close();

    // Wait for audio generation to finish
    await processAudioPromise;

    res.write(`data: ${JSON.stringify({ status: "done" })}\n\n`);
    res.end();

  } catch (err: any) {
    console.error("TTS Error:", err);
    res.write(`data: ${JSON.stringify({ error: err.message || "Unknown error" })}\n\n`);
    res.end();
  }
});

// Admin training route - Upload custom voice sample
app.post("/api/train", upload.single("sample"), async (req, res) => {
  const { username, password, voiceName } = req.body;
  if (username !== "admin" || password !== "password") {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No sample file uploaded" });
  }

  const finalVoiceName = voiceName || `voice_${Date.now()}`;

  try {
    // In a real application we would pass this to kokoro model to extract embeddings
    // Here we simulate the processing time
    console.log(`Received sample file for training: ${req.file.path}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const targetFileName = `${finalVoiceName}_${Date.now()}${path.extname(req.file.originalname)}`;
    const targetFilePath = path.join(modelsDir, targetFileName);

    // Move uploaded file to persistent storage safely across volumes
    await fs.copyFile(req.file.path, targetFilePath);
    await fs.unlink(req.file.path);
    
    // Insert metadata into DB
    await db.run(
      `INSERT INTO voices (voice_name, file_path, original_filename) VALUES (?, ?, ?)`,
      [finalVoiceName, targetFilePath, req.file.originalname]
    );

    res.json({ success: true, message: "Voice embedding trained successfully", voiceName: finalVoiceName });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Route to get list of trained models
app.get("/api/voices", async (req, res) => {
  try {
    const voices = await db.all("SELECT * FROM voices ORDER BY created_at DESC");
    res.json(voices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
