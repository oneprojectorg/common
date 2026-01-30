'use client';

import { useUser } from '@/utils/UserProvider';
import { Button } from '@op/ui/Button';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { RJSFProposalEditor } from '@/components/experimental/RJSFProposalEditor';

interface ProposalFormData {
  summary: string;
  description: string;
}

/**
 * Experimental page for testing the RJSF-based proposal editor.
 * Accessible at /en/experimental/proposal-editor
 */
export default function ExperimentalProposalEditorPage() {
  const t = useTranslations();
  const { user } = useUser();
  const [lastSubmittedData, setLastSubmittedData] =
    useState<ProposalFormData | null>(null);

  // Generate a unique doc ID for this session
  const docId = useMemo(() => {
    return `experimental-proposal-${crypto.randomUUID()}`;
  }, []);

  const handleSubmit = useCallback((data: ProposalFormData) => {
    console.log('Proposal submitted:', data);
    setLastSubmittedData(data);
  }, []);

  return (
    <div className="bg-neutral-white min-h-screen">
      {/* Header */}
      <header className="bg-neutral-white border-b border-neutral-gray2 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-charcoal">
              Experimental: RJSF Proposal Editor
            </h1>
            <p className="text-sm text-neutral-gray4">
              Testing schema-driven forms with collaborative rich text
            </p>
          </div>
          <Link href="/">
            <Button color="neutral" size="small">
              {t('Back to Home')}
            </Button>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="bg-neutral-white rounded-lg border border-neutral-gray2 p-6">
          <RJSFProposalEditor
            docId={docId}
            userName={user.profile?.name ?? 'Anonymous'}
            onSubmit={handleSubmit}
          />
        </div>

        {/* Debug output */}
        {lastSubmittedData && (
          <div className="mt-8 rounded-lg border border-neutral-gray2 bg-neutral-gray1 p-6">
            <h3 className="mb-4 text-sm font-medium text-neutral-charcoal">
              Last Submitted Data (Debug):
            </h3>
            <pre className="text-neutral-white overflow-auto rounded bg-neutral-charcoal p-4 text-xs">
              {JSON.stringify(lastSubmittedData, null, 2)}
            </pre>
          </div>
        )}

        {/* Info section */}
        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h3 className="mb-2 text-sm font-medium text-blue-800">
            About this experiment
          </h3>
          <ul className="space-y-1 text-sm text-blue-700">
            <li>
              - Uses react-jsonschema-form (RJSF) for schema-driven form
              rendering
            </li>
            <li>- Summary field: standard textarea widget</li>
            <li>
              - Description field: custom CollaborativeRichTextWidget with
              TipTap + Yjs
            </li>
            <li>
              - Each rich text field uses a separate Yjs fragment (via TipTap's
              `field` param)
            </li>
            <li>- Real-time collaboration enabled via TipTap Cloud</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
