import React, { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface AnalyticsData {
  client_name: string;
  total_files_generated: number;
  total_words_processed: number;
  avg_ttfb_ms: number;
}

export default function Analytics() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData[]>([]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to authenticate or fetch data");
      }

      setData(result);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 bg-slate-50 overflow-y-auto w-full">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-slate-800">Admin Analytics</h2>
            <p className="text-sm text-slate-500 mt-1">
              Please authenticate to view API client statistics.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Admin Username</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Admin Password</label>
              <input
                type="password"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "View Analytics"}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full items-center p-8 bg-slate-50 overflow-y-auto w-full">
      <div className="max-w-4xl w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 mb-8">
        <h2 className="text-2xl font-semibold text-slate-800 mb-6">API Client Analytics</h2>

        {data.length === 0 ? (
          <p className="text-slate-500">No API clients found.</p>
        ) : (
          <div className="space-y-8">
            <div className="w-full h-80">
              <h3 className="text-lg font-medium text-slate-700 mb-4 text-center">Total Audio Files Generated</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="client_name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total_files_generated" name="Total Files Generated" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="w-full h-80">
              <h3 className="text-lg font-medium text-slate-700 mb-4 text-center">Number of Words Processed</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="client_name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total_words_processed" name="Total Words Processed" fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="w-full h-80">
              <h3 className="text-lg font-medium text-slate-700 mb-4 text-center">Average Time to First Byte (ms)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="client_name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avg_ttfb_ms" name="Average TTFB (ms)" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
