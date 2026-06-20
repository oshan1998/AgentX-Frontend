import { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  MessageSquare, 
  Cpu, 
  History, 
  Plus, 
  Search, 
  Clock, 
  User as UserIcon, 
  Terminal,
  Activity,
  CheckCircle2,
  Loader2,
  Plug,
  StopCircle,
  Paperclip,
  X,
} from 'lucide-react';
import { sendChat } from './api/chat';
import { uploadSessionFile } from './api/workspace';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import IntegrationsModal from './IntegrationsModal';
import TaskGraph from './TaskGraph';
import { useRealtime } from './realtime/useRealtime';
import { useReasoningTrace } from './realtime/useAgentTrace';
import type { ConnectionStatus } from './realtime/wsClient';
import './IntegrationsModal.css';
import './App.css';

function createRunId(): string {
  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function RealtimeStatusBadge({
  status,
  welcome,
}: {
  status: ConnectionStatus;
  welcome: { serverTime: string } | null;
}) {
  const cfg =
    status === 'open'
      ? { label: 'Live', className: 'text-emerald-500', dot: 'bg-emerald-500 animate-pulse' }
      : status === 'connecting'
        ? { label: 'Connecting…', className: 'text-amber-400', dot: 'bg-amber-400 animate-pulse' }
        : status === 'error'
          ? { label: 'Connection error', className: 'text-rose-400', dot: 'bg-rose-400' }
          : { label: 'Offline', className: 'text-slate-500', dot: 'bg-slate-600' };

  return (
    <div className="flex flex-col gap-0.5">
      <div className={`flex items-center gap-2 text-xs ${cfg.className}`}>
        <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </div>
      {welcome && status === 'open' ? (
        <span className="text-[10px] text-slate-500 tabular-nums">
          Handshake {new Date(welcome.serverTime).toLocaleTimeString()}
        </span>
      ) : null}
    </div>
  );
}

interface MessageAttachment {
  name: string;
  path: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  attachments?: MessageAttachment[];
}

interface PendingAttachment {
  name: string;
  path: string;
}

interface Session {
  id: string;
  title: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState('web-session');
  const [pendingChatSessionId, setPendingChatSessionId] = useState<string | null>(null);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reasoningEndRef = useRef<HTMLDivElement>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const activeSessionRef = useRef(activeSession);
  activeSessionRef.current = activeSession;
  const { status: realtimeStatus, lastMessage: realtimeLast } = useRealtime();
  const { reasoningSteps, beginReasoningRun } = useReasoningTrace(activeSession);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (reasoningSteps.length === 0) return;
    const id = requestAnimationFrame(() => {
      reasoningEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
    return () => cancelAnimationFrame(id);
  }, [reasoningSteps]);

  // Initial load
  useEffect(() => {
    fetchSessions();
    loadSessionHistory(activeSession);
  }, []);

  useEffect(() => {
    setUploadError(null);
    setPendingAttachments([]);
  }, [activeSession]);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      if (data.sessions) setSessions(data.sessions as Session[]);
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    }
  };

  const createNewSession = async () => {
    try {
      const res = await fetch('/api/sessions', { method: 'POST' });
      const data = await res.json();
      if (data.id) {
        setSessions(prev => [{ id: data.id, title: 'New Session' }, ...prev]);
        setActiveSession(data.id);
        setMessages([]);
        void fetchSessions();
      }
    } catch (err) {
      console.error('Failed to create session', err);
    }
  };

  const loadSessionHistory = async (sid: string) => {
    try {
      const res = await fetch(`/api/session/${sid}`);
      const data = await res.json().catch(() => ({}));

      if (activeSessionRef.current !== sid) return;

      const raw = Array.isArray(data.messages)
        ? data.messages
        : [];
      setMessages(
        raw.map((m: any) => ({
          role: m.role,
          content: m.content || m.message,
        })),
      );
    } catch (err) {
      console.error('Failed to load history', err);
      if (activeSessionRef.current === sid) {
        setMessages([]);
      }
    }
  };

  const isActiveSessionPending =
    pendingChatSessionId !== null && pendingChatSessionId === activeSession;

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length) return;

    setUploadError(null);
    setIsUploading(true);
    const sid = activeSession;

    try {
      const uploaded: PendingAttachment[] = [];
      for (const file of Array.from(selected)) {
        const saved = await uploadSessionFile(sid, file);
        uploaded.push({
          name: saved.originalName || file.name,
          path: saved.path,
        });
      }
      if (activeSessionRef.current === sid) {
        setPendingAttachments((prev) => [...prev, ...uploaded]);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removePendingAttachment = (path: string) => {
    setPendingAttachments((prev) => prev.filter((file) => file.path !== path));
  };

  const handleStop = () => {
    if (!isActiveSessionPending) return;
    const runId = activeRunIdRef.current;
    if (runId) {
      void fetch('/api/chat/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });
    }
    chatAbortRef.current?.abort();
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();
    const attachmentsForSend = [...pendingAttachments];
    if ((!trimmedInput && attachmentsForSend.length === 0) || isActiveSessionPending) {
      return;
    }

    const attachmentPaths = attachmentsForSend.map((file) => file.path);
    const userMessage =
      trimmedInput ||
      `Attached: ${attachmentsForSend.map((file) => file.name).join(', ')}`;
    const runId = createRunId();
    const sessionForSend = activeSession;
    const ac = new AbortController();
    chatAbortRef.current = ac;
    activeRunIdRef.current = runId;
    setInput('');
    setPendingAttachments([]);
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: userMessage,
        attachments: attachmentsForSend.length > 0 ? attachmentsForSend : undefined,
      },
    ]);
    setPendingChatSessionId(sessionForSend);
    beginReasoningRun(sessionForSend, runId);

    try {
      const data = await sendChat(
        {
          message: userMessage,
          sessionId: sessionForSend,
          runId,
          attachmentPaths,
        },
        ac.signal,
      );

      const stillOwnsView = activeSessionRef.current === sessionForSend;
      if (data.response && stillOwnsView) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.response as string },
        ]);
      }
      void fetchSessions();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        await loadSessionHistory(sessionForSend);
        void fetchSessions();
      } else {
        console.error('Chat error', err);
      }
    } finally {
      setPendingChatSessionId((current) =>
        current === sessionForSend ? null : current,
      );
      chatAbortRef.current = null;
      activeRunIdRef.current = null;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar: Sessions & Navigation */}
      <aside className="sidebar glass-panel animate-in">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Cpu className="text-blue-500" size={24} />
            <h1 className="text-xl font-bold gradient-text">AgentX</h1>
          </div>
        </div>

        <div className="sidebar-new-btn-wrapper">
          <button className="new-conv-btn" onClick={createNewSession}>
            <Plus size={16} />
            New Conversation
          </button>
        </div>
        
        <div className="panel-content">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
            <History size={14} />
            Recent Sessions
          </div>
          {sessions.map(s => (
            <button 
              key={s.id} 
              className={`session-item ${activeSession === s.id ? 'active' : ''}`}
              onClick={() => {
                const sid = s.id;
                setActiveSession(sid);
                void loadSessionHistory(sid);
              }}
            >
              <MessageSquare size={16} />
              <span className="truncate">{s.title}</span>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <UserIcon size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Guest User</p>
              <p className="text-xs text-slate-500 truncate">Local Agent</p>
            </div>
            <button
              className="integrations-trigger-btn"
              title="Integrations"
              onClick={() => setShowIntegrations(true)}
            >
              <Plug size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="main-chat glass-panel animate-in">
        <header className="panel-header">
          <div>
            <h2 className="font-semibold text-lg">
              {sessions.find(s => s.id === activeSession)?.title || activeSession}
            </h2>
            <RealtimeStatusBadge status={realtimeStatus} welcome={realtimeLast?.type === 'welcome' ? realtimeLast.payload : null} />
          </div>
          <div className="flex gap-4">
            <button className="text-slate-400 hover:text-white"><Search size={20}/></button>
            <button className="text-slate-400 hover:text-white"><Clock size={20}/></button>
          </div>
        </header>

        <section className="panel-content message-list">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`message ${m.role}`}
              >
                <ReactMarkdown>{m.content}</ReactMarkdown>
                {m.attachments?.length ? (
                  <div className="message-attachments">
                    {m.attachments.map((file) => (
                      <span key={file.path} className="message-attachment-chip" title={file.path}>
                        <Paperclip size={12} />
                        <span className="upload-chip-name">{file.name}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </motion.div>
            ))}
          </AnimatePresence>
          {isActiveSessionPending && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="message assistant italic text-slate-400 flex items-center gap-2"
            >
              <Loader2 size={16} className="animate-spin" />
              Agent is thinking...
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </section>

        <footer className="chat-input-footer">
          {pendingAttachments.length > 0 ? (
            <div className="upload-chips-row">
              {pendingAttachments.map((file) => (
                <span key={file.path} className="upload-chip" title={file.path}>
                  <Paperclip size={12} />
                  <span className="upload-chip-name">{file.name}</span>
                  <button
                    type="button"
                    className="upload-chip-remove"
                    onClick={() => removePendingAttachment(file.path)}
                    disabled={isActiveSessionPending}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          {uploadError ? <p className="upload-error">{uploadError}</p> : null}
          <div className="chat-input-container">
            <div className="chat-input-wrap">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden-file-input"
                accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.txt,.md,.json,.csv,.html,.htm,.xml"
                onChange={(e) => void handleFilePick(e)}
              />
              <button
                type="button"
                className="chat-input-attach"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isActiveSessionPending}
                title="Attach file to session workspace"
              >
                {isUploading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Paperclip size={18} />
                )}
              </button>
              <input
                className="chat-input"
                placeholder="Type your command..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
            </div>
            {isActiveSessionPending ? (
              <button
                type="button"
                className="stop-btn"
                onClick={handleStop}
                title="Stop agent"
              >
                <StopCircle size={18} />
              </button>
            ) : null}
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={
                isActiveSessionPending ||
                (!input.trim() && pendingAttachments.length === 0)
              }
            >
              <Send size={18} />
            </button>
          </div>
        </footer>
      </main>

      {/* Right: Reasoning & Logs */}
      <aside className="reasoning-panel glass-panel animate-in">
        <header className="panel-header">
          <div className="flex items-center gap-2 text-slate-300">
            <Activity size={20} />
            <h2 className="font-semibold">Reasoning Feed</h2>
          </div>
          <button 
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-slate-500 hover:text-white"
            title="Visualize System Graph"
            onClick={() => setShowGraph(true)}
          >
            <Terminal size={18} />
          </button>
        </header>
        
        <div className="panel-content">
          {reasoningSteps.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <div className="w-12 h-12 rounded-full border border-slate-800 flex items-center justify-center mb-4">
                <Cpu size={24} className="opacity-20" />
              </div>
              <p className="text-sm">No active processes</p>
              <p className="text-xs mt-1">Start a conversation to see the agent's logic</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reasoningSteps.map(step => (
                <motion.div 
                  key={step.id}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="tool-card"
                >
                  <div className="tool-status">
                    <div className={`status-dot ${step.status === 'active' ? 'active' : ''}`} />
                    <span className={`font-semibold text-sm ${step.status === 'active' ? 'text-blue-400' : 'text-slate-400'}`}>
                      {step.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{step.description}</p>
                  {step.status === 'complete' && (
                    <div className="mt-2 flex justify-end">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                    </div>
                  )}
                </motion.div>
              ))}
              <div ref={reasoningEndRef} className="h-px w-full shrink-0" aria-hidden />
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-800 bg-black/20">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase">System Status</span>
            <span className="text-[10px] text-emerald-500">Healthy</span>
          </div>
          <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full w-3/4"></div>
          </div>
        </div>
      </aside>

      {/* Integrations Modal */}
      <IntegrationsModal
        isOpen={showIntegrations}
        onClose={() => setShowIntegrations(false)}
      />

      {/* Task Graph Modal */}
      {showGraph && (
        <TaskGraph 
          sessionId={activeSession} 
          onClose={() => setShowGraph(false)} 
        />
      )}
    </div>
  );
}

export default App;
