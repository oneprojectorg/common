import { listOrganizationFilterTerms } from '@op/common';
import { z } from 'zod';

import { taxonomyTermsEncoder } from '../../encoders/taxonomyTerms';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

const termOptionSchema = taxonomyTermsEncoder.pick({ id: true, label: true });

const outputSchema = z.object({
  focusAreas: z.array(termOptionSchema),
  strategies: z.array(termOptionSchema),
});

export const listFilterTermsRouter = router({
  listFilterTerms: networkAuthenticatedProcedure()
    .output(outputSchema)
    .query(() => listOrganizationFilterTerms()),
});
