import React, { useState, useEffect } from "react";
import { History as HistoryIcon, Download, Calendar, Volume2, Search, Trash2, Clock, Sparkles } from "lucide-react";

type HistoryItem = {
  id: number;
  text: string;
  voice: string;
  created_at: string;
};

export default function History() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchHistory();
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

  const filteredHistory = history.filter(item =>
    item.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.voice.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Last 100 synthesis requests</p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search history..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-64 text-slate-700"
            />
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
        ) : filteredHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
              <HistoryIcon size={32} className="text-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-slate-700">No conversions found</p>
              <p className="text-sm text-slate-500">Your synthesis history will appear here once you start using the chat.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Text Content</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Voice Used</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date & Time</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="max-w-md">
                        <p className="text-sm text-slate-700 line-clamp-2 leading-relaxed">
                          {item.text}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center text-indigo-500">
                          <Volume2 size={12} />
                        </div>
                        <span className="text-xs font-semibold text-slate-600">{item.voice}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Clock size={12} />
                        <span className="text-xs font-medium">{formatDate(item.created_at)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a
                        href={`/api/history/download/${item.id}`}
                        download
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-wider rounded transition-all shadow-xs"
                      >
                        <Download size={12} />
                        Download WAV
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
