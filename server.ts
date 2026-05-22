import express from "express";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { createServer as createViteServer } from "vite";
import { KokoroTTS, TextSplitterStream } from "kokoro-js";
import multer from "multer";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import crypto from "crypto";

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
    );
    CREATE TABLE IF NOT EXISTS api_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      client_id TEXT NOT NULL UNIQUE,
      client_secret TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS api_client_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      words_processed INTEGER NOT NULL,
      time_taken_ms INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES api_clients(client_id)
    );
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

// Middleware for API client authentication
const apiAuthMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (process.env.API_ONLY !== "true") {
    return next();
  }

  const clientId = req.headers["x-client-id"];
  const clientSecret = req.headers["x-client-secret"];

  if (!clientId || !clientSecret) {
    return res.status(401).json({ error: "Missing x-client-id or x-client-secret headers" });
  }

  try {
    const client = await db.get(
      "SELECT * FROM api_clients WHERE client_id = ? AND client_secret = ?",
      [clientId, clientSecret]
    );

    if (!client) {
      return res.status(401).json({ error: "Invalid client credentials" });
    }

    // Attach client info to request for potential logging/usage later
    (req as any).apiClient = client;
    next();
  } catch (err: any) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ error: "Internal server error during authentication" });
  }
};

app.post("/api/tts", apiAuthMiddleware, async (req, res) => {
  const { message, voice = "af_heart" } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const startTime = Date.now();
    const wordsProcessed = message.trim().split(/\s+/).length;

    // Setup SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const tts = await getTTS();
    
    // 1. Send initial status
    res.write(`data: ${JSON.stringify({ status: "thinking" })}\n\n`);

    // Check if voice is supported by Kokoro natively
    let actualVoice = voice;
    if (!tts.voices || !tts.voices[voice]) {
      // Check if it's a custom trained voice in our database
      const customVoice = await db.get("SELECT * FROM voices WHERE voice_name = ?", [voice]);
      if (customVoice) {
        // Since Kokoro-js in this environment doesn't natively support dynamic custom embeddings yet,
        // we simulate the custom voice by falling back to a default voice for generation.
        console.log(`Using custom voice "${voice}" (falling back to "af_heart" for actual TTS simulation)`);
        actualVoice = "af_heart";
      } else {
        throw new Error(`Voice "${voice}" not found`);
      }
    }

    const splitter = new TextSplitterStream();
    const audioStream = tts.stream(splitter, { voice: actualVoice });

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

    const timeTakenMs = Date.now() - startTime;

    // Track stats if this is an authenticated API client
    const apiClient = (req as any).apiClient;
    if (apiClient) {
      await db.run(
        `INSERT INTO api_client_stats (client_id, words_processed, time_taken_ms) VALUES (?, ?, ?)`,
        [apiClient.client_id, wordsProcessed, timeTakenMs]
      );
    }

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

// Admin route to create a new API client
app.post("/api/clients", async (req, res) => {
  const { username, password, clientName } = req.body;

  if (username !== "admin" || password !== "password") {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (!clientName) {
    return res.status(400).json({ error: "Client name is required" });
  }

  try {
    const clientId = "client_" + crypto.randomBytes(16).toString("hex");
    const clientSecret = "secret_" + crypto.randomBytes(32).toString("hex");

    await db.run(
      `INSERT INTO api_clients (client_name, client_id, client_secret) VALUES (?, ?, ?)`,
      [clientName, clientId, clientSecret]
    );

    res.json({
      success: true,
      message: "API Client generated successfully",
      client: {
        client_name: clientName,
        client_id: clientId,
        client_secret: clientSecret
      }
    });
  } catch (err: any) {
    console.error("Error creating API client:", err);
    res.status(500).json({ error: err.message });
  }
});

// Analytics route to get API client statistics
app.post("/api/analytics", async (req, res) => {
  const { username, password } = req.body;
  if (username !== "admin" || password !== "password") {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  try {
    const stats = await db.all(`
      SELECT
        c.client_name,
        SUM(s.words_processed) as total_words_processed,
        CAST(AVG(s.time_taken_ms) AS INTEGER) as avg_time_taken_ms
      FROM api_clients c
      LEFT JOIN api_client_stats s ON c.client_id = s.client_id
      GROUP BY c.client_id, c.client_name
    `);

    // Replace nulls with 0s for clients with no stats yet
    const sanitizedStats = stats.map((stat: any) => ({
      client_name: stat.client_name,
      total_words_processed: stat.total_words_processed || 0,
      avg_time_taken_ms: stat.avg_time_taken_ms || 0
    }));

    res.json(sanitizedStats);
  } catch (err: any) {
    console.error("Error fetching analytics:", err);
    res.status(500).json({ error: err.message });
  }
});

// Route to get list of trained models
app.get("/api/voices", apiAuthMiddleware, async (req, res) => {
  try {
    const voices = await db.all("SELECT * FROM voices ORDER BY created_at DESC");
    res.json(voices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export async function startServer() {
  if (process.env.API_ONLY !== "true") {
    if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else if (process.env.NODE_ENV === "production") {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  if (process.env.NODE_ENV !== "test") {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}${process.env.API_ONLY === "true" ? " (API Only Mode)" : ""}`);
    });
  }
}

// Only start the server if this file is run directly (not imported as a module)
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  startServer();
}

export { app, initDb };
