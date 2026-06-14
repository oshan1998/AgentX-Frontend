import { useEffect, useRef, useState, useCallback } from 'react';
import type { ReasoningStepUi } from './traceToSteps';
import { mergeTraceIntoSteps } from './traceToSteps';
import { realtimeClient } from './wsClient';

export function useReasoningTrace(sessionId: string): {
  reasoningSteps: ReasoningStepUi[];
  beginReasoningRun: (forSessionId: string, runId: string) => void;
} {
  const [reasoningSteps, setReasoningSteps] = useState<ReasoningStepUi[]>([]);
  /** Last run id started per session so switching chats does not drop traces for in-flight runs */
  const runIdBySessionRef = useRef<Map<string, string>>(new Map());

  const beginReasoningRun = useCallback((forSessionId: string, runId: string) => {
    runIdBySessionRef.current.set(forSessionId, runId);
    if (forSessionId === sessionId) {
      setReasoningSteps([]);
    }
  }, [sessionId]);

  useEffect(() => {
    setReasoningSteps([]);
    realtimeClient.subscribeTraceSession(sessionId);
  }, [sessionId]);

  /** If the WS was not OPEN when switching chats, subscribe again after connect/reconnect. */
  useEffect(() => {
    const unsub = realtimeClient.subscribeStatus((status) => {
      if (status === 'open') {
        realtimeClient.subscribeTraceSession(sessionId);
      }
    });
    return unsub;
  }, [sessionId]);

  useEffect(() => {
    return realtimeClient.subscribeMessages((msg) => {
      if (msg.type !== 'agent_trace') return;
      
      const p = msg.payload;
      const isSubSession = p.sessionId.startsWith(`${sessionId}::sub_`);
      if (p.sessionId !== sessionId && !isSubSession) return;

      if (p.step === 'sub_delegate' && p.phase === 'start') {
        realtimeClient.subscribeAdditionalSession(p.subSessionId);
      }

      const bound = runIdBySessionRef.current.get(p.sessionId);
      if (bound !== undefined && p.runId !== bound) return;

      if (bound === undefined) {
        runIdBySessionRef.current.set(p.sessionId, p.runId);
      }
      setReasoningSteps((prev) => mergeTraceIntoSteps(prev, p));
    });
  }, [sessionId]);

  return { reasoningSteps, beginReasoningRun };
}
