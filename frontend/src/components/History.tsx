import React, { useState, useEffect, useRef } from "react";
import { History as HistoryIcon, Download, Volume2, Clock, Sparkles, Loader2, CircleOff } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';

type HistoryItem = {
  id: number;
  text: string;
  voice: string;
  created_at: string;
};

export default function History() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReconstructing, setIsReconstructing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const activeSource = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    fetchHistory();
    return () => {
      if (audioContext.current) {
        audioContext.current.close().catch(console.error);
      }
    };
  }, []);

  const reconstructAudio = async (item: HistoryItem) => {
    setIsReconstructing(true);
    const reconstructionSessionId = `history_${uuidv4()}`;
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: item.text,
          voice: item.voice,
          session_id: reconstructionSessionId,
          message_id: item.id.toString()
        }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = "";

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.substring(6).trim();
              if (!dataStr) continue;
              const data = JSON.parse(dataStr);
              if (data.status === "done" && data.audioUrl) {
                setAudioUrl(data.audioUrl);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to reconstruct audio", err);
    } finally {
      setIsReconstructing(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/history");
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
        if (data.length > 0) {
          reconstructAudio(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const playAudio = async () => {
    if (!audioUrl) return;

    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const res = await fetch(audioUrl);
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await audioContext.current.decodeAudioData(arrayBuffer);

      if (activeSource.current) {
        activeSource.current.stop();
      }

      const source = audioContext.current.createBufferSource();
      activeSource.current = source;
      source.buffer = audioBuffer;
      source.connect(audioContext.current.destination);
      source.start();
    } catch (err) {
      console.error("Audio playback error:", err);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 h-full overflow-hidden">
      <div className="border-b border-slate-200 bg-white px-8 py-5 shadow-xs">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded border border-indigo-100 flex items-center justify-center text-indigo-600">
              <HistoryIcon size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Conversion History</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Last Saved Synthesis</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-sm font-medium text-slate-500">Loading history...</p>
            </div>
          </div>
        ) : history.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
              <HistoryIcon size={32} className="text-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-slate-700">No saved conversions</p>
              <p className="text-sm text-slate-500">Click SAVE in the chat to store your favorite synthesis.</p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest mb-2">
                    <Sparkles size={14} /> Saved Synthesis
                  </div>
                  <h2 className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                    Voice: <span className="text-slate-900">{history[0].voice}</span>
                  </h2>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 justify-end mb-1">
                    <Clock size={12} /> Saved {formatDate(history[0].created_at)}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 mb-8">
                <p className="text-slate-800 leading-relaxed italic">"{history[0].text}"</p>
              </div>

              <div className="flex items-center gap-4">
                {isReconstructing ? (
                  <div className="flex items-center gap-3 px-6 py-3 bg-slate-100 text-slate-500 rounded-full font-bold text-sm">
                    <Loader2 size={18} className="animate-spin" />
                    Reconstructing Audio...
                  </div>
                ) : audioUrl ? (
                  <>
                    <button
                      onClick={playAudio}
                      className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold text-sm shadow-md transition-all active:scale-95"
                    >
                      <Volume2 size={18} /> Listen Now
                    </button>
                    <a
                      href={audioUrl}
                      download={`saved-synthesis-${history[0].id}.wav`}
                      className="flex items-center gap-2 px-8 py-3 bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 rounded-full font-bold text-sm transition-all"
                    >
                      <Download size={18} /> Download WAV
                    </a>
                  </>
                ) : (
                  <div className="text-red-500 text-sm font-bold flex items-center gap-2">
                    <CircleOff size={18} /> Reconstruction Failed
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
