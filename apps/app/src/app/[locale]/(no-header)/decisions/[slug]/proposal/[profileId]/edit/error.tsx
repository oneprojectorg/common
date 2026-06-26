'use client';

import posthog from 'posthog-js';
import { useEffect } from 'react';

import { ProposalEditorError } from '@/components/decisions/proposalEditor/ProposalEditorError';

export default function EditProposalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    posthog.captureException(error, { error_digest: error.digest });
  }, [error]);

  return <ProposalEditorError />;
}
