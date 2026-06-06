import React, { useState, useEffect, useRef } from "react";
import { History as HistoryIcon, Download, Volume2, Clock, Sparkles, Loader2, CircleOff } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';

type HistoryItem = {
  id: number;
  text: string;
  voice: string;
  audio_url: string;
  created_at: string;
};

export default function History() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const audioContext = useRef<AudioContext | null>(null);
  const activeSource = useRef<AudioBufferSourceNode | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<number | null>(null);

  useEffect(() => {
    fetchHistory();
    return () => {
      if (audioContext.current) {
        audioContext.current.close().catch(console.error);
      }
    };
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/history");
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
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

  const playAudio = async (item: HistoryItem) => {
    if (!item.audio_url) return;

    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      if (currentlyPlaying === item.id && activeSource.current) {
        activeSource.current.stop();
        activeSource.current = null;
        setCurrentlyPlaying(null);
        return;
      }

      const res = await fetch(item.audio_url);
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await audioContext.current.decodeAudioData(arrayBuffer);

      if (activeSource.current) {
        activeSource.current.stop();
      }

      const source = audioContext.current.createBufferSource();
      activeSource.current = source;
      source.buffer = audioBuffer;
      source.connect(audioContext.current.destination);

      source.onended = () => {
        setCurrentlyPlaying(null);
      };

      setCurrentlyPlaying(item.id);
      source.start();
    } catch (err) {
      console.error("Audio playback error:", err);
      setCurrentlyPlaying(null);
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
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Last 50 Saved Syntheses</p>
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
            {history.map((item) => (
              <div key={item.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest mb-2">
                      <Sparkles size={14} /> Saved Synthesis
                    </div>
                    <h2 className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                      Voice: <span className="text-slate-900">{item.voice}</span>
                    </h2>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 justify-end mb-1">
                      <Clock size={12} /> Saved {formatDate(item.created_at)}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 mb-8">
                  <p className="text-slate-800 leading-relaxed italic">"{item.text}"</p>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => playAudio(item)}
                    className={`flex items-center gap-2 px-8 py-3 ${
                      currentlyPlaying === item.id ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"
                    } text-white rounded-full font-bold text-sm shadow-md transition-all active:scale-95`}
                  >
                    {currentlyPlaying === item.id ? <CircleOff size={18} /> : <Volume2 size={18} />}
                    {currentlyPlaying === item.id ? "Stop" : "Listen Now"}
                  </button>
                  <a
                    href={item.audio_url}
                    download={`saved-synthesis-${item.id}.wav`}
                    className="flex items-center gap-2 px-8 py-3 bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 rounded-full font-bold text-sm transition-all"
                  >
                    <Download size={18} /> Download WAV
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
