'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

export type Msg = { role: 'user' | 'assistant'; content: string; error?: boolean };

/** Explains a failed request in words a user can act on. */
function failureText(status: number): string {
  if (status === 401) return 'Your session has ended. Please reload the page and sign in again.';
  if (status === 429) return 'You are asking a little too fast. Please wait a minute and try again.';
  if (status === 503) return 'The copilot is not set up on this server yet. Please contact the dashboard admin.';
  return 'Sorry, the copilot could not answer just now. Please try again.';
}

/**
 * Conversation state for the AI Copilot: sends the history to /api/chat and streams the
 * answer into the last message. `stop` aborts a running answer; `reset` starts a new chat.
 */
export function useCopilot() {
  const sp = useSearchParams();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const ask = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      const history: Msg[] = [...msgs.filter((m) => !m.error), { role: 'user', content: q }];
      setMsgs([...msgs, { role: 'user', content: q }, { role: 'assistant', content: '' }]);
      setBusy(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const setLast = (m: Msg) => setMsgs((all) => [...all.slice(0, -1), m]);
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })), sourceId: sp.get('ds') ?? undefined }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          setLast({ role: 'assistant', content: failureText(res.status), error: true });
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let acc = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          setLast({ role: 'assistant', content: acc });
        }
        if (!acc) setLast({ role: 'assistant', content: 'Sorry, I could not find an answer. Please try rephrasing.', error: true });
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          setMsgs((all) => {
            const last = all[all.length - 1];
            return last?.content ? [...all.slice(0, -1), { ...last, content: `${last.content}\n\n_(stopped)_` }] : [...all.slice(0, -1), { role: 'assistant', content: 'Stopped.', error: true }];
          });
        } else {
          const offline = typeof navigator !== 'undefined' && !navigator.onLine;
          setLast({ role: 'assistant', content: offline ? 'You appear to be offline. Check your connection and try again.' : 'Sorry, the connection was interrupted. Please try again.', error: true });
        }
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [busy, msgs, sp],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMsgs([]);
  }, []);

  return { msgs, busy, ask, stop, reset };
}
