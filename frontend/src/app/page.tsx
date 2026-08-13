'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, UploadCloud, MessageSquare, ShieldCheck, Sparkles, BookOpen, 
  Layers, Cpu, CheckCircle2, AlertCircle, Zap, Database, ArrowRight, 
  Trash2, RefreshCw, CheckSquare, Square, CornerDownLeft, ChevronRight,
  Plus, Check, Lock, ArrowLeft, Search, Filter, ExternalLink, Play, Clock, X
} from 'lucide-react';
import { api, DocumentItem, MessageItem, VectorDBStatus, ConversationItem } from '@/lib/api';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';


export default function Home() {
  // Main Tab Navigation: 'files' | 'vector_dbs' | 'chatbots'
  const [activeTab, setActiveTab] = useState<'files' | 'vector_dbs' | 'chatbots'>('files');

  // Active Chat Studio Drawer state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeChatTitle, setActiveChatTitle] = useState<string>('Vector DB Assistant');

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  
  const [inputQuery, setInputQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

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
      fetchConversations();
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
      fetchConversations();
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
        fetchConversations();
      } catch (regErr: any) {
        setErrorMsg('Authentication failed. Please check your credentials.');
      }
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await api.get('/documents');
      const docs: DocumentItem[] = res.data.documents || [];
      setDocuments(docs);
      
      if (selectedDocIds.length === 0 && docs.length > 0) {
        const readyIds = docs.filter(d => d.status === 'ready').map(d => d.id);
        setSelectedDocIds(readyIds);
      }
    } catch (err) {
      console.error('Failed to load documents', err);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await api.get('/chat/conversations');
      setConversations(res.data || []);
    } catch (err) {
      console.error('Failed to load conversations', err);
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
      setTimeout(fetchDocuments, 1500);
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
  };

  const toggleSelectAll = () => {
    const readyIds = documents.filter(d => d.status === 'ready').map(d => d.id);
    if (selectedDocIds.length === readyIds.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(readyIds);
    }
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
      setErrorMsg('Please select at least one ready document to create a Vector Database.');
      return;
    }

    setIsBuildingVectorDB(true);
    setErrorMsg(null);

    try {
      const res = await api.post('/documents/build-vector-db', {
        document_ids: selectedDocIds
      });
      setVectorDBStatus(res.data);
      setActiveTab('vector_dbs');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to create Vector Database index.');
    } finally {
      setIsBuildingVectorDB(false);
    }
  };

  const handleOpenChat = async (convId?: string, title?: string) => {
    setActiveConvId(convId || null);
    setActiveChatTitle(title || `Vector Assistant (${selectedDocIds.length} docs)`);
    setIsChatOpen(true);

    if (convId) {
      try {
        const res = await api.get(`/chat/conversations/${convId}`);
        setMessages(res.data.messages || []);
      } catch (err) {
        console.error('Failed to load conversation messages', err);
      }
    } else {
      setMessages([]);
    }
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/chat/conversations/${convId}`);
      fetchConversations();
      if (activeConvId === convId) {
        setIsChatOpen(false);
      }
    } catch (err) {
      console.error('Failed to delete conversation', err);
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
        fetchConversations();
      }
      setMessages(prev => [...prev, res.data.message]);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to generate response. Ensure OPENAI_API_KEY is configured.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Filtered documents search
  const filteredDocs = documents.filter(d => 
    d.filename.toLowerCase().includes(searchFilter.toLowerCase()) ||
    d.file_type.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Glassmorphic Top Bar */}
      <header className="h-16 border-b border-slate-800/80 glass-panel flex items-center justify-between px-6 z-20 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-400 bg-clip-text text-transparent">
              DocuMind AI
            </h1>
            <p className="text-[11px] text-slate-400">OpenAI Vector DB & Chatbot Dashboard</p>
          </div>
        </div>

        {/* Dashboard Main Tabs */}
        {isAuthenticated && (
          <div className="flex items-center bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('files')}
              className={`px-4 py-1.5 rounded-xl font-semibold transition flex items-center gap-2 ${
                activeTab === 'files'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> 1. Files ({documents.length})
            </button>
            <button
              onClick={() => setActiveTab('vector_dbs')}
              className={`px-4 py-1.5 rounded-xl font-semibold transition flex items-center gap-2 ${
                activeTab === 'vector_dbs'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" /> 2. Vector DBs ({vectorDBStatus ? 1 : 0})
            </button>
            <button
              onClick={() => setActiveTab('chatbots')}
              className={`px-4 py-1.5 rounded-xl font-semibold transition flex items-center gap-2 ${
                activeTab === 'chatbots'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" /> 3. Chatbots ({conversations.length})
            </button>
          </div>
        )}

        {/* User Auth */}
        {isAuthenticated ? (
          <div className="flex items-center space-x-3">
            <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Authenticated
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

      {/* Main Area */}
      {!isAuthenticated ? (
        <div className="flex-1 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950">
          <div className="max-w-md w-full glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl">
            <div className="text-center mb-6">
              <div className="inline-flex p-4 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 mb-3 text-indigo-400 shadow-inner">
                <Sparkles className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Welcome to DocuMind AI</h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Manage document files, build vector database indexes with OpenAI SDK, and launch RAG AI Chatbots.
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
          {/* Main Dashboard Content View */}
          <main className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full">
            {errorMsg && (
              <div className="mb-6 p-4 rounded-2xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
                <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>
            )}

            {/* TAB 1: FILES REPOSITORY DATA TABLE */}
            {activeTab === 'files' && (
              <div className="space-y-6">
                {/* Header Action Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-5 rounded-3xl border border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-400" /> Files Repository Table
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Upload PDF/DOCX files, manage extractions, and select items for Vector DB indexing.
                    </p>
                  </div>

                  <div className="flex items-center space-x-3 w-full sm:w-auto">
                    {/* Upload File Button */}
                    <label className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 text-xs font-semibold cursor-pointer transition flex items-center gap-2">
                      <UploadCloud className="w-4 h-4" />
                      {isUploading ? 'Uploading...' : 'Upload File'}
                      <input type="file" accept=".pdf,.docx,.doc" onChange={handleFileUpload} className="hidden" />
                    </label>

                    {/* Create Vector DB Action */}
                    <button
                      onClick={handleBuildVectorDB}
                      disabled={selectedDocIds.length === 0 || isBuildingVectorDB}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
                    >
                      <Cpu className="w-4 h-4" />
                      {isBuildingVectorDB ? 'Indexing...' : `⚡ Create Vector DB (${selectedDocIds.length})`}
                    </button>
                  </div>
                </div>

                {/* Drag and Drop Zone Card */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-3xl p-6 text-center transition cursor-pointer flex flex-col items-center justify-center ${
                    isDragging
                      ? 'border-indigo-400 bg-indigo-500/10'
                      : 'border-slate-800 bg-slate-900/40 hover:border-indigo-500/50 hover:bg-slate-900/60'
                  }`}
                >
                  <input type="file" accept=".pdf,.docx,.doc" onChange={handleFileUpload} className="absolute opacity-0 cursor-pointer" />
                  <div className="flex items-center space-x-3 text-slate-300 text-xs">
                    <UploadCloud className="w-5 h-5 text-indigo-400" />
                    <span className="font-medium">Drag & drop files here to upload instantly</span>
                    <span className="text-slate-500">(PDF, DOCX up to 25 MB)</span>
                  </div>
                </div>

                {/* Table Filter & Search */}
                <div className="flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Search files by name or format..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs focus:outline-none focus:border-indigo-500 text-slate-200 placeholder-slate-500"
                    />
                  </div>

                  <div className="flex items-center space-x-2 text-xs">
                    <button onClick={toggleSelectAll} className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white">
                      {selectedDocIds.length > 0 ? 'Deselect All' : 'Select All Ready'}
                    </button>
                    <button onClick={fetchDocuments} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Files Data Table */}
                <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-3.5 px-4 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={selectedDocIds.length > 0 && selectedDocIds.length === documents.filter(d => d.status === 'ready').length}
                            onChange={toggleSelectAll}
                            className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                          />
                        </th>
                        <th className="py-3.5 px-4">Filename</th>
                        <th className="py-3.5 px-4">Format</th>
                        <th className="py-3.5 px-4">Size</th>
                        <th className="py-3.5 px-4">Vector Chunks</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Uploaded</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredDocs.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                            No files match your search filter.
                          </td>
                        </tr>
                      ) : (
                        filteredDocs.map((doc) => {
                          const isSelected = selectedDocIds.includes(doc.id);
                          return (
                            <tr
                              key={doc.id}
                              onClick={() => toggleDocSelection(doc.id)}
                              className={`cursor-pointer transition hover:bg-slate-900/50 ${
                                isSelected ? 'bg-indigo-950/30' : ''
                              }`}
                            >
                              <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleDocSelection(doc.id)}
                                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="py-3.5 px-4 font-semibold text-slate-200 flex items-center space-x-2">
                                <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                                <span className="truncate max-w-xs">{doc.filename}</span>
                              </td>
                              <td className="py-3.5 px-4 uppercase font-mono text-[11px] text-slate-400">{doc.file_type}</td>
                              <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">{(doc.file_size / 1024).toFixed(0)} KB</td>
                              <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">{doc.chunk_count} Chunks</td>
                              <td className="py-3.5 px-4">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium inline-block ${
                                  doc.status === 'ready' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50' :
                                  doc.status === 'processing' ? 'bg-amber-950 text-amber-300 border border-amber-800/50' : 'bg-red-950 text-red-300 border border-red-800/50'
                                }`}>
                                  {doc.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                                {new Date(doc.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-3.5 px-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
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
                                  title="Delete File"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: VECTOR DB INDEXES TABLE */}
            {activeTab === 'vector_dbs' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between glass-panel p-5 rounded-3xl border border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      <Database className="w-5 h-5 text-indigo-400" /> Vector Database Indexes Table
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Inspect active vector index parameters, chunk counts, and launch chatbots.
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveTab('files')}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Create New Vector DB
                  </button>
                </div>

                {/* Vector DB Data Table */}
                <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-3.5 px-6">Index ID / Name</th>
                        <th className="py-3.5 px-4">Document Scope</th>
                        <th className="py-3.5 px-4">Embedding Model</th>
                        <th className="py-3.5 px-4">Vector Dim</th>
                        <th className="py-3.5 px-4">Total Chunks</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {vectorDBStatus ? (
                        <tr className="hover:bg-slate-900/40 transition">
                          <td className="py-4 px-6 font-bold text-indigo-300 flex items-center space-x-2">
                            <Cpu className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span>vdb_index_primary</span>
                          </td>
                          <td className="py-4 px-4 text-slate-300">
                            <span className="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded font-mono text-[11px]">
                              {vectorDBStatus.indexed_documents_count} Files Selected
                            </span>
                          </td>
                          <td className="py-4 px-4 text-slate-400 font-mono text-[11px]">{vectorDBStatus.vector_model}</td>
                          <td className="py-4 px-4 text-slate-400 font-mono text-[11px]">{vectorDBStatus.vector_dimensions} Dim</td>
                          <td className="py-4 px-4 font-bold text-slate-200">{vectorDBStatus.total_chunks} Chunks</td>
                          <td className="py-4 px-4">
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/50 text-[10px] font-semibold flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Active
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => handleOpenChat(undefined, `Vector Assistant (${vectorDBStatus.indexed_documents_count} docs)`)}
                              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-1.5 ml-auto"
                            >
                              <MessageSquare className="w-3.5 h-3.5" /> Launch Chatbot
                            </button>
                          </td>
                        </tr>
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                            No active Vector Database index generated yet. Go to <strong className="text-indigo-400 cursor-pointer" onClick={() => setActiveTab('files')}>Files Repository</strong>, select files, and click <strong>Create Vector DB</strong>.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: CHATBOTS & CONVERSATIONS DATA TABLE */}
            {activeTab === 'chatbots' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between glass-panel p-5 rounded-3xl border border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-indigo-400" /> AI Chatbots & Sessions Table
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      View all active chatbot sessions, target vector scopes, and open chat studios.
                    </p>
                  </div>

                  <button
                    onClick={() => handleOpenChat()}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> New Chatbot Session
                  </button>
                </div>

                {/* Chatbot Conversations Table */}
                <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-3.5 px-6">Chatbot Session Title</th>
                        <th className="py-3.5 px-4">Vector DB Scope</th>
                        <th className="py-3.5 px-4">Created Date</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {conversations.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-slate-500 text-xs">
                            No chat sessions found. Click <strong>New Chatbot Session</strong> above to start a conversation.
                          </td>
                        </tr>
                      ) : (
                        conversations.map((conv) => (
                          <tr key={conv.id} className="hover:bg-slate-900/40 transition cursor-pointer" onClick={() => handleOpenChat(conv.id, conv.title)}>
                            <td className="py-4 px-6 font-bold text-slate-200 flex items-center space-x-2">
                              <MessageSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                              <span className="truncate max-w-sm">{conv.title}</span>
                            </td>
                            <td className="py-4 px-4 text-slate-400">
                              <span className="bg-indigo-950 text-indigo-300 px-2.5 py-1 rounded-full text-[10px] font-mono">
                                Active Vector Store
                              </span>
                            </td>
                            <td className="py-4 px-4 text-slate-500 text-[11px]">
                              {new Date(conv.created_at).toLocaleString()}
                            </td>
                            <td className="py-4 px-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleOpenChat(conv.id, conv.title)}
                                className="px-3.5 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white font-semibold text-xs transition"
                              >
                                Open Chat Studio
                              </button>
                              <button
                                onClick={(e) => handleDeleteConversation(conv.id, e)}
                                className="p-1.5 text-slate-500 hover:text-red-400 transition"
                                title="Delete Conversation"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>

          {/* INTERACTIVE FULL-SCREEN 2-COLUMN CHAT STUDIO WORKSPACE */}
          {isChatOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col">
              {/* Top Studio Bar */}
              <div className="h-16 p-4 px-6 border-b border-slate-800 glass-panel flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                      {activeChatTitle}
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/50 font-normal">
                        Active Vector Session
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">Scoped to {selectedDocIds.length} vector document(s)</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsChatOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition text-xs font-semibold flex items-center gap-2"
                >
                  <X className="w-4 h-4 text-slate-400" /> Close Studio
                </button>
              </div>

              {/* 2-Column Workspace Body */}
              <div className="flex-1 flex overflow-hidden">
                {/* Left Column (30%): Vector DB & Referenced Documents Inspector */}
                <div className="w-80 lg:w-96 border-r border-slate-800/80 bg-slate-900/40 p-5 flex flex-col space-y-5 overflow-y-auto shrink-0">
                  <div className="flex items-center space-x-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                    <Database className="w-4 h-4" /> Vector DB Specifications
                  </div>

                  <div className="p-4 rounded-2xl glass-panel border border-slate-800 space-y-3 text-xs">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-500">Embedding Model</span>
                      <span className="font-mono text-indigo-300 font-semibold">{vectorDBStatus?.vector_model || 'text-embedding-3-small'}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-500">Vector Dimensions</span>
                      <span className="font-mono text-purple-300 font-semibold">{vectorDBStatus?.vector_dimensions || 1536} Dim</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-500">Indexed Chunks</span>
                      <span className="font-mono text-emerald-300 font-bold">{vectorDBStatus?.total_chunks || 0} Chunks</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-500">Distance Metric</span>
                      <span className="font-mono text-pink-300 font-semibold">Cosine Similarity</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                    <Layers className="w-4 h-4" /> Indexed Documents ({selectedDocIds.length})
                  </div>

                  <div className="space-y-2 flex-1">
                    {documents.filter(d => selectedDocIds.includes(d.id)).map((doc) => (
                      <div key={doc.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                        <div className="flex items-center justify-between font-semibold text-slate-200">
                          <span className="truncate pr-2">{doc.filename}</span>
                          <span className="text-[10px] text-indigo-400 font-mono">{doc.chunk_count} Chunks</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono">{doc.file_type} • {(doc.file_size / 1024).toFixed(0)} KB</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column (70%): Chatbot Conversation & Input */}
                <div className="flex-1 flex flex-col bg-slate-950">
                  {/* Messages Scroll Area */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
                        <div className="p-4 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4 shadow-xl">
                          <Zap className="w-8 h-8" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-200">DocuMind AI Chatbot</h4>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                          Ask questions against your document vector database. OpenAI SDK retrieves semantic chunks and synthesizes contextual answers with page citations.
                        </p>

                        <div className="mt-6 grid grid-cols-1 gap-2 w-full">
                          {[
                            "Summarize the key points of the selected documents",
                            "Extract all dates, figures, and metrics",
                            "What are the main risks or requirements?"
                          ].map((promptText, i) => (
                            <button
                              key={i}
                              onClick={() => handleSendMessage(promptText)}
                              className="p-3 rounded-xl glass-panel text-left text-xs text-slate-300 hover:text-indigo-300 hover:border-indigo-500/50 transition flex items-center justify-between"
                            >
                              <span className="truncate">{promptText}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-2" />
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
                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none shadow-lg shadow-indigo-600/20'
                                : 'glass-panel text-slate-100 rounded-bl-none border border-slate-800'
                            }`}
                          >
                            {msg.sender === 'user' ? (
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            ) : (
                              <MarkdownRenderer content={msg.content} />
                            )}

                            {/* Source Citations */}
                            {msg.sources && msg.sources.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                                <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-indigo-400" /> Vector Citations ({msg.sources.length})
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {msg.sources.map((src, i) => (
                                    <div key={i} className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
                                      <div className="flex items-center justify-between text-slate-200 font-semibold mb-1">
                                        <span className="truncate pr-2">{src.filename}</span>
                                        {src.page_number && (
                                          <span className="text-[10px] text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded-full border border-indigo-800/50 font-mono">
                                            Page {src.page_number}
                                          </span>
                                        )}
                                      </div>
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
                        <span>Searching vector embeddings & generating answer...</span>
                      </div>
                    )}
                  </div>

                  {/* Chat Studio Input Bar */}
                  <div className="p-4 border-t border-slate-800/80 glass-panel shrink-0">
                    <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex gap-3 max-w-4xl mx-auto">
                      <input
                        type="text"
                        value={inputQuery}
                        onChange={(e) => setInputQuery(e.target.value)}
                        placeholder="Ask questions across your vector database..."
                        className="flex-1 px-5 py-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-sm focus:outline-none focus:border-indigo-500 text-slate-100 placeholder-slate-500 shadow-inner"
                      />
                      <button
                        type="submit"
                        disabled={isGenerating || !inputQuery.trim()}
                        className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/25 flex items-center gap-2 shrink-0"
                      >
                        <MessageSquare className="w-4 h-4" /> Send <CornerDownLeft className="w-3.5 h-3.5 opacity-60" />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
