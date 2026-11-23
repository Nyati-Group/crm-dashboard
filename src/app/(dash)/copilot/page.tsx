import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CopilotChat } from '@/components/copilot/CopilotChat';
import { loadAllSources } from '@/lib/data/loader';

export const metadata: Metadata = {
  title: 'AI Copilot',
  description: 'Ask the Nyati AI Copilot about sales, targets, collection, registration, outstanding and the project timeline. Answers come from the live dashboard data.',
};

export default async function CopilotPage() {
  // same 60-second cache as the Overview, so this costs no extra sheet read
  const ok = (await loadAllSources().catch(() => [])).find((r) => r.status === 'ok');
  const projectName = ok?.status === 'ok' && ok.dataset.meta.projects.length ? ok.dataset.meta.projects.join(' · ') : 'Nyati Group';
  const fy = ok?.status === 'ok' ? ok.dataset.meta.fiscalYear : null;
  return (
    // the chat fills the whole content area: cancel the page padding of <main>
    <div className="-mx-4 -mb-6 -mt-5 sm:-mx-6">
      <Suspense>
        <CopilotChat projectName={projectName} fy={fy} />
      </Suspense>
    </div>
  );
}
