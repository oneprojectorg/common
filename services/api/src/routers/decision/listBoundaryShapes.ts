import { listBoundaryShapes } from '@op/common';
import { list } from '@op/common/client';
import { z } from 'zod';

import { boundaryShapeEncoder } from '../../encoders/decision';
import { authenticatedProcedure, router } from '../../trpcFactory';

const listBoundaryShapesInputSchema = z.object({
  profileId: z.string().uuid(),
});

const listBoundaryShapesOutputSchema = list(boundaryShapeEncoder);

export const listBoundaryShapesRouter = router({
  // Returns the boundaries owned by the given decision profile so the editable
  // location picker can render the valid-area outline beneath the marker.
  // Mirrors `resolveBoundary`'s tier — only the picker (which already requires
  // a composing session, anonymous Supabase included) calls this. Scoping is
  // by `profileId` (== `processInstances.profileId`), and the caller must be
  // able to read that decision.
  listBoundaryShapes: authenticatedProcedure()
    .input(listBoundaryShapesInputSchema)
    .output(listBoundaryShapesOutputSchema)
    .query(async ({ ctx, input }) => {
      const boundaries = await listBoundaryShapes({
        user: ctx.user,
        profileId: input.profileId,
      });

      return { items: boundaries };
    }),
});
