import React, { useState, useRef, useEffect } from "react";
import { Mic, Send, Loader2, Volume2, User, Bot, Globe, Sparkles, Square } from "lucide-react";
import { Link } from "react-router";

type Message = {
  role: "user" | "assistant";
  content: string;
  voice?: string;
};

const AVAILABLE_VOICES = [
  // American English (US)
  { id: "af_heart", name: "Heart", gender: "Female", region: "US", desc: "Default, highly natural & expressive" },
  { id: "af_bella", name: "Bella", gender: "Female", region: "US", desc: "Warm, soft & expressive tone" },
  { id: "af_sarah", name: "Sarah", gender: "Female", region: "US", desc: "Professional, crisp presenter" },
  { id: "af_nicole", name: "Nicole", gender: "Female", region: "US", desc: "Friendly & engaging conversationalist" },
  { id: "af_nova", name: "Nova", gender: "Female", region: "US", desc: "Smooth standard speaker profile" },
  { id: "af_sky", name: "Sky", gender: "Female", region: "US", desc: "Calm, soft & peaceful tone" },
  { id: "am_adam", name: "Adam", gender: "Male", region: "US", desc: "Deep, resonant & natural narration" },
  { id: "am_michael", name: "Michael", gender: "Male", region: "US", desc: "Clear, confident & professional" },
  { id: "am_echo", name: "Echo", gender: "Male", region: "US", desc: "Standard, clean speaker" },
  { id: "am_onyx", name: "Onyx", gender: "Male", region: "US", desc: "Rich bass speaker style" },
  
  // British English (UK)
  { id: "bf_emma", name: "Emma", gender: "Female", region: "UK", desc: "Clear, precise British speaker" },
  { id: "bf_isabella", name: "Isabella", gender: "Female", region: "UK", desc: "Natural & fluent dialect style" },
  { id: "bf_alice", name: "Alice", gender: "Female", region: "UK", desc: "Sweet, articulate British voice" },
  { id: "bm_george", name: "George", gender: "Male", region: "UK", desc: "Authoritative classic British tone" },
  { id: "bm_lewis", name: "Lewis", gender: "Male", region: "UK", desc: "Warm, mature UK speaker" },
  { id: "bm_daniel", name: "Daniel", gender: "Male", region: "UK", desc: "Friendly & crisp British conversationalist" },
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResponse, setCurrentResponse] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("af_heart");
  const [customVoices, setCustomVoices] = useState<any[]>([]);
  
  // Audio playback queue
  const audioQueue = useRef<string[]>([]);
  const isPlaying = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const activeSource = useRef<AudioBufferSourceNode | null>(null);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    const fetchCustomVoices = async () => {
      try {
        const response = await fetch("/api/voices");
        if (response.ok) {
          const data = await response.json();
          setCustomVoices(data);
        }
      } catch (err) {
        console.error("Failed to fetch custom voices", err);
      }
    };
    fetchCustomVoices();

    return () => {
      if (audioContext.current) {
        audioContext.current.close().catch(console.error);
      }
    };
  }, []);

  const playNextAudio = async () => {
    if (audioQueue.current.length === 0) {
      isPlaying.current = false;
      return;
    }

    isPlaying.current = true;
    const audioUrl = audioQueue.current.shift();
    if (!audioUrl) {
      playNextAudio();
      return;
    }

    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Fetch array buffer from URL
      const res = await fetch(audioUrl);
      const arrayBuffer = await res.arrayBuffer();
      
      const audioBuffer = await audioContext.current.decodeAudioData(arrayBuffer);
      const source = audioContext.current.createBufferSource();
      activeSource.current = source;
      source.buffer = audioBuffer;
      source.connect(audioContext.current.destination);
      
      source.onended = () => {
        if (activeSource.current === source) {
          activeSource.current = null;
          playNextAudio();
        }
      };
      
      source.start();
    } catch (err) {
      console.error("Audio playback error:", err);
      playNextAudio();
    }
  };

  const enqueueAudio = (base64Audio: string) => {
    audioQueue.current.push(base64Audio);
    if (!isPlaying.current) {
      playNextAudio();
    }
  };

  const handleStop = () => {
    if (abortController.current) {
      abortController.current.abort();
      abortController.current = null;
    }

    // Stop audio playback
    if (activeSource.current) {
      activeSource.current.stop();
      activeSource.current = null;
    }

    // Clear queue
    audioQueue.current = [];
    isPlaying.current = false;
    setIsGenerating(false);
  };

  const generateTTS = async (text: string, voice: string) => {
    setIsGenerating(true);
    setCurrentResponse("");
    abortController.current = new AbortController();

    let accumulatedText = "";

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.current.signal,
        body: JSON.stringify({ message: text, voice: voice }),
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
              try {
                const data = JSON.parse(dataStr);
                if (data.error) {
                  console.error("Server Error:", data.error);
                  accumulatedText += `\n\n[Error: ${data.error}]`;
                  setCurrentResponse(accumulatedText);
                  break;
                }
                
                if (data.status === "text") {
                  accumulatedText += data.text;
                  setCurrentResponse(accumulatedText);
                } else if (data.status === "audio" && data.audioUrl) {
                  enqueueAudio(data.audioUrl);
                }
              } catch (parseError) {
                console.error("Error parsing stream chunk", dataStr, parseError);
              }
            }
          }
        }
      }

      setMessages(prev => [...prev, { role: "assistant", content: accumulatedText, voice: voice }]);
      setCurrentResponse("");

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log("TTS generation aborted by user");
        if (accumulatedText) {
          setMessages(prev => [...prev, { role: "assistant", content: accumulatedText, voice: voice }]);
        }
      } else {
        console.error("Failed to send message", err);
      }
    } finally {
      setIsGenerating(false);
      setCurrentResponse("");
      abortController.current = null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);

    await generateTTS(userMessage, selectedVoice);
  };

  const handleApplyVoice = async (text: string) => {
    if (isGenerating || input.trim() !== "") return;
    await generateTTS(text, selectedVoice);
  };

  const currentVoiceObj = 
    AVAILABLE_VOICES.find(v => v.id === selectedVoice) || 
    (customVoices.find(v => v.voice_name === selectedVoice) ? {
      id: selectedVoice,
      name: customVoices.find(v => v.voice_name === selectedVoice).voice_name,
      gender: "Custom",
      region: "Local",
      desc: "Custom trained voice embedding"
    } : undefined);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 h-full overflow-hidden">
      {/* Voice Selection Panel */}
      <div className="border-b border-slate-200 bg-white px-8 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Volume2 size={18} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Active Speaker Profile</div>
            <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              {currentVoiceObj?.name} ({currentVoiceObj?.region === "US" ? "American" : currentVoiceObj?.region === "UK" ? "British" : "Local"})
              <span className={`px-2 py-0.5 text-[9px] rounded font-bold uppercase ${
                currentVoiceObj?.gender === "Female" 
                  ? "bg-pink-50 border border-pink-100 text-pink-600" 
                  : currentVoiceObj?.gender === "Male"
                    ? "bg-indigo-50 border border-indigo-100 text-indigo-600"
                    : "bg-emerald-50 border border-emerald-100 text-emerald-600"
              }`}>
                {currentVoiceObj?.gender}
              </span>
            </div>
            <div className="text-xs text-slate-500 leading-normal hidden sm:block">
              {currentVoiceObj?.desc}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="voice-select" className="text-xs font-semibold text-slate-600 font-mono flex items-center gap-1.5">
            <Globe size={13} className="text-slate-400" /> System & Blended:
          </label>
          <select
            id="voice-select"
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            disabled={isGenerating}
            className="bg-white border border-slate-200 rounded px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all cursor-pointer min-w-[220px] disabled:opacity-50 shadow-xs"
          >
            <optgroup label="🇺🇸 American Accent (US)">
              {AVAILABLE_VOICES.filter(v => v.region === "US").map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.gender})
                </option>
              ))}
            </optgroup>
            <optgroup label="🇬🇧 British Accent (UK)">
              {AVAILABLE_VOICES.filter(v => v.region === "UK").map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.gender})
                </option>
              ))}
            </optgroup>
            {customVoices.length > 0 && (
              <optgroup label="🎙️ Blended Voices">
                {customVoices.map(v => (
                  <option key={v.id} value={v.voice_name}>
                    {v.voice_name} (Blended)
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
            <Volume2 className="w-12 h-12 text-indigo-500/40" />
            <p className="text-lg font-medium text-slate-700">Text-to-Speech Synthesis</p>
            <p className="text-sm max-w-sm text-center text-slate-500">
              Your text will be converted to speech in real-time via Kokoro TTS.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${msg.role === "user" ? "bg-slate-200 text-slate-700" : "bg-indigo-600 text-white shadow-xs"}`}>
                {msg.role === "user" ? "US" : "TTS"}
              </div>
              <div className={`p-4 max-w-lg ${msg.role === "user" ? "bg-slate-100 border border-slate-200/60 rounded-2xl rounded-tr-none" : "bg-indigo-50 border border-indigo-100 rounded-2xl rounded-tl-none"}`}>
                <p className="text-sm leading-relaxed text-slate-800">{msg.content}</p>
                {msg.role === "assistant" && (
                  <div className="mt-2.5 pt-2 border-t border-indigo-100">
                    {msg.voice && (
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-indigo-600 font-mono uppercase tracking-wider opacity-85 mb-2">
                        <Sparkles size={11} className="text-indigo-500/80" /> Voice Profile: {
                          AVAILABLE_VOICES.find(v => v.id === msg.voice)?.name ||
                          customVoices.find(v => v.voice_name === msg.voice)?.voice_name ||
                          msg.voice
                        }
                      </div>
                    )}
                    <button
                      onClick={() => handleApplyVoice(msg.content)}
                      disabled={isGenerating || input.trim() !== ""}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-indigo-200 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:border-slate-200 disabled:text-slate-400"
                    >
                      <Sparkles size={12} /> APPLY
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {isGenerating && (
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-xs">
              TTS
            </div>
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl rounded-tl-none max-w-lg">
              {currentResponse ? (
                <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {currentResponse}
                  <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-600 animate-pulse align-middle" />
                </p>
              ) : (
                <div className="flex items-center gap-3">
                   <div className="flex gap-1 h-3 items-end opacity-70">
                     <div className="w-1 bg-indigo-600 h-2 animate-bounce" style={{animationDelay: "0ms"}}></div>
                     <div className="w-1 bg-indigo-600 h-3 animate-bounce" style={{animationDelay: "150ms"}}></div>
                     <div className="w-1 bg-indigo-600 h-1 animate-bounce" style={{animationDelay: "300ms"}}></div>
                     <div className="w-1 bg-indigo-600 h-2.5 animate-bounce" style={{animationDelay: "450ms"}}></div>
                   </div>
                   <span className="text-[10px] font-mono text-indigo-600 font-semibold animate-pulse">Synthesizing chunk...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-slate-200 bg-white">
        <form onSubmit={handleSubmit} className="relative flex items-center w-full">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isGenerating}
            placeholder="Type a prompt for streaming synthesis..."
            className="w-full bg-slate-50 border border-slate-200 rounded-full py-4 px-6 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all pr-16 text-slate-800 placeholder:text-slate-400 disabled:opacity-50"
          />
          <div className="absolute right-2">
            {isGenerating ? (
              <button
                type="button"
                onClick={handleStop}
                className="p-3 bg-red-600 rounded-full hover:bg-red-500 transition-colors text-white shadow-sm"
                title="Stop generation"
              >
                <Square size={18} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-3 bg-indigo-600 rounded-full hover:bg-indigo-500 transition-colors text-white disabled:opacity-50 disabled:hover:bg-indigo-600 shadow-sm"
              >
                <Send size={18} />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
