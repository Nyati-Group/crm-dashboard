'use client';

import clsx from 'clsx';
import { ArrowUp, Maximize2, RotateCcw, Square, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Rich } from './Rich';
import { useCopilot } from './useCopilot';

const SUGGESTIONS = ['Give me a summary of this year', 'What is the annual collection vs target?', 'How many units are unregistered?', 'What is the outstanding by age?'];

function Logo({ size }: { size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/nyati-logo.jpg" alt="" width={size} height={Math.round(size * 1.235)} />;
}

/**
 * Floating AI Copilot in the bottom-right corner of every page (Nyati logo as the button).
 * Same copilot as the AI Copilot tab.
 */
export function ChatBubble() {
  const { msgs, busy, ask, stop, reset } = useCopilot();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, open]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    void ask(text);
    setInput('');
  };

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label="Nyati AI Copilot"
          className="animate-rise fixed bottom-24 right-4 z-50 flex h-[min(600px,calc(100dvh-8rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl sm:right-6"
        >
          <header className="flex items-center gap-3 bg-gradient-to-r from-[rgb(var(--header))] to-[rgb(var(--brand-2))] px-4 py-3 text-white">
            <span className="rounded-lg bg-white p-1 shadow-sm">
              <Logo size={22} />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-semibold">Nyati AI Copilot</p>
              <p className="flex items-center gap-1.5 text-xs text-white/75">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" /> Answers from the dashboard data
              </p>
            </div>
            {msgs.length > 0 && (
              <button type="button" onClick={reset} aria-label="New chat" title="New chat" className="rounded-md p-1.5 text-white/85 hover:bg-white/10 hover:text-white">
                <RotateCcw aria-hidden className="h-4 w-4" />
              </button>
            )}
            <Link href="/copilot" aria-label="Open the AI Copilot page" title="Open full page" className="rounded-md p-1.5 text-white/85 hover:bg-white/10 hover:text-white">
              <Maximize2 aria-hidden className="h-4 w-4" />
            </Link>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close copilot" title="Close" className="rounded-md p-1.5 text-white/85 hover:bg-white/10 hover:text-white">
              <X aria-hidden className="h-4 w-4" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-page px-3 py-4 text-sm" aria-live="polite">
            <div className="flex gap-2">
              <span className="mt-0.5 h-fit shrink-0 rounded-md bg-white p-0.5 shadow-sm ring-1 ring-line">
                <Logo size={18} />
              </span>
              <div className="rounded-2xl rounded-tl-md border border-line bg-surface px-3 py-2 leading-relaxed text-ink2">
                Hi! I&apos;m the Nyati AI Copilot. Ask me about sales, targets, collection, registration, outstanding or the project timeline.
              </div>
            </div>
            {!msgs.length && (
              <div className="flex flex-wrap gap-1.5 pl-8">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-brand/25 bg-surface px-2.5 py-1 text-xs text-brand transition hover:bg-brand hover:text-white">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[rgb(var(--header))] px-3 py-2 leading-relaxed text-white">{m.content}</div>
                </div>
              ) : (
                <div key={i} className="flex gap-2">
                  <span className="mt-0.5 h-fit shrink-0 rounded-md bg-white p-0.5 shadow-sm ring-1 ring-line">
                    <Logo size={18} />
                  </span>
                  <div
                    className={clsx(
                      'min-w-0 max-w-[88%] rounded-2xl rounded-tl-md border px-3 py-2 leading-relaxed',
                      m.error ? 'border-bad/30 bg-bad/5 text-badInk' : 'border-line bg-surface text-ink2',
                    )}
                  >
                    {m.content ? (
                      <Rich text={m.content} />
                    ) : (
                      <span className="inline-flex gap-1 py-1" aria-label="Copilot is thinking">
                        {[0, 1, 2].map((d) => (
                          <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand2" style={{ animationDelay: `${d * 150}ms` }} />
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-line bg-surface p-2"
          >
            <div className="flex items-end gap-2 rounded-xl border border-line px-2.5 py-1 transition focus-within:border-brand2 focus-within:ring-2 focus-within:ring-brand2/20">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder="Ask about sales, collection…"
                aria-label="Your question"
                className="max-h-28 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-sm text-ink outline-none placeholder:text-muted"
              />
              {busy ? (
                <button type="button" onClick={stop} aria-label="Stop answering" title="Stop" className="mb-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white hover:opacity-90">
                  <Square aria-hidden className="h-3 w-3 fill-current" />
                </button>
              ) : (
                <button type="submit" disabled={!input.trim()} aria-label="Send question" title="Send" className="mb-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--header))] text-white hover:opacity-90 disabled:opacity-35">
                  <ArrowUp aria-hidden className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close Nyati AI Copilot' : 'Open Nyati AI Copilot'}
        aria-expanded={open}
        title={open ? 'Close copilot' : 'Ask the Nyati AI Copilot'}
        className="group fixed bottom-5 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[rgb(var(--header))] bg-white shadow-xl transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand2/40 sm:right-6"
      >
        {!open && <span aria-hidden className="animate-pulse-ring absolute inset-0 rounded-full" />}
        {open ? <X aria-hidden className="h-6 w-6 text-[rgb(var(--header))]" /> : <Logo size={30} />}
      </button>
    </>
  );
}
