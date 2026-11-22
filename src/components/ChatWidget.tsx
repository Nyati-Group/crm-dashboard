'use client';

import clsx from 'clsx';
import { Send, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Fragment, useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'Give me a summary of this year',
  'What is the annual collection vs budget?',
  'How many units are unregistered?',
  'What is the outstanding by age?',
  'RERA completion date of Nyati Elenor?',
];

const GREETING: Msg = {
  role: 'assistant',
  content: 'Hi! I am the Nyati Sales assistant. Ask me anything about sales, collection, registration, outstanding or project details shown in this dashboard.',
};

/** Minimal, safe Markdown: **bold** and "- " bullets. */
function Rich({ text }: { text: string }) {
  const lines = text.split('\n');
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
    );
  return (
    <>
      {lines.map((l, i) => {
        const bullet = /^\s*[-*•]\s+/.test(l);
        if (!l.trim()) return <div key={i} className="h-1.5" />;
        return bullet ? (
          <div key={i} className="flex gap-1.5 pl-1">
            <span aria-hidden>•</span>
            <span>{inline(l.replace(/^\s*[-*•]\s+/, ''))}</span>
          </div>
        ) : (
          <p key={i}>{inline(l)}</p>
        );
      })}
    </>
  );
}

export function ChatWidget() {
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs, open]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history: Msg[] = [...msgs.filter((m) => m !== GREETING), { role: 'user', content: q }];
    setMsgs([...msgs, { role: 'user', content: q }, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history, sourceId: sp.get('ds') ?? undefined }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs((m) => [...m.slice(0, -1), { role: 'assistant', content: acc }]);
      }
      if (!acc) setMsgs((m) => [...m.slice(0, -1), { role: 'assistant', content: 'Sorry, I could not find an answer. Please try rephrasing.' }]);
    } catch {
      setMsgs((m) => [...m.slice(0, -1), { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label="Nyati assistant"
          className="fixed bottom-24 right-4 z-50 flex h-[min(600px,calc(100vh-8rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        >
          <header className="flex items-center gap-3 bg-[rgb(var(--header))] px-4 py-3 text-white">
            <span className="rounded-md bg-white p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/nyati-logo.jpg" alt="" width={22} height={27} />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-semibold">Nyati Assistant</p>
              <p className="text-xs text-white/70">Answers from the dashboard data</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded-md p-1.5 hover:bg-white/10">
              <X aria-hidden className="h-4 w-4" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-page px-3 py-3 text-sm" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={clsx(
                    'max-w-[85%] space-y-0.5 rounded-2xl px-3 py-2 leading-relaxed',
                    m.role === 'user' ? 'rounded-br-sm bg-brand text-[rgb(var(--brand-ink))]' : 'rounded-bl-sm border border-line bg-surface text-ink',
                  )}
                >
                  {m.content ? (
                    <Rich text={m.content} />
                  ) : (
                    <span className="inline-flex gap-1 py-1" aria-label="Thinking">
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d * 150}ms` }} />
                      ))}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {msgs.length === 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    className="rounded-full border border-brand/30 bg-surface px-2.5 py-1 text-xs text-brand hover:bg-brand/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
            className="flex items-end gap-2 border-t border-line bg-surface p-2"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void ask(input);
                }
              }}
              rows={1}
              placeholder="Ask about sales, collection, projects…"
              aria-label="Your question"
              className="max-h-28 min-h-[38px] flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand2 focus:ring-2 focus:ring-brand2/30"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="rounded-lg bg-brand p-2.5 text-[rgb(var(--brand-ink))] hover:opacity-90 disabled:opacity-40"
            >
              <Send aria-hidden className="h-4 w-4" />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close Nyati assistant' : 'Open Nyati assistant'}
        aria-expanded={open}
        className="fixed bottom-5 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[rgb(var(--header))] bg-white shadow-xl transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand2/40"
      >
        {open ? (
          <X aria-hidden className="h-6 w-6 text-[rgb(30_63_138)]" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/nyati-logo.jpg" alt="" width={30} height={37} />
        )}
      </button>
    </>
  );
}
