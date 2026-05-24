/**
 * Mirrors AgentX/common/realtime/agent-trace-types — keep shapes aligned.
 */

export type AgentTraceRunOutcome =
  | 'complete'
  | 'max_iterations'
  | 'cancelled'
  | 'timed_out';

export type AgentTraceStep =
  | { step: 'thought'; iteration: number; phase: 'start' | 'end'; text?: string }
  | { step: 'tool'; iteration: number; name: string; phase: 'start' | 'end' }
  | { step: 'skill'; iteration: number; name: string; phase: 'start' | 'end' }
  | {
      step: 'skill_tool';
      iteration: number;
      skill: string;
      tool: string;
      phase: 'start' | 'end';
    }
  | { step: 'memory_write'; iteration: number; phase: 'start' | 'end' }
  | { step: 'profile_write'; iteration: number; phase: 'start' | 'end'; target?: string }
  | {
      step: 'sub_delegate';
      phase: 'start' | 'end';
      iteration: number;
      subSessionId: string;
      subRunId: string;
      outcome?: AgentTraceRunOutcome;
    }
  | { step: 'run_done'; outcome: AgentTraceRunOutcome };

export type AgentTracePayload = { sessionId: string; runId: string; seq: number; ts: string } & AgentTraceStep;

export type ClientMessage =
  | { type: 'hello'; payload?: { clientVersion?: string } }
  | { type: 'ping'; payload?: { t?: number } }
  | { type: 'subscribe'; payload: { sessionId: string } }
  | { type: 'unsubscribe'; payload: { sessionId: string } };

export type ServerMessage =
  | { type: 'welcome'; payload: { serverTime: string } }
  | { type: 'pong'; payload: { t: number } }
  | { type: 'error'; payload: { code: string; message?: string } }
  | { type: 'agent_trace'; payload: AgentTracePayload };

function parseTraceBody(payload: Record<string, unknown>): AgentTraceStep | null {
  const step = payload.step;
  const iterationRaw = payload.iteration;
  const iteration =
    typeof iterationRaw === 'number' && Number.isFinite(iterationRaw) ? iterationRaw : undefined;

  if (step === 'thought') {
    const phase = payload.phase;
    if (iteration === undefined || (phase !== 'start' && phase !== 'end')) return null;
    const text = payload.text;
    if (phase === 'end' && typeof text !== 'string') return null;
    if (phase === 'start' && text !== undefined && typeof text !== 'string') return null;
    return {
      step: 'thought',
      iteration,
      phase,
      ...(typeof text === 'string' ? { text } : {}),
    };
  }
  if (step === 'tool') {
    const name = payload.name;
    const phase = payload.phase;
    if (iteration === undefined || typeof name !== 'string') return null;
    if (phase !== 'start' && phase !== 'end') return null;
    return { step: 'tool', iteration, name, phase };
  }
  if (step === 'skill') {
    const name = payload.name;
    const phase = payload.phase;
    if (iteration === undefined || typeof name !== 'string') return null;
    if (phase !== 'start' && phase !== 'end') return null;
    return { step: 'skill', iteration, name, phase };
  }
  if (step === 'skill_tool') {
    const skill = payload.skill;
    const tool = payload.tool;
    const phase = payload.phase;
    if (
      iteration === undefined ||
      typeof skill !== 'string' ||
      typeof tool !== 'string'
    )
      return null;
    if (phase !== 'start' && phase !== 'end') return null;
    return { step: 'skill_tool', iteration, skill, tool, phase };
  }
  if (step === 'memory_write') {
    const phase = payload.phase;
    if (iteration === undefined || (phase !== 'start' && phase !== 'end')) return null;
    return { step: 'memory_write', iteration, phase };
  }
  if (step === 'profile_write') {
    const phase = payload.phase;
    const target = payload.target;
    if (iteration === undefined || (phase !== 'start' && phase !== 'end')) return null;
    return {
      step: 'profile_write',
      iteration,
      phase,
      target: typeof target === 'string' ? target : undefined,
    };
  }
  if (step === 'sub_delegate') {
    const phase = payload.phase;
    const subSessionId = payload.subSessionId;
    const subRunId = payload.subRunId;
    if (
      iteration === undefined ||
      (phase !== 'start' && phase !== 'end') ||
      typeof subSessionId !== 'string' ||
      typeof subRunId !== 'string'
    )
      return null;
    const outcome = payload.outcome;
    const o =
      outcome === 'complete' ||
      outcome === 'max_iterations' ||
      outcome === 'cancelled' ||
      outcome === 'timed_out'
        ? outcome
        : undefined;
    return {
      step: 'sub_delegate',
      phase,
      iteration,
      subSessionId,
      subRunId,
      ...(o !== undefined ? { outcome: o } : {}),
    };
  }
  if (step === 'run_done') {
    const outcome = payload.outcome;
    if (
      outcome !== 'complete' &&
      outcome !== 'max_iterations' &&
      outcome !== 'cancelled' &&
      outcome !== 'timed_out'
    )
      return null;
    return { step: 'run_done', outcome };
  }
  return null;
}

export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.type === 'welcome') {
    const p = o.payload;
    if (typeof p !== 'object' || p === null) return null;
    const pt = (p as Record<string, unknown>).serverTime;
    if (typeof pt !== 'string') return null;
    return { type: 'welcome', payload: { serverTime: pt } };
  }
  if (o.type === 'pong') {
    const p = o.payload;
    if (typeof p !== 'object' || p === null) return null;
    const t = (p as Record<string, unknown>).t;
    if (typeof t !== 'number') return null;
    return { type: 'pong', payload: { t } };
  }
  if (o.type === 'error') {
    const p = o.payload;
    if (typeof p !== 'object' || p === null) return null;
    const code = (p as Record<string, unknown>).code;
    if (typeof code !== 'string') return null;
    const message = (p as Record<string, unknown>).message;
    return {
      type: 'error',
      payload: {
        code,
        message: typeof message === 'string' ? message : undefined,
      },
    };
  }
  if (o.type === 'agent_trace') {
    const p = o.payload;
    if (typeof p !== 'object' || p === null) return null;
    const payload = p as Record<string, unknown>;
    const sessionId = payload.sessionId;
    const runId = payload.runId;
    const seq = payload.seq;
    const ts = payload.ts;
    if (typeof sessionId !== 'string' || typeof runId !== 'string') return null;
    if (typeof seq !== 'number' || typeof ts !== 'string') return null;
    const body = parseTraceBody(payload);
    if (!body) return null;
    return {
      type: 'agent_trace',
      payload: { sessionId, runId, seq, ts, ...body },
    };
  }
  return null;
}
