export interface ChatRequest {
  message: string;
  sessionId: string;
  runId: string;
  attachmentPaths?: string[];
}

export interface ChatResponse {
  response?: string;
  error?: string;
}

export async function sendChat(
  request: ChatRequest,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: request.message,
      sessionId: request.sessionId,
      runId: request.runId,
      ...(request.attachmentPaths?.length
        ? { attachmentPaths: request.attachmentPaths }
        : {}),
    }),
    signal,
  });

  const data = (await res.json().catch(() => ({}))) as ChatResponse;
  if (!res.ok) {
    throw new Error(data.error || `Chat failed (${res.status})`);
  }
  return data;
}
