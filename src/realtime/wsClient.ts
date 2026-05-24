import type { ClientMessage, ServerMessage } from './protocol';
import { parseServerMessage } from './protocol';

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

const RECONNECT_BASE_MS = 900;
const RECONNECT_MAX_MS = 15_000;

function resolveWsUrl(): string {
  const fromEnv = import.meta.env.VITE_WS_URL as string | undefined;
  if (fromEnv?.trim()) return fromEnv.trim();
  const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:5173';
  return `${proto}://${host}/ws`;
}

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private intentionalClose = false;
  private refCount = 0;

  private traceSessionId: string | null = null;

  private readonly messageListeners = new Set<(msg: ServerMessage) => void>();
  private readonly statusListeners = new Set<(s: ConnectionStatus) => void>();

  private status: ConnectionStatus = 'idle';

  /**
   * Subscribe to agent trace broadcasts for one session (idempotent per connection).
   * Call again when user switches chats.
   */
  subscribeTraceSession(sessionId: string): void {
    const prevId = this.traceSessionId;
    this.traceSessionId = sessionId;
    console.log("🚀 ~ this.traceSessionId:", this.traceSessionId)
    const sock = this.ws;
    if (!sock || sock.readyState !== WebSocket.OPEN) return;
    if (prevId && prevId !== sessionId) {
      this.send({ type: 'unsubscribe', payload: { sessionId: prevId } });
    }
    this.send({ type: 'subscribe', payload: { sessionId } });
  }

  private resubscribeTraceAfterHello(): void {
    if (!this.traceSessionId) return;
    this.send({ type: 'subscribe', payload: { sessionId: this.traceSessionId } });
  }

  acquire(): void {
    this.refCount += 1;
    if (this.refCount === 1) {
      this.intentionalClose = false;
      this.connect();
    }
  }

  release(): void {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount === 0) {
      this.intentionalClose = true;
      this.clearReconnectTimer();
      this.ws?.close();
      this.ws = null;
      this.setStatus('closed');
    }
  }

  send(message: ClientMessage): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(message));
  }

  subscribeMessages(listener: (msg: ServerMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  subscribeStatus(listener: (s: ConnectionStatus) => void): () => void {
    listener(this.status);
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private emitMessage(msg: ServerMessage): void {
    for (const l of this.messageListeners) l(msg);
  }

  private setStatus(next: ConnectionStatus): void {
    this.status = next;
    for (const l of this.statusListeners) l(next);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleConnect(delayMs: number): void {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => this.connect(), delayMs);
  }

  private connect(): void {
    if (this.intentionalClose || this.refCount === 0) return;

    this.setStatus('connecting');
    const url = resolveWsUrl();
    const socket = new WebSocket(url);
    this.ws = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.setStatus('open');
      this.send({ type: 'hello', payload: { clientVersion: import.meta.env.VITE_APP_VERSION ?? '0.0.0' } });
      this.resubscribeTraceAfterHello();
    };

    socket.onmessage = (ev) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
      } catch {
        return;
      }
      const msg = parseServerMessage(parsed);
      if (msg) this.emitMessage(msg);
    };

    socket.onerror = () => {
      this.setStatus('error');
    };

    socket.onclose = () => {
      this.ws = null;
      if (this.intentionalClose || this.refCount === 0) {
        this.setStatus('closed');
        return;
      }
      this.setStatus('closed');
      const delay = Math.min(
        RECONNECT_MAX_MS,
        RECONNECT_BASE_MS * 2 ** this.reconnectAttempt
      );
      this.reconnectAttempt += 1;
      this.scheduleConnect(delay);
    };
  }
}

export const realtimeClient = new RealtimeClient();
