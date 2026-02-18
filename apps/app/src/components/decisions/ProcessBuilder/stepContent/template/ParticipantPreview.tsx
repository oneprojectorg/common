'use client';

import { FileDropZone } from '@op/ui/FileDropZone';
import { useMemo } from 'react';
import { LuEye } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalFormRenderer } from '../../../proposalEditor/ProposalFormRenderer';
import {
  type ProposalTemplateSchema,
  compileProposalSchema,
} from '../../../proposalEditor/compileProposalSchema';
import type { ProposalDraftFields } from '../../../proposalEditor/useProposalDraft';
import type { ProposalTemplate } from '../../../proposalTemplate';

const EMPTY_DRAFT: ProposalDraftFields = {
  title: '',
  category: null,
  budget: null,
};

/**
 * Live participant preview panel shown alongside the template builder.
 *
 * Converts the builder's `ProposalTemplate` into compiled field descriptors
 * and renders them via `ProposalFormRenderer` in static preview mode — no
 * Yjs, TipTap, or collaboration providers are created.
 */
export function ParticipantPreview({
  template,
}: {
  template: ProposalTemplate;
}) {
  const t = useTranslations();

  const fields = useMemo(
    () => compileProposalSchema(template as ProposalTemplateSchema),
    [template],
  );

  return (
    <aside className="hidden flex-1 basis-1/2 overflow-y-auto border-l bg-neutral-offWhite p-14 xl:block">
      <div className="rounded-lg bg-white p-6">
        <div className="mb-6 flex items-center gap-2 text-sm text-neutral-500">
          <LuEye className="size-4" />
          <span>{t('Participant Preview')}</span>
        </div>

        <ProposalFormRenderer
          fields={fields}
          draft={EMPTY_DRAFT}
          onFieldChange={() => {}}
          t={t}
          previewMode
        />

        <div className="pointer-events-none border-t border-neutral-gray2 pt-8">
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
    </aside>
  );
}
