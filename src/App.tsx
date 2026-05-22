import { Routes, Route, Link } from "react-router";
import Chat from "./components/Chat";
import Training from "./components/Training";
import ApiClients from "./components/ApiClients";

export default function App() {
  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-800 font-sans">
      <header className="h-16 flex items-center justify-between px-8 border-b border-slate-200 bg-white shadow-sm">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-indigo-600 rounded-sm flex items-center justify-center font-bold text-white">N</div>
          <span className="text-lg font-semibold tracking-tight uppercase text-slate-900">Neural Voice <span className="text-indigo-600 font-mono text-xs ml-2">v1.0-ONNX</span></span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] uppercase font-bold text-green-700 tracking-wider">CPU Engine Active</span>
          </div>
          <Link to="/clients" className="px-5 py-2 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-widest rounded transition-all shadow-sm">
            API Clients
          </Link>
          <Link to="/train" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-widest rounded transition-all shadow-sm">
            Train Voice
          </Link>
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        <Routes>
          <Route path="/" element={<Chat />} />
          <Route path="/train" element={<Training />} />
          <Route path="/clients" element={<ApiClients />} />
        </Routes>
      </main>
    </div>
  );
}
