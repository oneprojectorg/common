'use client';

import type { ProposalTemplateSchema } from '@op/common/client';
import { viewerProseStyles } from '@op/ui/RichTextEditor';
import { useMemo } from 'react';

import { ProposalHtmlContent } from './ProposalHtmlContent';
import { compileProposalSchema } from './forms/proposal';
import type { FieldDescriptor } from './forms/types';

interface ProposalContentRendererProps {
  /** The proposal template schema (from processSchema or instanceData). */
  proposalTemplate: ProposalTemplateSchema;
  /** Pre-rendered HTML per fragment key (from getProposal). */
  htmlContent?: Record<string, string>;
}

/**
 * Template-aware proposal content renderer for read-only viewing.
 *
 * Uses {@link compileProposalSchema} to derive field descriptors from the
 * proposal template, then renders each dynamic field with its pre-rendered
 * HTML content. System fields (title, budget, category) are skipped here
 * — they are rendered by the parent layout (e.g. ProposalView header).
 */
export function ProposalContentRenderer({
  proposalTemplate,
  htmlContent,
}: ProposalContentRendererProps) {
  const dynamicFields = useMemo(() => {
    if (!proposalTemplate) {
      return [];
    }
    return compileProposalSchema(proposalTemplate).filter((f) => !f.isSystem);
  }, [proposalTemplate]);

  if (dynamicFields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8">
      {dynamicFields.map((field) => (
        <ViewField
          key={field.key}
          field={field}
          html={htmlContent?.[field.key]}
        />
      ))}
    </div>
  );
}

/**
 * Renders a single field in view mode: label + description chrome,
 * then the pre-rendered HTML content for that fragment.
 */
function ViewField({
  field,
  html,
}: {
  field: FieldDescriptor;
  html: string | undefined;
}) {
  const { schema } = field;

  return (
    <div className="flex flex-col gap-2">
      {(schema.title || schema.description) && (
        <div className="flex flex-col gap-2">
          {schema.title && (
            <span className="font-serif text-title-sm14 text-neutral-charcoal">
              {schema.title}
            </span>
          )}
          {schema.description && (
            <p className="text-sm text-neutral-charcoal">
              {schema.description}
            </p>
          )}
        </div>
      )}
      {html ? (
        <ProposalHtmlContent html={html} />
      ) : (
        <div className={viewerProseStyles}>
          <p className="text-neutral-gray3 italic">—</p>
        </div>
      )}
    </div>
  );
}
