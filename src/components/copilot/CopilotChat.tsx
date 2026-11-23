'use client';

import clsx from 'clsx';
import { ArrowUp, Check, Copy, Square, CalendarClock, ClipboardList, Hourglass, IndianRupee, Plus, Sparkles, Target, Wallet } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Rich } from './Rich';
import { useCopilot } from './useCopilot';

const SUGGESTIONS = [
  { icon: ClipboardList, title: 'Summary', q: 'Give me a summary of this year' },
  { icon: Target, title: 'Targets', q: 'How are we doing against the quarter targets?' },
  { icon: Wallet, title: 'Collection', q: 'What is the annual collection vs target?' },
  { icon: IndianRupee, title: 'Outstanding', q: 'What is the outstanding by age?' },
  { icon: Hourglass, title: 'Registration', q: 'How many units are unregistered, and for how long?' },
  { icon: CalendarClock, title: 'Timeline', q: 'When is the RERA completion, and how much time is left?' },
];

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: nothing to do */
        }
      }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted transition hover:bg-surface2 hover:text-ink"
      aria-label={done ? 'Copied' : 'Copy answer'}
    >
      {done ? <Check aria-hidden className="h-3.5 w-3.5 text-goodInk" /> : <Copy aria-hidden className="h-3.5 w-3.5" />}
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

/** Full-page AI Copilot: answers questions from the dashboard data via /api/chat (streamed). */
export function CopilotChat({ projectName, fy }: { projectName: string; fy: string | null }) {
  const { msgs, busy, ask, stop, reset } = useCopilot();
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  // grow the box with its text, up to about six lines
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [input]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    void ask(text);
    setInput('');
  };

  return (
    <section className="flex h-[calc(100dvh-62px)] min-h-[480px] flex-col">
      {/* bar */}
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[rgb(var(--header))] to-[rgb(var(--brand-2))] text-white shadow-sm">
          <Sparkles aria-hidden className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="truncate text-base font-semibold text-ink sm:text-lg">AI Copilot</h1>
          <p className="truncate text-xs text-muted">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-good align-middle" />
            Answers from the live dashboard data · {projectName}
            {fy ? ` · ${fy}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            reset();
            setInput('');
            inputRef.current?.focus();
          }}
          disabled={!msgs.length}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink2 transition hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus aria-hidden className="h-3.5 w-3.5" /> New chat
        </button>
      </header>

      {/* conversation */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-6 sm:px-6" aria-live="polite">
        {!msgs.length ? (
          <div className="mx-auto flex max-w-3xl flex-col items-center pt-4 text-center sm:pt-10">
            <span className="animate-pop flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[rgb(var(--header))] to-[rgb(var(--brand-2))] text-white shadow-lg">
              <Sparkles aria-hidden className="h-7 w-7" />
            </span>
            <h3 className="mt-4 text-xl font-semibold text-ink sm:text-2xl">How can I help with {projectName} today?</h3>
            <p className="mt-1.5 max-w-lg text-sm text-muted">Ask about sales, targets, collection, registration, outstanding or the project timeline. Answers use the same figures as the Overview.</p>
            <ul className="mt-6 grid w-full gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {SUGGESTIONS.map((s, i) => (
                <li key={s.title} className="animate-rise" style={{ animationDelay: `${120 + i * 60}ms` }}>
                  <button
                    type="button"
                    onClick={() => send(s.q)}
                    className="card-hover group flex h-full w-full items-start gap-3 rounded-xl border border-line bg-surface p-3.5 text-left"
                  >
                    <span className="rounded-lg bg-brand/10 p-2 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                      <s.icon aria-hidden className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-ink2">{s.title}</span>
                      <span className="mt-0.5 block text-sm text-ink">{s.q}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="mx-auto max-w-3xl space-y-5">
            {msgs.map((m, i) =>
              m.role === 'user' ? (
                <li key={i} className="animate-rise flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[rgb(var(--header))] px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">{m.content}</div>
                </li>
              ) : (
                <li key={i} className="animate-rise flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/nyati-logo.jpg" alt="" width={20} height={25} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      className={clsx(
                        'rounded-2xl rounded-tl-md border px-4 py-3 text-sm leading-relaxed shadow-sm',
                        m.error ? 'border-bad/30 bg-bad/5 text-badInk' : 'border-line bg-surface text-ink2',
                      )}
                    >
                      {m.content ? (
                        <Rich text={m.content} />
                      ) : (
                        <span className="inline-flex items-center gap-1.5 py-1 text-muted" aria-label="Copilot is thinking">
                          {[0, 1, 2].map((d) => (
                            <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand2" style={{ animationDelay: `${d * 150}ms` }} />
                          ))}
                          <span className="ml-1 text-xs">Reading the dashboard…</span>
                        </span>
                      )}
                    </div>
                    {m.content && !m.error && !(busy && i === msgs.length - 1) && (
                      <div className="mt-1 pl-1">
                        <CopyButton text={m.content} />
                      </div>
                    )}
                  </div>
                </li>
              ),
            )}
          </ol>
        )}
      </div>

      {/* composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="px-3 pb-4 pt-2 pr-20 sm:px-6 sm:pr-24"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-line bg-surface p-1.5 pl-4 shadow-lg shadow-[rgb(var(--header))]/5 transition focus-within:border-brand2 focus-within:ring-4 focus-within:ring-brand2/15">
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
            placeholder="Ask the copilot about sales, collection, outstanding…"
            aria-label="Your question"
            className="max-h-[168px] min-h-[40px] flex-1 resize-none bg-transparent py-2 text-sm text-ink outline-none placeholder:text-muted"
          />
          {busy ? (
            <button type="button" onClick={stop} aria-label="Stop answering" title="Stop" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-white transition hover:opacity-90">
              <Square aria-hidden className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send question"
              title="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--header))] text-white shadow-sm transition hover:opacity-90 disabled:opacity-35"
            >
              <ArrowUp aria-hidden className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-muted">
          <span className="hidden sm:inline">Enter to send · Shift + Enter for a new line · </span>The copilot answers only from this dashboard&apos;s data.
        </p>
      </form>
    </section>
  );
}
