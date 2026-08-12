'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, UploadCloud, MessageSquare, ShieldCheck, Sparkles, BookOpen, 
  Layers, Cpu, CheckCircle2, AlertCircle, Zap, Database, ArrowRight, 
  Trash2, RefreshCw, CheckSquare, Square, CornerDownLeft, ChevronRight,
  Plus, Check, Lock, ArrowLeft
} from 'lucide-react';
import { api, DocumentItem, MessageItem, VectorDBStatus } from '@/lib/api';

export default function Home() {
  // Wizard Active Step: 1 = Upload, 2 = Select & Create Vector DB, 3 = Chatbot Studio
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
      }, 1500);
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
    setVectorDBStatus(null);
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

  const handleRetryIngestion = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post(`/documents/${id}/retry`);
      setTimeout(fetchDocuments, 1500);
    } catch (err) {
      console.error('Failed to retry document', err);
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
      setActiveStep(3); // Smoothly transition to Chatbot Studio upon creation
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
      setErrorMsg(err.response?.data?.detail || 'Failed to generate response. Ensure OPENAI_API_KEY is configured on backend.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800/80 glass-panel flex items-center justify-between px-6 z-20 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-400 bg-clip-text text-transparent">
              DocuMind AI
            </h1>
            <p className="text-[11px] text-slate-400">OpenAI Vector DB & RAG Chatbot</p>
          </div>
        </div>

        {/* Step Indicator Header */}
        {isAuthenticated && (
          <div className="flex items-center bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveStep(1)}
              className={`px-4 py-1.5 rounded-xl font-medium transition flex items-center gap-2 ${
                activeStep === 1
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" /> Step 1: Upload ({documents.length})
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-slate-700 mx-1" />

            <button
              onClick={() => { if (documents.length > 0) setActiveStep(2); }}
              disabled={documents.length === 0}
              className={`px-4 py-1.5 rounded-xl font-medium transition flex items-center gap-2 ${
                activeStep === 2
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                  : documents.length > 0
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              <Database className="w-3.5 h-3.5" /> Step 2: Vector DB ({selectedDocIds.length})
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-slate-700 mx-1" />

            <button
              onClick={() => { if (vectorDBStatus) setActiveStep(3); }}
              disabled={!vectorDBStatus}
              className={`px-4 py-1.5 rounded-xl font-medium transition flex items-center gap-2 ${
                activeStep === 3
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                  : vectorDBStatus
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" /> Step 3: Chatbot Studio
            </button>
          </div>
        )}

        {/* User Auth */}
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

      {/* Main View Area */}
      {!isAuthenticated ? (
        <div className="flex-1 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950">
          <div className="max-w-md w-full glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl">
            <div className="text-center mb-6">
              <div className="inline-flex p-4 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 mb-3 text-indigo-400 shadow-inner">
                <Sparkles className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Welcome to DocuMind AI</h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Upload PDF & DOCX files, build vector database indexes with OpenAI SDK, and launch RAG AI Chatbots.
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
        <div className="flex-1 overflow-hidden bg-slate-950 flex flex-col">
          {/* STEP 1: UPLOAD HUB SCREEN */}
          {activeStep === 1 && (
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full flex flex-col justify-center">
              <div className="text-center mb-8">
                <span className="px-3 py-1 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 text-xs font-semibold uppercase tracking-wider">
                  Step 1 of 3
                </span>
                <h2 className="text-3xl font-extrabold text-white tracking-tight mt-3">Upload Your Documents</h2>
                <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
                  Upload PDF or DOCX documents to extract text, page numbers, and structural headings.
                </p>
              </div>

              {errorMsg && (
                <div className="mb-6 p-4 rounded-2xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                  <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-white">✕</button>
                </div>
              )}

              {/* Drag & Drop Card */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-3xl p-10 text-center transition cursor-pointer flex flex-col items-center justify-center ${
                  isDragging
                    ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
                    : 'border-slate-800 bg-slate-900/50 hover:border-indigo-500/50 hover:bg-slate-900/80'
                }`}
              >
                <input type="file" accept=".pdf,.docx,.doc" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                <div className="p-4 rounded-3xl bg-indigo-500/10 text-indigo-400 mb-3 shadow-inner">
                  <UploadCloud className="w-10 h-10" />
                </div>
                <h3 className="text-base font-bold text-slate-200">
                  {isUploading ? 'Parsing & Extracting Document...' : 'Click or Drag & Drop PDF / DOCX files'}
                </h3>
                <p className="text-xs text-slate-400 mt-1.5">Supports PDF and DOCX documents up to 25 MB</p>
              </div>

              {/* Uploaded Documents Preview List */}
              {documents.length > 0 && (
                <div className="mt-8 space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <span>Uploaded Files ({documents.length})</span>
                    <button onClick={fetchDocuments} className="text-indigo-400 hover:underline flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Refresh Status
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {documents.map((doc) => (
                      <div key={doc.id} className="p-4 rounded-2xl glass-panel border border-slate-800 flex items-center justify-between">
                        <div className="flex items-center space-x-3 min-w-0 pr-2">
                          <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-xs text-slate-200 truncate">{doc.filename}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {doc.file_type.toUpperCase()} • {(doc.file_size / 1024).toFixed(0)} KB
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${
                            doc.status === 'ready' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50' :
                            doc.status === 'processing' ? 'bg-amber-950 text-amber-300 border border-amber-800/50' : 'bg-red-950 text-red-300 border border-red-800/50'
                          }`}>
                            {doc.status}
                          </span>
                          {doc.status === 'failed' && (
                            <button
                              onClick={(e) => handleRetryIngestion(doc.id, e)}
                              className="p-1.5 rounded-lg bg-amber-950 text-amber-300 hover:bg-amber-900 text-xs"
                              title="Retry Ingestion"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => handleDeleteDocument(doc.id, e)}
                            className="p-1.5 text-slate-500 hover:text-red-400 transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Proceed to Step 2 Button */}
                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={() => setActiveStep(2)}
                      className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-xl shadow-indigo-600/30 flex items-center gap-2 transition"
                    >
                      Step 2: Select Files & Create Vector DB <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: SELECT & CREATE VECTOR DB SCREEN */}
          {activeStep === 2 && (
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full flex flex-col justify-center">
              <div className="text-center mb-8">
                <span className="px-3 py-1 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 text-xs font-semibold uppercase tracking-wider">
                  Step 2 of 3
                </span>
                <h2 className="text-3xl font-extrabold text-white tracking-tight mt-3">Configure Vector Database</h2>
                <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
                  Select which documents to include, generate embeddings via OpenAI SDK, and build the vector search index.
                </p>
              </div>

              {errorMsg && (
                <div className="mb-6 p-4 rounded-2xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                  <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-white">✕</button>
                </div>
              )}

              {/* Vector Configuration Card */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-200">Vector DB Index Settings</h3>
                      <p className="text-xs text-slate-400">OpenAI Embeddings Engine & Cosine Vector Store</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 text-xs">
                    <button onClick={selectAllReadyDocs} className="text-indigo-400 font-semibold hover:underline">Select All Ready</button>
                    <span className="text-slate-700">•</span>
                    <button onClick={deselectAllDocs} className="text-slate-400 hover:underline">Deselect All</button>
                  </div>
                </div>

                {/* Documents Selection Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {documents.map((doc) => {
                    const isSelected = selectedDocIds.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => toggleDocSelection(doc.id)}
                        className={`p-4 rounded-2xl cursor-pointer border text-xs transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-indigo-950/60 border-indigo-500 text-indigo-100 shadow-md shadow-indigo-950'
                            : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold truncate text-slate-200">{doc.filename}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {doc.chunk_count > 0 ? `${doc.chunk_count} Chunks` : doc.status}
                            </p>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium shrink-0 ${
                          doc.status === 'ready' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50' : 'bg-red-950 text-red-300 border border-red-800/50'
                        }`}>
                          {doc.status}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Engine Stats Grid */}
                <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-xs font-mono">
                  <div className="text-center border-r border-slate-800 pr-2">
                    <p className="text-[10px] text-slate-500 uppercase">Embedding Model</p>
                    <p className="font-bold text-indigo-300 mt-0.5">text-embedding-3-small</p>
                  </div>
                  <div className="text-center border-r border-slate-800 pr-2">
                    <p className="text-[10px] text-slate-500 uppercase">Dimensions</p>
                    <p className="font-bold text-purple-300 mt-0.5">1536 Vector Dim</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 uppercase">Metric</p>
                    <p className="font-bold text-pink-300 mt-0.5">Cosine Similarity</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setActiveStep(1)}
                    className="px-4 py-3 rounded-2xl text-slate-400 hover:text-white text-xs font-medium flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Upload
                  </button>

                  <button
                    onClick={handleBuildVectorDB}
                    disabled={selectedDocIds.length === 0 || isBuildingVectorDB}
                    className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-40 text-white font-bold text-xs shadow-xl shadow-indigo-600/30 flex items-center gap-2 transition"
                  >
                    <Zap className="w-4 h-4" />
                    {isBuildingVectorDB ? 'Building Vector DB Index...' : `⚡ Create Vector DB & Launch Chatbot (${selectedDocIds.length} Selected)`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: FULL-SCREEN RAG CHATBOT STUDIO */}
          {activeStep === 3 && (
            <div className="flex-1 flex flex-col h-full bg-slate-950">
              {/* Active Vector DB Header Bar */}
              <div className="border-b border-slate-800/80 glass-panel p-4 px-8 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      Active Vector DB Chatbot
                      <span className="px-2.5 py-0.5 text-[10px] rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/50 font-normal">
                        Ready for Query
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Scoped to {vectorDBStatus ? vectorDBStatus.indexed_documents_count : selectedDocIds.length} selected document(s) • {vectorDBStatus?.total_chunks || 0} Vector Chunks Indexed
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setActiveStep(2)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition flex items-center gap-1.5"
                  >
                    <Database className="w-3.5 h-3.5 text-indigo-400" /> Manage Vector DB
                  </button>
                </div>
              </div>

              {/* Chat Messages Area */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto py-12">
                    <div className="p-5 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-5 shadow-2xl">
                      <Zap className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-100 tracking-tight">Ask DocuMind AI Anything</h3>
                    <p className="text-xs text-slate-400 mt-2.5 leading-relaxed max-w-md">
                      Your document vector database is active. OpenAI SDK retrieves semantic chunks and synthesizes contextual answers with source citations.
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
                          className="p-3.5 rounded-2xl glass-panel text-left text-xs text-slate-300 hover:text-indigo-300 hover:border-indigo-500/50 transition flex items-center justify-between group"
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
                    <span>Searching vector database & generating answer...</span>
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <div className="p-4 border-t border-slate-800/80 glass-panel shrink-0">
                <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="max-w-4xl mx-auto flex gap-3">
                  <input
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder="Ask a question across your vector database..."
                    className="flex-1 px-5 py-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-sm focus:outline-none focus:border-indigo-500 text-slate-100 placeholder-slate-500 shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={isGenerating || !inputQuery.trim()}
                    className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white font-semibold text-sm transition shadow-xl shadow-indigo-600/25 flex items-center gap-2 shrink-0"
                  >
                    <MessageSquare className="w-4 h-4" /> Send <CornerDownLeft className="w-3.5 h-3.5 opacity-60" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
