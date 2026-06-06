import React, { useState } from "react";
import { Sliders, Lock, ShieldCheck, Loader2, Sparkles } from "lucide-react";

const AVAILABLE_VOICES = [
  { id: "af_heart", name: "Heart (F)", region: "US" },
  { id: "af_bella", name: "Bella (F)", region: "US" },
  { id: "af_sarah", name: "Sarah (F)", region: "US" },
  { id: "af_nicole", name: "Nicole (F)", region: "US" },
  { id: "af_nova", name: "Nova (F)", region: "US" },
  { id: "af_sky", name: "Sky (F)", region: "US" },
  { id: "am_adam", name: "Adam (M)", region: "US" },
  { id: "am_michael", name: "Michael (M)", region: "US" },
  { id: "am_echo", name: "Echo (M)", region: "US" },
  { id: "am_onyx", name: "Onyx (M)", region: "US" },
  { id: "bf_emma", name: "Emma (F)", region: "UK" },
  { id: "bf_isabella", name: "Isabella (F)", region: "UK" },
  { id: "bf_alice", name: "Alice (F)", region: "UK" },
  { id: "bm_george", name: "George (M)", region: "UK" },
  { id: "bm_lewis", name: "Lewis (M)", region: "UK" },
  { id: "bm_daniel", name: "Daniel (M)", region: "UK" },
];

export default function Blending() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [voiceName, setVoiceName] = useState("");
  const [voiceA, setVoiceA] = useState("af_heart");
  const [voiceB, setVoiceB] = useState("am_adam");
  const [ratio, setRatio] = useState(0.5);

  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "admin" && password === "password") {
      setIsAuthenticated(true);
      setLoginError("");
    } else {
      setLoginError("Invalid admin credentials");
    }
  };

  const handleBlend = async () => {
    if (!voiceName.trim()) {
      setStatus("error");
      setMessage("Please provide a name for the new voice.");
      return;
    }

    setIsProcessing(true);
    setStatus("idle");

    try {
      const response = await fetch("/api/blend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          voiceName: voiceName.trim(),
          voiceA,
          voiceB,
          ratio,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(data.message || "Voice blended successfully!");
        setVoiceName("");
      } else {
        setStatus("error");
        setMessage(data.detail || data.error || "Failed to blend voices");
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Network error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-lg border border-slate-200 shadow-lg">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
            <Lock className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 mb-2">
            Admin Access Required
          </h2>
          <p className="text-slate-600 text-sm mt-2 text-center">
            Sign in to access voice blending tools.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 text-sm placeholder:text-slate-400 transition-all"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 text-sm placeholder:text-slate-400 transition-all"
              placeholder="••••••••"
            />
          </div>

          {loginError && <p className="text-red-500 text-sm font-medium">{loginError}</p>}

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white text-[10px] uppercase font-bold tracking-widest py-3 rounded hover:bg-indigo-700 transition-colors mt-2 shadow-xs"
          >
            Authorize Access
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-lg border border-slate-200 shadow-md">
      <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-100">
        <Sliders className="w-8 h-8 text-indigo-600" />
        <div>
          <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-700 mb-1">Voice Blending Studio</h2>
          <p className="text-slate-500 text-sm">Combine two voices to create a unique hybrid speaker profile.</p>
        </div>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-[10px] uppercase tracking-[0.15em] font-bold text-slate-500">Base Voice A</label>
            <select
              value={voiceA}
              onChange={(e) => setVoiceA(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all"
            >
              {AVAILABLE_VOICES.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 font-medium">Primarily influenced when ratio is low.</p>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] uppercase tracking-[0.15em] font-bold text-slate-500">Base Voice B</label>
            <select
              value={voiceB}
              onChange={(e) => setVoiceB(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all"
            >
              {AVAILABLE_VOICES.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 font-medium">Primarily influenced when ratio is high.</p>
          </div>
        </div>

        <div className="space-y-4 bg-slate-50 rounded-lg p-6 border border-slate-200">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-[10px] uppercase tracking-[0.15em] font-bold text-slate-500">Blend Ratio</label>
            <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              {(ratio * 100).toFixed(0)}% Voice B
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={ratio}
            onChange={(e) => setRatio(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div className="flex justify-between text-[9px] uppercase font-bold tracking-tighter text-slate-400">
            <span>100% Voice A</span>
            <span>Balanced Blend</span>
            <span>100% Voice B</span>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <label htmlFor="custom-voice-name" className="block text-[10px] uppercase tracking-[0.15em] font-bold text-slate-500 mb-2">
            New Voice Name
          </label>
          <div className="flex gap-3">
            <input
              id="custom-voice-name"
              type="text"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              disabled={isProcessing}
              placeholder="e.g., Mystic Hybrid"
              className="flex-1 bg-white border border-slate-200 rounded px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all placeholder:text-slate-400 shadow-sm"
            />
            <button
              onClick={handleBlend}
              disabled={isProcessing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded text-[10px] uppercase tracking-[0.1em] font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-md active:scale-95"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  CREATING...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  CREATE BLEND
                </>
              )}
            </button>
          </div>
        </div>

        {status === "success" && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-center justify-center text-sm font-medium animate-in fade-in slide-in-from-top-1">
            {message}
          </div>
        )}

        {status === "error" && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex flex-col items-center justify-center text-sm animate-in fade-in slide-in-from-top-1">
            <span className="font-bold text-[10px] uppercase tracking-widest mb-1">Error</span>
            <span className="text-red-750 text-center">{message}</span>
          </div>
        )}
      </div>

      <div className="mt-10 bg-slate-50 rounded-lg p-5 border border-slate-200">
        <h4 className="text-[10px] font-bold text-slate-500 mb-3 uppercase tracking-[0.2em]">How it works</h4>
        <p className="text-xs text-slate-600 leading-relaxed">
          Voice blending performs a mathematical interpolation between two speaker embeddings.
          A ratio of <strong>0%</strong> creates a voice identical to <strong>Voice A</strong>, while
          <strong>100%</strong> matches <strong>Voice B</strong>. Values in between create unique
          hybrid characteristics, allowing for fine-tuned control over tone and personality.
        </p>
      </div>
    </div>
  );
}
