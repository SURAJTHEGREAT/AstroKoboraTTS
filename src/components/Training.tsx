import React, { useState, useRef } from "react";
import { Upload, Lock, ShieldCheck, Loader2 } from "lucide-react";

export default function Training() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "admin" && password === "password") {
      setIsAuthenticated(true);
      setLoginError("");
    } else {
      setLoginError("Invalid admin credentials");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "audio/wav") {
        setUploadStatus("error");
        setUploadMessage("Please upload a .wav audio file.");
        return;
      }
      setFile(selectedFile);
      setUploadStatus("idle");
      setUploadMessage("");
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus("idle");
    
    const formData = new FormData();
    formData.append("sample", file);
    formData.append("username", username);
    formData.append("password", password);

    try {
      const response = await fetch("/api/train", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadStatus("success");
        setUploadMessage(data.message || "Voice embedding generated successfully!");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setUploadStatus("error");
        setUploadMessage(data.error || "Failed to generate embedding");
      }
    } catch (err: any) {
      setUploadStatus("error");
      setUploadMessage(err.message || "Network error occurred");
    } finally {
      setIsUploading(false);
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
            Sign in to access voice embedding training.
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
            Authorize Training
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-lg border border-slate-200 shadow-md">
      <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-100">
        <ShieldCheck className="w-8 h-8 text-indigo-600" />
        <div>
          <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-700 mb-1">Voice Embedding Training</h2>
          <p className="text-slate-500 text-sm">Upload a clean audio sample to clone a new speaker profile.</p>
        </div>
      </div>

      <div className="space-y-6">
        <div 
          className="border border-dashed border-slate-200 rounded-lg p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50/50 transition-colors bg-slate-50/20"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-10 h-10 text-slate-400 mb-4" />
          <h3 className="text-sm font-medium text-slate-700 mb-1">Upload Sample Audio</h3>
          <p className="text-slate-500 text-xs max-w-sm mb-4">
            Upload a clear, noise-free .wav file (10-30 seconds recommended).
          </p>
          <button className="bg-white text-slate-700 px-4 py-2 rounded text-[10px] uppercase tracking-wider font-bold border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-xs">
            Select File
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="audio/wav" 
            className="hidden" 
          />
        </div>

        {file && (
          <div className="bg-slate-50 rounded-lg p-4 flex items-center justify-between border border-slate-200 shadow-xs">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-700 truncate max-w-[200px] sm:max-w-xs">{file.name}</span>
              <span className="text-xs text-slate-500 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <button 
              onClick={handleUpload}
              disabled={isUploading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded text-[10px] uppercase tracking-[0.1em] font-bold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-xs"
            >
              {isUploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  PROCESSING...
                </>
              ) : (
                "TRAIN VOICE"
              )}
            </button>
          </div>
        )}

        {uploadStatus === "success" && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-center justify-center text-sm font-medium">
            {uploadMessage}
          </div>
        )}

        {uploadStatus === "error" && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex flex-col items-center justify-center text-sm">
            <span className="font-bold text-[10px] uppercase tracking-widest mb-1">Error</span>
            <span className="text-red-750">{uploadMessage}</span>
          </div>
        )}
      </div>
      
      <div className="mt-8 bg-slate-50 rounded-lg p-5 border border-slate-200">
        <h4 className="text-[10px] font-bold text-slate-500 mb-3 uppercase tracking-[0.2em]">Instructions</h4>
        <ul className="text-sm text-slate-600 space-y-2 list-disc list-inside">
          <li>Ensure audio is recorded in a quiet environment.</li>
          <li>Speak clearly at a normal conversational pace.</li>
          <li>Avoid background noise, music, or other voices.</li>
          <li>The output embedding will be available in your voice selector.</li>
        </ul>
      </div>
    </div>
  );
}
