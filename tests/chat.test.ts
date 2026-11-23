import { describe, expect, it } from 'vitest';
import { buildKnowledge } from '@/lib/chat/knowledge';
import { localAnswer } from '@/lib/chat/local';
import { allow } from '@/lib/chat/rate-limit';
import { OUT_OF_SCOPE_REPLY } from '@/lib/chat/scope';
import { reconcileDataset } from '@/lib/data/reconcile';
import { cleanWorkbook, parseTabs } from './helpers';

const knowledge = buildKnowledge(reconcileDataset(parseTabs(cleanWorkbook())));

describe('assistant knowledge', () => {
  it('contains every dashboard section', () => {
    for (const h of ['Sales & collection summary', 'Project sales', 'Registration', 'Collection vs target', 'Collection summary', 'Outstanding by age', 'Project general information', 'Project summary']) {
      expect(knowledge).toContain(`## ${h}`);
    }
  });
});

describe('offline assistant answers', () => {
  it('answers dashboard questions from the matching section', () => {
    expect(localAnswer('How many units are unregistered?', knowledge)).toMatch(/\*\*Registration/);
    expect(localAnswer('outstanding by age', knowledge)).toMatch(/Outstanding by age/);
  });

  it('refuses anything outside the dashboard', () => {
    for (const q of ['What is the capital of France?', 'Tell me a joke', 'Write a python function']) {
      expect(localAnswer(q, knowledge)).toBe(OUT_OF_SCOPE_REPLY);
    }
  });
});

describe('rate limit', () => {
  it('allows N requests per minute per key, then blocks until the window passes', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(allow('test-key', 3, t0 + i)).toBe(true);
    expect(allow('test-key', 3, t0 + 10)).toBe(false);
    expect(allow('test-key', 3, t0 + 61_000)).toBe(true);
  });
});
