import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Upload, 
  FileText, 
  Trash2, 
  Loader2, 
  MessageSquare, 
  BookOpen,
  ChevronRight,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatMessage, DocumentMetadata, Source } from './types';

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatting]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      setDocuments(data);
    } catch (e) {
      console.error('Failed to fetch docs', e);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
      formData.append('files', e.target.files[i]);
    }

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        await fetchDocuments();
      }
    } catch (e) {
      console.error('Upload failed', e);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch('/api/documents/' + id, { method: 'DELETE' });
      await fetchDocuments();
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isChatting) return;

    const userMsg: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsChatting(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: input,
          history: messages.slice(-5) 
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.answer,
        sources: data.sources
      }]);
    } catch (e) {
      console.error('Chat failed', e);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your request.' 
      }]);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="bg-white border-r border-slate-200 flex flex-col shadow-sm z-20"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h1 className="font-bold text-xl flex items-center gap-2 text-indigo-600">
                <BookOpen className="w-6 h-6" />
                RAG Chat
              </h1>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-md lg:hidden"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              <div className="mb-6">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-all group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {isUploading ? (
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-500 mb-2" />
                        <p className="text-sm text-slate-500 group-hover:text-indigo-600">Upload Documents</p>
                        <p className="text-xs text-slate-400 mt-1">PDF, DOCX, TXT, CSV</p>
                      </>
                    )}
                  </div>
                  <input type="file" className="hidden" multiple onChange={handleUpload} disabled={isUploading} />
                </label>
              </div>

              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Your Documents</h2>
                {documents.length === 0 ? (
                  <p className="text-sm text-slate-400 italic text-center py-8">No documents uploaded yet.</p>
                ) : (
                  documents.map(doc => (
                    <div key={doc.id} className="group flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                        <div className="overflow-hidden">
                          <p className="text-sm font-medium truncate">{doc.filename}</p>
                          <p className="text-[10px] text-slate-400">{doc.chunkCount} chunks • {doc.fileType.toUpperCase()}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDelete(doc.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Gemini 1.5 Flash Active
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative">
        {!sidebarOpen && (
          <button 
            onClick={() => setSidebarOpen(true)}
            className="absolute top-6 left-6 p-2 bg-white shadow-md border border-slate-200 rounded-lg z-10 hover:bg-slate-50 transition-all"
          >
            <ChevronRight className="w-5 h-5 text-indigo-600" />
          </button>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-2">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">Knowledge Assistant</h3>
              <p className="text-slate-500">
                Upload your documents and ask me anything about them. I'll provide answers grounded strictly in your data.
              </p>
              <div className="grid grid-cols-1 gap-2 w-full mt-4">
                {['Summarize the main points', 'What are the key findings?', 'Explain the methodology'].map(q => (
                  <button 
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-left p-3 text-sm border border-slate-200 rounded-xl hover:bg-white hover:border-indigo-300 hover:shadow-sm transition-all text-slate-600"
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto w-full space-y-6">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-4 ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                      : 'bg-white border border-slate-200 shadow-sm'
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sources</p>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.map((src, si) => (
                            <div key={si} className="group relative">
                              <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] rounded-md border border-slate-200 cursor-help hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all">
                                {src.filename}
                              </span>
                              <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-30 shadow-xl">
                                <p className="font-bold mb-1">Relevance: {Math.round(src.score * 100)}%</p>
                                <p className="italic">"{src.content}"</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isChatting && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                    <span className="text-sm text-slate-400">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={documents.length > 0 ? "Ask a question about your documents..." : "Upload documents first to start chatting"}
              disabled={documents.length === 0 || isChatting}
              className="w-full pl-4 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isChatting || documents.length === 0}
              className="absolute right-2 top-2 bottom-2 px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-md active:scale-95"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-3">
            AI can make mistakes. Verify important information from the cited sources.
          </p>
        </div>
      </main>
    </div>
  );
}
