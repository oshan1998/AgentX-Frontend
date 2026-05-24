import type { AgentTracePayload, AgentTraceRunOutcome } from './protocol';

function runDoneLabel(outcome: AgentTraceRunOutcome): { label: string; description: string } {
  switch (outcome) {
    case 'complete':
      return { label: 'Run complete', description: '' };
    case 'max_iterations':
      return { label: 'Stopped (iteration limit)', description: 'Max iterations reached' };
    case 'cancelled':
      return { label: 'Run cancelled', description: 'Stopped by cancellation signal' };
    case 'timed_out':
      return { label: 'Run timed out', description: 'Wall-clock budget exceeded' };
    default:
      return { label: 'Run ended', description: '' };
  }
}

export interface ReasoningStepUi {
  id: string;
  type: string;
  status: 'pending' | 'active' | 'complete';
  label: string;
  description?: string;
}

function completeActive(rows: ReasoningStepUi[]): ReasoningStepUi[] {
  return rows.map((r) =>
    r.status === 'active' ? { ...r, status: 'complete' as const } : r,
  );
}

/** Stable row id for start/end pairing */
function pairId(kind: string, iteration: number, key: string, runId: string): string {
  return `${runId}:${kind}:${iteration}:${key}`;
}

export function mergeTraceIntoSteps(
  prev: ReasoningStepUi[],
  payload: AgentTracePayload,
): ReasoningStepUi[] {
  const { step, seq } = payload;

  const append = (
    rows: ReasoningStepUi[],
    row: Omit<ReasoningStepUi, 'status'> & Partial<Pick<ReasoningStepUi, 'status'>>,
  ): ReasoningStepUi[] => [
    ...rows,
    {
      ...row,
      status: row.status ?? 'complete',
    },
  ];

  switch (step) {
    case 'thought': {
      const id = pairId('thought', payload.iteration, 'thought', payload.runId);
      if (payload.phase === 'start') {
        return append(completeActive(prev), {
          id,
          type: 'thought',
          label: 'Agent reasoning',
          description: 'Consulting model…',
          status: 'active',
        });
      }
      const t = payload.text ?? '';
      const excerpt = t.length > 600 ? `${t.slice(0, 597)}…` : t;
      return prev.map((r) =>
        r.id === id
          ? { ...r, status: 'complete' as const, description: excerpt || '—' }
          : r,
      );
    }
    case 'tool': {
      const id = pairId('tool', payload.iteration, payload.name, payload.runId);
      if (payload.phase === 'start') {
        return append(completeActive(prev), {
          id,
          type: 'tool',
          label: `Tool: ${payload.name}`,
          description: 'Running…',
          status: 'active',
        });
      }
      return prev.map((r) =>
        r.id === id ? { ...r, status: 'complete' as const, description: 'Finished' } : r,
      );
    }
    case 'skill': {
      const id = pairId('skill', payload.iteration, payload.name, payload.runId);
      if (payload.phase === 'start') {
        return append(completeActive(prev), {
          id,
          type: 'skill',
          label: `Skill: ${payload.name}`,
          description: 'Executing…',
          status: 'active',
        });
      }
      return prev.map((r) =>
        r.id === id ? { ...r, status: 'complete' as const, description: 'Finished' } : r,
      );
    }
    case 'skill_tool': {
      const id = pairId(
        'skill_tool',
        payload.iteration,
        `${payload.skill}/${payload.tool}`,
        payload.runId
      );
      if (payload.phase === 'start') {
        return append(completeActive(prev), {
          id,
          type: 'skill_tool',
          label: `${payload.skill} → ${payload.tool}`,
          description: 'Calling tool…',
          status: 'active',
        });
      }
      return prev.map((r) =>
        r.id === id ? { ...r, status: 'complete' as const, description: 'Done' } : r,
      );
    }
    case 'memory_write': {
      const id = pairId('mem', payload.iteration, 'write', payload.runId);
      if (payload.phase === 'start') {
        return append(completeActive(prev), {
          id,
          type: 'memory',
          label: 'Memory write',
          description: 'Writing…',
          status: 'active',
        });
      }
      return prev.map((r) =>
        r.id === id ? { ...r, status: 'complete' as const } : r,
      );
    }
    case 'profile_write': {
      const id = pairId('prof', payload.iteration, payload.target ?? 'profile', payload.runId);
      if (payload.phase === 'start') {
        return append(completeActive(prev), {
          id,
          type: 'profile',
          label: 'Profile update',
          description: payload.target ? `Target: ${payload.target}` : undefined,
          status: 'active',
        });
      }
      return prev.map((r) =>
        r.id === id ? { ...r, status: 'complete' as const } : r,
      );
    }
    case 'sub_delegate': {
      const id = `subdeleg:${payload.runId}:${payload.subRunId}:${payload.phase}`;
      if (payload.phase === 'start') {
        return append(completeActive(prev), {
          id,
          type: 'sub_delegate',
          label: 'Sub-agent',
          description: `Isolated session ${payload.subSessionId}`,
          status: 'active',
        });
      }
      const o = payload.outcome;
      const tail =
        o === 'cancelled'
          ? 'Cancelled'
          : o === 'timed_out'
            ? 'Timed out'
            : o === 'max_iterations'
              ? 'Iteration limit'
              : o === 'complete'
                ? 'Complete'
                : 'Ended';
      return prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'complete' as const,
              description: `Delegated run ${tail}`,
            }
          : r,
      );
    }
    case 'run_done': {
      const labels = runDoneLabel(payload.outcome);
      const done = append(completeActive(prev), {
        id: `done-${seq}`,
        type: 'done',
        label: labels.label,
        description: labels.description,
      });
      return done.map((r) =>
        r.status === 'active' ? { ...r, status: 'complete' as const } : r,
      );
    }
    default:
      return prev;
  }
}
