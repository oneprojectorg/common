import { getProposal } from '@op/common';
import type { TranslatableEntry } from '@op/common';
import { translateBatch } from '@op/common';
import { DeepLClient } from 'deepl-node';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

export const translateProposalRouter = router({
  translateProposal: commonAuthedProcedure()
    .input(
      z.object({
        /** The proposal's profile ID (same as used in decision.getProposal) */
        profileId: z.uuid(),
        /** Target language code, e.g. "ES", "FR", "PT-BR" */
        targetLocale: z.string().min(2).max(10),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { profileId, targetLocale } = input;
      const { user } = ctx;

      // 1. Fetch proposal (includes proposalData with title, category, etc.)
      //    After the html-plan merge, this also includes htmlContent: Record<string, string>.
      const proposal = await getProposal({ profileId, user });

      // 2. Build translatable entries
      const entries: TranslatableEntry[] = [];
      const proposalId = proposal.id;
    proposal.htmlContent = { default:`<p>A proposal for a garden</p>` }
      const { proposalData } = proposal;

      // Plain text fields
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

      // HTML fragments from TipTap (available after html-plan merge)
      // proposal.htmlContent is the server-generated HTML (Record<string, string>)
      //
      // If htmlContent is not yet available (html-plan not merged), this section
      // will be empty and only title/category will be translated.
      if ('htmlContent' in proposal && proposal.htmlContent) {
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
        throw new Error('DEEPL_API_KEY is not configured');
      }

      const client = new DeepLClient(apiKey);
      const results = await translateBatch({
        entries,
        targetLocale: targetLocale.toUpperCase(),
        client,
        tagHandling: 'html',
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
