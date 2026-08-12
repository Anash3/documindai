'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, UploadCloud, MessageSquare, ShieldCheck, Sparkles, BookOpen, 
  Layers, Cpu, CheckCircle2, AlertCircle, Zap, Database, ArrowRight, 
  Trash2, RefreshCw, CheckSquare, Square, CornerDownLeft, ChevronRight
} from 'lucide-react';

import { api, DocumentItem, MessageItem, VectorDBStatus } from '@/lib/api';

export default function Home() {
  // Step state: 1 = Upload, 2 = Select & Vector DB, 3 = Chat Studio
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBuildingVectorDB, setIsBuildingVectorDB] = useState(false);
  const [vectorDBStatus, setVectorDBStatus] = useState<VectorDBStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
        setErrorMsg('Authentication failed. Please check your email and password.');
      }
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await api.get('/documents');
      const docs: DocumentItem[] = res.data.documents || [];
      setDocuments(docs);
      
      // Auto-select ready documents if none selected yet
      if (selectedDocIds.length === 0 && docs.length > 0) {
        const readyIds = docs.filter(d => d.status === 'ready').map(d => d.id);
        setSelectedDocIds(readyIds);
      }
    } catch (err) {
      console.error('Failed to load documents', err);
    }
  };

  const uploadFileObject = async (file: File) => {
    setIsUploading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setTimeout(() => {
        fetchDocuments();
        setActiveStep(2); // Automatically advance to Step 2
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to upload document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFileObject(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFileObject(e.dataTransfer.files[0]);
    }
  };

  const toggleDocSelection = (id: string) => {
    setSelectedDocIds(prev => 
      prev.includes(id) ? prev.filter(docId => docId !== id) : [...prev, id]
    );
    setVectorDBStatus(null); // Prompt rebuild when selection changes
  };

  const selectAllReadyDocs = () => {
    const readyIds = documents.filter(d => d.status === 'ready').map(d => d.id);
    setSelectedDocIds(readyIds);
    setVectorDBStatus(null);
  };

  const deselectAllDocs = () => {
    setSelectedDocIds([]);
    setVectorDBStatus(null);
  };

  const handleDeleteDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/documents/${id}`);
      setSelectedDocIds(prev => prev.filter(docId => docId !== id));
      fetchDocuments();
    } catch (err) {
      console.error('Failed to delete document', err);
    }
  };

  const handleBuildVectorDB = async () => {
    if (selectedDocIds.length === 0) {
      setErrorMsg('Please select at least one document to create a Vector Database.');
      return;
    }

    setIsBuildingVectorDB(true);
    setErrorMsg(null);

    try {
      const res = await api.post('/documents/build-vector-db', {
        document_ids: selectedDocIds
      });
      setVectorDBStatus(res.data);
      setActiveStep(3); // Advance to Chat Studio step
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to create Vector Database index.');
    } finally {
      setIsBuildingVectorDB(false);
    }
  };

  const handleSendMessage = async (queryOverride?: string) => {
    const queryToSend = queryOverride || inputQuery;
    if (!queryToSend.trim() || isGenerating) return;

    setInputQuery('');
    setIsGenerating(true);

    const tempUserMsg: MessageItem = {
      id: Date.now().toString(),
      sender: 'user',
      content: queryToSend,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await api.post('/chat', {
        message: queryToSend,
        conversation_id: activeConvId,
        document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined
      });

      if (!activeConvId) {
        setActiveConvId(res.data.conversation_id);
      }
      setMessages(prev => [...prev, res.data.message]);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to generate response. Ensure OPENAI_API_KEY is set on backend.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Glassmorphic Top Navbar */}
      <header className="h-16 border-b border-slate-800/80 glass-panel flex items-center justify-between px-6 z-20 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-400 bg-clip-text text-transparent">
              DocuMind AI
            </h1>
            <p className="text-[11px] text-slate-400">OpenAI Vector DB & Document Chatbot</p>
          </div>
        </div>

        {/* Wizard Step Navigation */}
        {isAuthenticated && (
          <div className="hidden md:flex items-center bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveStep(1)}
              className={`px-4 py-1.5 rounded-xl font-medium transition flex items-center gap-2 ${
                activeStep === 1
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" /> 1. Upload Files
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <button
              onClick={() => setActiveStep(2)}
              className={`px-4 py-1.5 rounded-xl font-medium transition flex items-center gap-2 ${
                activeStep === 2
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" /> 2. Vector DB ({selectedDocIds.length})
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <button
              onClick={() => setActiveStep(3)}
              className={`px-4 py-1.5 rounded-xl font-medium transition flex items-center gap-2 ${
                activeStep === 3
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" /> 3. Chat Studio
            </button>
          </div>
        )}

        {/* User Auth Info */}
        {isAuthenticated ? (
          <div className="flex items-center space-x-3">
            <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Connected
            </span>
            <button
              onClick={() => {
                localStorage.removeItem('documind_token');
                setIsAuthenticated(false);
              }}
              className="text-xs text-slate-400 hover:text-red-400 transition"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <span className="text-xs text-amber-400 font-medium">Authentication Required</span>
        )}
      </header>

      {/* Main Container */}
      {!isAuthenticated ? (
        <div className="flex-1 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950">
          <div className="max-w-md w-full glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl">
            <div className="text-center mb-6">
              <div className="inline-flex p-4 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 mb-3 text-indigo-400 shadow-inner">
                <Sparkles className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Welcome to DocuMind AI</h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Upload PDF & DOCX documents, generate embeddings via OpenAI SDK, and chat with an intelligent RAG AI assistant.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-800 text-sm focus:outline-none focus:border-indigo-500 transition text-slate-100 placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-800 text-sm focus:outline-none focus:border-indigo-500 transition text-slate-100 placeholder-slate-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                Sign In / Create Account <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Step 1 Upload & Step 2 Select List */}
          <aside className="w-96 border-r border-slate-800/80 bg-slate-900/40 flex flex-col shrink-0">
            {/* Step 1: Upload Zone */}
            <div className="p-4 border-b border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4" /> Step 1: Upload Files
                </span>
                <span className="text-[10px] text-slate-500">PDF / DOCX (25MB)</span>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-5 text-center transition cursor-pointer flex flex-col items-center justify-center ${
                  isDragging
                    ? 'border-indigo-400 bg-indigo-500/10'
                    : 'border-slate-800 bg-slate-950/50 hover:border-indigo-500/50 hover:bg-slate-900/60'
                }`}
              >
                <input type="file" accept=".pdf,.docx,.doc" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 mb-2">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-slate-200">
                  {isUploading ? 'Uploading & Parsing Document...' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Extracts text, headings & page numbers automatically</p>
              </div>
            </div>

            {/* Step 2: Document Selection & Vector DB Trigger */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" /> Step 2: Select Documents
                </span>
                <div className="flex items-center space-x-2 text-[11px]">
                  <button onClick={selectAllReadyDocs} className="text-indigo-400 hover:underline">All</button>
                  <span className="text-slate-600">•</span>
                  <button onClick={deselectAllDocs} className="text-slate-400 hover:underline">None</button>
                </div>
              </div>

              {/* Document List */}
              {documents.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs glass-panel rounded-2xl p-4 border border-slate-800">
                  No documents uploaded yet. Drag & drop a PDF or DOCX file above.
                </div>
              ) : (
                documents.map((doc) => {
                  const isSelected = selectedDocIds.includes(doc.id);
                  return (
                    <div
                      key={doc.id}
                      onClick={() => toggleDocSelection(doc.id)}
                      className={`p-3.5 rounded-2xl cursor-pointer border text-xs transition flex items-start gap-3 relative group ${
                        isSelected
                          ? 'bg-indigo-950/50 border-indigo-500/70 text-indigo-100 shadow-lg shadow-indigo-950/40'
                          : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleDocSelection(doc.id); }}
                        className="mt-0.5 text-slate-400 hover:text-indigo-400"
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold truncate pr-4 text-slate-200">{doc.filename}</p>
                          <button
                            onClick={(e) => handleDeleteDocument(doc.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition rounded"
                            title="Delete document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                          <span className="uppercase font-mono font-medium">{doc.file_type} • {(doc.file_size / 1024).toFixed(0)} KB</span>
                          <span className={`px-2 py-0.5 rounded-full font-medium ${
                            doc.status === 'ready' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50' :
                            doc.status === 'processing' ? 'bg-amber-950 text-amber-300 border border-amber-800/50' : 'bg-red-950 text-red-300 border border-red-800/50'
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

            {/* Vector DB Action Container */}
            <div className="p-4 border-t border-slate-800/80 glass-panel">
              <button
                onClick={handleBuildVectorDB}
                disabled={selectedDocIds.length === 0 || isBuildingVectorDB}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-40 text-white text-xs font-bold shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition"
              >
                <Cpu className="w-4 h-4" />
                {isBuildingVectorDB ? 'Generating Vector Index...' : `⚡ Create Vector DB (${selectedDocIds.length} Selected)`}
              </button>
            </div>
          </aside>

          {/* Right Main Panel - Step 3: Interactive Vector DB Studio & Chatbot */}
          <main className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
            {/* Step 3 Top Vector DB Status Banner */}
            <div className="border-b border-slate-800/80 glass-panel p-4 px-6 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    Step 3: Vector Chatbot Studio
                    {vectorDBStatus && (
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/50 flex items-center gap-1 font-normal">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Active Index
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {selectedDocIds.length > 0
                      ? `Connected to ${selectedDocIds.length} selected document(s)`
                      : 'Select documents in Step 2 to generate vector context'}
                  </p>
                </div>
              </div>

              {vectorDBStatus && (
                <div className="hidden lg:flex items-center space-x-3 text-[11px] font-mono">
                  <div className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
                    Embeddings: <span className="text-indigo-400 font-semibold">{vectorDBStatus.vector_model}</span>
                  </div>
                  <div className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
                    Chunks: <span className="text-indigo-400 font-semibold">{vectorDBStatus.total_chunks}</span>
                  </div>
                  <div className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
                    Dim: <span className="text-indigo-400 font-semibold">{vectorDBStatus.vector_dimensions}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="m-4 p-3.5 rounded-2xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
                <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto py-12">
                  <div className="p-5 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-5 shadow-2xl">
                    <Zap className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-100 tracking-tight">Interactive RAG AI Studio</h3>
                  <p className="text-xs text-slate-400 mt-2.5 leading-relaxed max-w-md">
                    Ask questions against your document vector database. OpenAI SDK retrieves semantic chunks and generates precise answers with source citations.
                  </p>

                  {/* Suggested Prompts */}
                  <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-md">
                    {[
                      "Summarize the key points of the selected documents",
                      "Extract all dates, figures, and important metrics",
                      "What are the main requirements or conclusions?",
                      "Compare sections across the uploaded documents"
                    ].map((promptText, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(promptText)}
                        className="p-3 rounded-2xl glass-panel text-left text-xs text-slate-300 hover:text-indigo-300 hover:border-indigo-500/50 transition flex items-center justify-between group"
                      >
                        <span className="truncate">{promptText}</span>
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition text-indigo-400 shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-3xl rounded-3xl p-5 text-sm leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none shadow-xl shadow-indigo-600/20'
                          : 'glass-panel text-slate-100 rounded-bl-none border border-slate-800'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Source Citations */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-2.5">
                          <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Vector Retrieval Citations ({msg.sources.length})
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {msg.sources.map((src, i) => (
                              <div key={i} className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs hover:border-indigo-500/40 transition">
                                <div className="flex items-center justify-between text-slate-200 font-semibold mb-1">
                                  <span className="truncate pr-2">{src.filename}</span>
                                  {src.page_number && (
                                    <span className="text-[10px] text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded-full border border-indigo-800/50 font-mono">
                                      Page {src.page_number}
                                    </span>
                                  )}
                                </div>
                                {src.section_title && (
                                  <p className="text-[10px] text-purple-300 font-medium truncate mb-1">Section: {src.section_title}</p>
                                )}
                                <p className="text-[11px] text-slate-400 italic leading-snug line-clamp-3">"{src.snippet}"</p>
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
                <div className="flex items-center space-x-3 text-indigo-400 text-xs p-4 glass-panel rounded-2xl max-w-md animate-pulse">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Searching OpenAI vector embeddings & generating response...</span>
                </div>
              )}
            </div>

            {/* Chatbot Input Bar */}
            <div className="p-4 border-t border-slate-800/80 glass-panel shrink-0">
              <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="max-w-4xl mx-auto flex gap-3">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder={
                    selectedDocIds.length > 0
                      ? `Ask questions across ${selectedDocIds.length} selected vector document(s)...`
                      : 'Upload and select documents in Step 1 & 2 to start chatting...'
                  }
                  className="flex-1 px-5 py-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-sm focus:outline-none focus:border-indigo-500 text-slate-100 placeholder-slate-500 shadow-inner"
                />
                <button
                  type="submit"
                  disabled={isGenerating || !inputQuery.trim()}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-40 text-white font-semibold text-sm transition shadow-xl shadow-indigo-600/25 flex items-center gap-2 shrink-0"
                >
                  <MessageSquare className="w-4 h-4" /> Send <CornerDownLeft className="w-3.5 h-3.5 opacity-60" />
                </button>
              </form>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
