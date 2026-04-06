import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';

import { getProposal } from '../decision/getProposal';
import { parseSchemaOptions } from '../decision/proposalDataSchema';
import type { ProposalTemplateSchema } from '../decision/types';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';
import {
  flattenTranslatableFields,
  unflattenTranslatedFields,
} from './translatedFields';

export type ProposalTranslation = {
  category?: string[];
} & Record<string, string | string[]>;

/**
 * Translates a proposal's content (title, category, HTML fragments) into the
 * target locale via DeepL with cache-through semantics.
 */
export async function translateProposal({
  profileId,
  targetLocale,
  user,
}: {
  profileId: string;
  targetLocale: SupportedLocale;
  user: User;
}): Promise<{
  translated: ProposalTranslation;
  sourceLocale: string;
  targetLocale: SupportedLocale;
}> {
  // 1. Fetch proposal (includes proposalData with title, category, etc.)
  const proposal = await getProposal({ profileId, user });

  // 2. Build translatable entries
  const entries: TranslatableEntry[] = [];
  const proposalId = proposal.id;
  const { proposalData } = proposal;

  // TODO: eventually use `htmlContent` for all fields
  entries.push(
    ...flattenTranslatableFields(`proposal:${proposalId}:`, {
      title: proposal.profile?.name,
      category: proposalData.category,
    }),
  );

  // HTML fragments from TipTap — proposal.htmlContent is the server-generated HTML (Record<string, string>)
  if (proposal.htmlContent) {
    const htmlContent = proposal.htmlContent as Record<string, string>;
    for (const [fragmentName, html] of Object.entries(htmlContent)) {
      if (html) {
        entries.push({
          contentKey: `proposal:${proposalId}:${fragmentName}`,
          text: html,
        });
      }
    }
  }

  // Template field titles and descriptions
  const template = proposal.proposalTemplate as ProposalTemplateSchema | null;
  if (template?.properties) {
    for (const [fieldKey, property] of Object.entries(template.properties)) {
      if (property.title) {
        entries.push({
          contentKey: `proposal:${proposalId}:field_title:${fieldKey}`,
          text: property.title,
        });
      }
      if (property.description) {
        entries.push({
          contentKey: `proposal:${proposalId}:field_desc:${fieldKey}`,
          text: property.description,
        });
      }

      // Dropdown option labels (oneOf or legacy enum)
      const options = parseSchemaOptions(property);
      for (const option of options) {
        if (option.title) {
          entries.push({
            contentKey: `proposal:${proposalId}:option:${fieldKey}:${option.value}`,
            text: option.title,
          });
        }
      }
    }
  }

  if (entries.length === 0) {
    return { translated: {}, sourceLocale: '', targetLocale };
  }

  // 3. Translate via DeepL with cache-through
  const results = await runTranslateBatch(entries, targetLocale);

  // 4. Build response — strip the "proposal:<id>:" prefix to get the field name back
  const { translated, sourceLocale } = unflattenTranslatedFields(
    `proposal:${proposalId}:`,
    results,
  );

  return {
    translated: translated as ProposalTranslation,
    sourceLocale,
    targetLocale,
  };
}
