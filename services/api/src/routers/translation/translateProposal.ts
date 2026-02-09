import { CommonError, SUPPORTED_TARGET_LOCALES, getProposal } from '@op/common';
import type { TranslatableEntry } from '@op/common';
import { translateBatch } from '@op/common';
import { DeepLClient } from 'deepl-node';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

/**
 * Generic output schema for all translation endpoints.
 * Returns a map of field names to translated text, plus locale metadata.
 */
export const translateOutput = z.object({
  translated: z.record(z.string(), z.string()),
  sourceLocale: z.string(),
  targetLocale: z.enum(SUPPORTED_TARGET_LOCALES),
});

export const translateProposalRouter = router({
  translateProposal: commonAuthedProcedure()
    .input(
      z.object({
        profileId: z.uuid(),
        targetLocale: z.enum(SUPPORTED_TARGET_LOCALES),
      }),
    )
    .output(translateOutput)
    .mutation(async ({ input, ctx }) => {
      const { profileId, targetLocale } = input;
      const { user } = ctx;

      // 1. Fetch proposal (includes proposalData with title, category, etc.)
      const proposal = await getProposal({ profileId, user });

      // 2. Build translatable entries
      const entries: TranslatableEntry[] = [];
      const proposalId = proposal.id;
      const { proposalData } = proposal;

      // TODO: eventually use `htmlContent` for all fields
      if (proposalData.title) {
        entries.push({
          contentKey: `proposal:${proposalId}:title`,
          text: proposalData.title,
        });
      }

      if (proposalData.category) {
        entries.push({
          contentKey: `proposal:${proposalId}:category`,
          text: proposalData.category,
        });
      }

      // HTML fragments from TipTap proposal.htmlContent is the server-generated HTML (Record<string, string>)
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

      if (entries.length === 0) {
        return { translated: {}, sourceLocale: '', targetLocale };
      }

      // 3. Translate via DeepL with cache-through
      const apiKey = process.env.DEEPL_API_KEY;
      if (!apiKey) {
        throw new CommonError('DEEPL_API_KEY is not configured');
      }

      const client = new DeepLClient(apiKey);
      const results = await translateBatch({
        entries,
        targetLocale: targetLocale.toUpperCase(),
        client,
      });

      // 4. Build response as Record<string, string>
      // Strip the "proposal:<id>:" prefix to get the field name back
      const prefix = `proposal:${proposalId}:`;
      const translated: Record<string, string> = {};
      let sourceLocale = '';

      for (const result of results) {
        const fieldName = result.contentKey.startsWith(prefix)
          ? result.contentKey.slice(prefix.length)
          : result.contentKey;
        translated[fieldName] = result.translatedText;

        if (!sourceLocale && result.sourceLocale) {
          sourceLocale = result.sourceLocale;
        }
      }

      return { translated, sourceLocale, targetLocale };
    }),
});
