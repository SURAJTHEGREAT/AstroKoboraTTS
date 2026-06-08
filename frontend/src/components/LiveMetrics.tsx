import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Label } from 'recharts';
import { ArrowLeft, Activity } from 'lucide-react';

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

interface LiveMetricsProps {
  messages: Message[];
}

export default function LiveMetrics({ messages }: LiveMetricsProps) {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const assistantMessages = messages.filter(m => m.role === 'assistant' && m.ramMetrics && m.ramMetrics.length > 0);

  const avgRamData = assistantMessages.map((msg, index) => {
    const avgRam = msg.ramMetrics!.reduce((acc, curr) => acc + curr.ramUsageMb, 0) / msg.ramMetrics!.length;
    return {
      id: msg.id,
      name: `Msg ${index + 1}`,
      avgRam: Math.round(avgRam * 10) / 10,
      totalWords: msg.totalWords || 0,
      contentPreview: msg.content.substring(0, 30) + '...'
    };
  });

  const selectedMessage = messages.find(m => m.id === selectedMessageId);

  const CustomTooltipMain = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 p-3 rounded shadow-md text-xs">
          <p className="font-bold text-slate-800 mb-1">{label}</p>
          <p className="text-slate-600">Avg RAM: <span className="font-semibold text-indigo-600">{payload[0].value} MB</span></p>
          <p className="text-slate-600">Words: <span className="font-semibold text-slate-800">{payload[0].payload.totalWords}</span></p>
          <p className="text-slate-500 italic mt-1 max-w-[200px] truncate">{payload[0].payload.contentPreview}</p>
        </div>
      );
    }
    return null;
  };

  const CustomTooltipDetail = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 p-3 rounded shadow-md text-xs">
          <p className="font-bold text-slate-800 mb-1">Chunk: {label}</p>
          <p className="text-slate-600">RAM Usage: <span className="font-semibold text-indigo-600">{payload[0].value} MB</span></p>
          <p className="text-slate-500 italic mt-1 max-w-[200px]">"{payload[0].payload.chunk}"</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
            <Activity size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Live Metrics</h1>
            <p className="text-sm text-slate-500">Real-time memory profiling for the active session.</p>
          </div>
        </div>

        {assistantMessages.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">No Data Available</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Generate some TTS audio in the Chat tab first to see live memory metrics for this session.
            </p>
          </div>
        ) : !selectedMessageId ? (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center justify-between">
              Average RAM Usage per Message
              <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded">Click a bar for details</span>
            </h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={avgRamData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          onClick={(data) => {
                            if (data && data.activePayload && data.activePayload.length > 0) {
                              setSelectedMessageId(data.activePayload[0].payload.id);
                            }
                          }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} tickLine={false} axisLine={false} />
                  <YAxis tick={{fill: '#64748b', fontSize: 12}} tickLine={false} axisLine={false}>
                     <Label value="Avg RAM (MB)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#64748b', fontSize: 12 }} />
                  </YAxis>
                  <Tooltip content={<CustomTooltipMain />} cursor={{fill: '#f1f5f9'}} />
                  <Bar dataKey="avgRam" fill="#4f46e5" radius={[4, 4, 0, 0]} className="cursor-pointer hover:opacity-80 transition-opacity" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <button
              onClick={() => setSelectedMessageId(null)}
              className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm w-fit"
            >
              <ArrowLeft size={16} /> Back to Overview
            </button>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="mb-6">
                 <h3 className="text-lg font-semibold text-slate-800">Detailed RAM Usage (Chunk Level)</h3>
                 <p className="text-sm text-slate-500 mt-1">Memory allocation during generation for this specific message.</p>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedMessage?.ramMetrics?.map((m, i) => ({ ...m, index: i + 1 })) || []}
                             margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="index" tick={{fill: '#64748b', fontSize: 12}} tickLine={false} axisLine={false}>
                       <Label value="Chunk Sequence" position="insideBottom" offset={-5} style={{ fill: '#64748b', fontSize: 12 }} />
                    </XAxis>
                    <YAxis tick={{fill: '#64748b', fontSize: 12}} tickLine={false} axisLine={false}>
                       <Label value="RAM (MB)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#64748b', fontSize: 12 }} />
                    </YAxis>
                    <Tooltip content={<CustomTooltipDetail />} />
                    <Line type="monotone" dataKey="ramUsageMb" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
