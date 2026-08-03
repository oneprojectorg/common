'use client';

import type { ProposalTemplateSchema } from '@op/common/client';
import { FileDropZone } from '@op/sense/FileDropZone';
import { useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import { compileProposalSchema } from '../../../forms/proposal';
import { ProposalFormRenderer } from '../../../proposalEditor/ProposalFormRenderer';
import type { ProposalDraftFields } from '../../../proposalEditor/useProposalDraft';

const EMPTY_DRAFT: ProposalDraftFields = {
  title: '',
  category: [],
  budget: null,
  location: null,
};

/**
 * Live participant preview of the proposal form.
 *
 * Converts the builder's `ProposalTemplateSchema` into compiled field descriptors
 * and renders them via `ProposalFormRenderer` in template preview mode — no
 * Yjs or collaboration providers are created. Container-agnostic: the caller
 * supplies the surface (side panel, modal, etc.).
 */
export function ParticipantPreview({
  template,
}: {
  template: ProposalTemplateSchema;
}) {
  const t = useTranslations();

  const fields = useMemo(() => compileProposalSchema(template), [template]);

  return (
    <div className="rounded-lg bg-white p-6">
      <ProposalFormRenderer
        fields={fields}
        draft={EMPTY_DRAFT}
        decisionProfileId={null}
        onFieldChange={() => {}}
        mode="preview-template"
      />

      <div className="pointer-events-none mt-4 border-t border-neutral-gray2 pt-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="font-serif text-title-sm14 text-neutral-charcoal">
              {t('Attachments (optional)')}
            </span>
            <p className="text-sm text-neutral-charcoal">
              {t(
                'Support your proposal with relevant documents like budgets or supporting research.',
              )}
            </p>
          </div>

          <FileDropZone onSelectFiles={() => {}} />
        </div>
      </div>
    </div>
  );
}
