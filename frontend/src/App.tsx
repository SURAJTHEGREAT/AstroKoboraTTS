import { Routes, Route, Link } from "react-router";
import { useState } from "react";
import { v4 as uuidv4 } from 'uuid';
import { Plus } from "lucide-react";
import Chat from "./components/Chat";
import Blending from "./components/Blending";
import ApiClients from "./components/ApiClients";
import Analytics from "./components/Analytics";
import History from "./components/History";
import LiveMetrics from "./components/LiveMetrics";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  voice?: string;
  status?: "generating" | "finished" | "interrupted";
  audioUrl?: string;
  isSaved?: boolean;
  ramMetrics?: { chunk: string; ramUsageMb: number }[];
  totalWords?: number;
};

export default function App() {
  const [sessionId, setSessionId] = useState(() => uuidv4());
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");

  const handleClearChat = () => {
    setMessages([]);
    setSessionId(uuidv4());
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-800 font-sans">
      <header className="h-16 flex items-center justify-between px-8 border-b border-slate-200 bg-white shadow-sm">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-8 bg-indigo-600 rounded-sm flex items-center justify-center font-bold text-white">AN</div>
          <span className="text-lg font-semibold tracking-tight text-slate-900">AstroNeuralVoice <span className="text-indigo-600 font-mono text-xs ml-2">v1.0-ONNX</span></span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] uppercase font-bold text-green-700 tracking-wider">CPU Engine Active</span>
          </div>
          <Link to="/history" className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-widest rounded transition-all shadow-sm border border-slate-200">
            History
          </Link>
          <Link to="/live-metrics" className="px-5 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-bold uppercase tracking-widest rounded transition-all shadow-sm border border-blue-200">
            Live Metrics
          </Link>
          <Link to="/analytics" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-widest rounded transition-all shadow-sm">
            Analytics
          </Link>
          <Link to="/clients" className="px-5 py-2 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-widest rounded transition-all shadow-sm">
            API Clients
          </Link>
          <Link to="/blend" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-widest rounded transition-all shadow-sm">
            Blend Voices
          </Link>
          <button
            onClick={handleClearChat}
            title="Start new chat"
            className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-all shadow-sm border border-slate-200 ml-2"
          >
            <Plus size={18} />
          </button>
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        <Routes>
          <Route path="/" element={<Chat sessionId={sessionId} messages={messages} setMessages={setMessages} input={chatInput} setInput={setChatInput} />} />
          <Route path="/history" element={<History />} />
          <Route path="/live-metrics" element={<LiveMetrics messages={messages} />} />
          <Route path="/blend" element={<Blending />} />
          <Route path="/clients" element={<ApiClients />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </main>
    </div>
  );
}
