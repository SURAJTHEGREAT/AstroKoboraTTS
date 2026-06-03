import { useState } from "react";

import React from "react";

export default function ApiClients() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [generatedClient, setGeneratedClient] = useState<{ client_id: string; client_secret: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setGeneratedClient(null);

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
          clientName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create API Client");
      }

      setSuccessMessage(data.message);
      setGeneratedClient(data.client);
      setClientName(""); // Reset client name for next use
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full items-center p-8 bg-slate-50 overflow-y-auto w-full">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-slate-800">Generate API Client</h2>
          <p className="text-sm text-slate-500 mt-1">
            Create new credentials to authenticate API calls when in API-only mode.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Client Name</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="My External App"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate Client"}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        {successMessage && generatedClient && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md shadow-inner">
            <h3 className="text-green-800 font-semibold mb-2">{successMessage}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-green-700 uppercase tracking-wider mb-1">Client ID</label>
                <div className="bg-white px-3 py-2 border border-green-200 rounded font-mono text-sm break-all text-slate-800 select-all">
                  {generatedClient.client_id}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-green-700 uppercase tracking-wider mb-1">Client Secret</label>
                <div className="bg-white px-3 py-2 border border-green-200 rounded font-mono text-sm break-all text-slate-800 select-all">
                  {generatedClient.client_secret}
                </div>
                <p className="text-xs text-green-600 mt-1">Please copy this secret now. It will not be shown again.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
