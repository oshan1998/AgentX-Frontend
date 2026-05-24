import { useEffect, useState } from 'react';
import type { ServerMessage } from './protocol';
import { realtimeClient, type ConnectionStatus } from './wsClient';

export function useRealtime(): {
  status: ConnectionStatus;
  lastMessage: ServerMessage | null;
} {
  const [status, setStatus] = useState<ConnectionStatus>(realtimeClient.getStatus());
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);

  useEffect(() => {
    realtimeClient.acquire();
    const unsubStatus = realtimeClient.subscribeStatus(setStatus);
    const unsubMsg = realtimeClient.subscribeMessages((m) => setLastMessage(m));
    return () => {
      unsubMsg();
      unsubStatus();
      realtimeClient.release();
    };
  }, []);

  return { status, lastMessage };
}
