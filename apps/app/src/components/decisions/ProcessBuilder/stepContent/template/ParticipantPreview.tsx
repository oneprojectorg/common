'use client';

import type { ProposalTemplateSchema } from '@op/common/client';
import { FileDropZone } from '@op/sense/FileDropZone';
import { useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import { LabeledFieldSet } from '../../../forms/LabeledFieldSet';
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

      {/* Same chrome the editor gives its attachments section, so the preview
          reads as the participant's form rather than a lookalike. */}
      <div className="pointer-events-none mt-6 border-t pt-6">
        <LabeledFieldSet
          legend={t('Attachments (optional)')}
          description={t(
            'Support your proposal with relevant documents like budgets or supporting research.',
          )}
        >
          <FileDropZone onSelectFiles={() => {}} />
        </LabeledFieldSet>
      </div>
    </div>
  );
}
