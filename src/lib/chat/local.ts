/**
 * Offline answers for the dashboard assistant, used when the Claude API is not configured or
 * unreachable: picks the knowledge sections that best match the question.
 */
import { GREETING_RE, GREETING_REPLY, OUT_OF_SCOPE_REPLY } from './scope';

const TOPICS: { section: RegExp; words: RegExp }[] = [
  { section: /^## Sales & collection summary: .*quarter/i, words: /\b(quarter|q1|apr|april|june|jun|quarterly)/i },
  { section: /^## Sales & collection summary: .*full financial year/i, words: /\b(annual|fy|yearly|full year|this year|ytd)/i },
  { section: /^## Sales & collection summary/i, words: /\b(budget|actual|kpi|units? sold|sales value|area|rate|sq\.?ft|achiev|target|variance|performance|overview|summary)/i },
  { section: /^## Registration/i, words: /\b(regist|unregist|agreement|days since sale|120)/i },
  { section: /^## Project sales/i, words: /\b(project sales|target|booking|sold|units)/i },
  { section: /^## Collection vs budget/i, words: /\b(collect|budget)/i },
  { section: /^## Collection summary/i, words: /\b(due|milestone|collected|collection|outstanding|o\/s|receivable|sold value)/i },
  { section: /^## Outstanding by age/i, words: /\b(outstanding|ageing|aging|overdue|days|o\/s|receivable)/i },
  { section: /^## Project general information/i, words: /\b(rera|configuration|bhk|building|start date|completion|possession|saleable|project info)/i },
  { section: /^## Project summary/i, words: /\b(unsold|inventory|land owner|premium|for sale|average rate|rate|units)/i },
  { section: /^## Pages of the application/i, words: /\b(page|filter|refresh|export|csv|dashboard|navigate|what can you)/i },
];

export function localAnswer(question: string, knowledge: string): string {
  const q = question.trim();
  if (GREETING_RE.test(q)) return GREETING_REPLY;
  const sections = knowledge.split(/\n(?=## )/);
  const scored = TOPICS.map((t) => {
    const hits = (q.match(new RegExp(t.words.source, 'gi')) ?? []).length;
    return { t, hits };
  })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits);
  const picked: string[] = [];
  for (const { t } of scored) {
    for (const s of sections) if (t.section.test(s) && !picked.includes(s)) picked.push(s);
    if (picked.length >= 2) break;
  }
  if (picked.length === 0) return OUT_OF_SCOPE_REPLY;
  return picked.slice(0, 2).map(tidy).join('\n\n');
}

function tidy(section: string) {
  return section.replace(/^## (.*)$/m, '**$1**').trim();
}
