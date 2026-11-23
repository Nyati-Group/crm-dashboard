'use client';

import { Fragment } from 'react';

/** Minimal, safe Markdown: **bold**, _italic_ and "- " bullets. Nothing is injected as HTML. */
export function Rich({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      ) : part.length > 2 && part.startsWith('_') && part.endsWith('_') ? (
        <em key={i} className="text-muted">
          {part.slice(1, -1)}
        </em>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
  return (
    <div className="space-y-1">
      {text.split('\n').map((l, i) => {
        if (!l.trim()) return <div key={i} className="h-1" />;
        const bullet = /^\s*[-*•]\s+/.test(l);
        return bullet ? (
          <div key={i} className="flex gap-2 pl-1">
            <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-brand2" />
            <span>{inline(l.replace(/^\s*[-*•]\s+/, ''))}</span>
          </div>
        ) : (
          <p key={i}>{inline(l)}</p>
        );
      })}
    </div>
  );
}
