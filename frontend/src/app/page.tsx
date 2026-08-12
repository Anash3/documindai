'use client';

import { useState, useEffect } from 'react';
import { FileText, UploadCloud, MessageSquare, ShieldCheck, Sparkles, BookOpen, Layers, Cpu, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, DocumentItem, ConversationItem, MessageItem, VectorDBStatus } from '@/lib/api';

export default function Home() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBuildingVectorDB, setIsBuildingVectorDB] = useState(false);
  const [vectorDBStatus, setVectorDBStatus] = useState<VectorDBStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Authentication state
  const [token, setToken] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('documind_token');
    if (savedToken) {
      setToken(savedToken);
      setIsAuthenticated(true);
      fetchDocuments();
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setErrorMsg(null);
      const params = new URLSearchParams();
      params.append('username', authEmail);
      params.append('password', authPassword);
      
      const res = await api.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      const accessToken = res.data.access_token;
      localStorage.setItem('documind_token', accessToken);
      setToken(accessToken);
      setIsAuthenticated(true);
      fetchDocuments();
    } catch (err: any) {
      try {
        await api.post('/auth/register', { email: authEmail, password: authPassword });
        const params = new URLSearchParams();
        params.append('username', authEmail);
        params.append('password', authPassword);
        const res = await api.post('/auth/login', params, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const accessToken = res.data.access_token;
        localStorage.setItem('documind_token', accessToken);
        setToken(accessToken);
        setIsAuthenticated(true);
        fetchDocuments();
      } catch (regErr: any) {
        setErrorMsg('Authentication failed. Please check your credentials.');
      }
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await api.get('/documents');
      setDocuments(res.data.documents || []);
    } catch (err) {
      console.error('Failed to load documents', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', files[0]);

    try {
      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setTimeout(fetchDocuments, 1500);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to upload document.');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleDocSelection = (id: string) => {
    setSelectedDocIds(prev => {
      const updated = prev.includes(id) ? prev.filter(docId => docId !== id) : [...prev, id];
      setVectorDBStatus(null); // Reset vector DB status to prompt rebuilding for new selection
      return updated;
    });
  };

  const handleBuildVectorDB = async () => {
    if (selectedDocIds.length === 0) {
      setErrorMsg('Please select at least one document from the sidebar to build a Vector Database.');
      return;
    }

    setIsBuildingVectorDB(true);
    setErrorMsg(null);

    try {
      const res = await api.post('/documents/build-vector-db', {
        document_ids: selectedDocIds
      });
      setVectorDBStatus(res.data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to create Vector Database index.');
    } finally {
      setIsBuildingVectorDB(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isGenerating) return;

    const userMessage = inputQuery.trim();
    setInputQuery('');
    setIsGenerating(true);

    const tempUserMsg: MessageItem = {
      id: Date.now().toString(),
      sender: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await api.post('/chat', {
        message: userMessage,
        conversation_id: activeConvId,
        document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined
      });

      if (!activeConvId) {
        setActiveConvId(res.data.conversation_id);
      }
      setMessages(prev => [...prev, res.data.message]);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to generate response. Ensure OpenAI API key is set on backend.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      {/* Header Bar */}
      <header className="h-16 border-b border-slate-800 glass-panel flex items-center justify-between px-6 z-10">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
              DocuMind AI
            </h1>
            <p className="text-xs text-slate-400">OpenAI Vector DB & RAG Chatbot</p>
          </div>
        </div>

        {isAuthenticated ? (
          <div className="flex items-center space-x-4">
            <span className="text-xs px-3 py-1.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Authenticated
            </span>
            <button
              onClick={() => {
                localStorage.removeItem('documind_token');
                setIsAuthenticated(false);
              }}
              className="text-xs text-slate-400 hover:text-white transition"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <span className="text-xs text-amber-400 font-medium">Authentication Required</span>
        )}
      </header>

      {/* Main Content Area */}
      {!isAuthenticated ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full glass-panel p-8 rounded-2xl border border-slate-800 shadow-2xl">
            <div className="text-center mb-6">
              <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-3 text-indigo-400">
                <Sparkles className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Welcome to DocuMind AI</h2>
              <p className="text-sm text-slate-400 mt-1">Sign in to upload files, build vector databases, and launch RAG chatbots.</p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-red-300 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/30"
              >
                Sign In / Register
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Step 1 & 2 Sidebar: Upload & Select Files, Build Vector DB */}
          <aside className="w-80 border-r border-slate-800/80 bg-slate-900/50 flex flex-col">
            {/* Upload Button */}
            <div className="p-4 border-b border-slate-800/80 space-y-3">
              <label className="flex items-center justify-center w-full p-3 rounded-xl border border-dashed border-indigo-500/40 bg-indigo-500/5 hover:bg-indigo-500/10 cursor-pointer transition text-indigo-300 text-xs font-medium gap-2">
                <UploadCloud className="w-4 h-4" />
                {isUploading ? 'Uploading & Processing...' : '1. Upload PDF / DOCX Files'}
                <input type="file" accept=".pdf,.docx,.doc" onChange={handleFileUpload} className="hidden" />
              </label>

              {/* Build Vector DB Button */}
              <button
                onClick={handleBuildVectorDB}
                disabled={selectedDocIds.length === 0 || isBuildingVectorDB}
                className="w-full p-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition"
              >
                <Cpu className="w-4 h-4" />
                {isBuildingVectorDB
                  ? 'Indexing Vectors...'
                  : `2. Create Vector DB (${selectedDocIds.length} Selected)`}
              </button>
            </div>

            {/* Document Selection List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Select Files for Vector DB</span>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full">{documents.length}</span>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 text-[11px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {documents.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No documents uploaded yet. Upload a PDF or DOCX file to get started.
                </div>
              ) : (
                documents.map((doc) => {
                  const isSelected = selectedDocIds.includes(doc.id);
                  return (
                    <div
                      key={doc.id}
                      onClick={() => toggleDocSelection(doc.id)}
                      className={`p-3 rounded-xl cursor-pointer border text-xs transition flex items-start gap-3 ${
                        isSelected
                          ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200 shadow-md shadow-indigo-950'
                          : 'bg-slate-900/60 border-slate-800/60 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="mt-1 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.filename}</p>
                        <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                          <span className="capitalize">{doc.file_type} • {(doc.file_size / 1024).toFixed(0)} KB</span>
                          <span className={`px-1.5 py-0.5 rounded ${
                            doc.status === 'ready' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' :
                            doc.status === 'processing' ? 'bg-amber-950 text-amber-400 border border-amber-800/40' : 'bg-red-950 text-red-400'
                          }`}>
                            {doc.status}
                          </span>
                        </div>
                        {doc.error_message && (
                          <p className="mt-1 text-[10px] text-red-400 font-mono truncate" title={doc.error_message}>
                            ⚠️ {doc.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Step 3 Main Area: Vector DB Status Banner & Chatbot */}
          <main className="flex-1 flex flex-col bg-slate-950">
            {/* Active Vector DB Status Bar */}
            {vectorDBStatus && (
              <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border-b border-indigo-500/30 p-3 px-6 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-medium text-indigo-200">
                    Vector DB Active: <strong className="text-white">{vectorDBStatus.indexed_documents_count} Document(s)</strong> ({vectorDBStatus.total_chunks} Chunks Indexed)
                  </span>
                </div>
                <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                  <span className="bg-indigo-900/50 px-2 py-0.5 rounded border border-indigo-700/50 text-indigo-300 font-mono">
                    Model: {vectorDBStatus.vector_model} ({vectorDBStatus.vector_dimensions} Dim)
                  </span>
                </div>
              </div>
            )}

            {/* Chatbot Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
                  <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-200">DocuMind Vector Chatbot</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    1. Upload your PDF / DOCX files.<br />
                    2. Check the files you want to include and click <strong>Create Vector DB</strong>.<br />
                    3. Ask questions in the chatbot below to query the indexed vector database!
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-2xl rounded-2xl p-4 text-sm leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none shadow-lg shadow-indigo-600/20'
                          : 'glass-panel text-slate-200 rounded-bl-none border border-slate-800'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Source Citations */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                          <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Vector DB Context Sources
                          </p>
                          <div className="grid grid-cols-1 gap-2">
                            {msg.sources.map((src, i) => (
                              <div key={i} className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
                                <div className="flex items-center justify-between text-slate-300 font-medium">
                                  <span className="truncate">{src.filename}</span>
                                  {src.page_number && <span className="text-[10px] text-indigo-300 bg-indigo-950 px-1.5 py-0.5 rounded">Page {src.page_number}</span>}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1 italic font-sans">{src.snippet}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {isGenerating && (
                <div className="flex items-center space-x-2 text-indigo-400 text-xs animate-pulse">
                  <Sparkles className="w-4 h-4" />
                  <span>Searching active Vector DB & generating answer...</span>
                </div>
              )}
            </div>

            {/* Chatbot Input Bar */}
            <div className="p-4 border-t border-slate-800/80 glass-panel">
              <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder={
                    selectedDocIds.length > 0
                      ? `3. Ask chatbot across ${selectedDocIds.length} selected document(s)...`
                      : 'Upload and select documents above to start chatting...'
                  }
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-sm focus:outline-none focus:border-indigo-500 text-slate-100 placeholder-slate-500"
                />
                <button
                  type="submit"
                  disabled={isGenerating || !inputQuery.trim()}
                  className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" /> Ask Chatbot
                </button>
              </form>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
