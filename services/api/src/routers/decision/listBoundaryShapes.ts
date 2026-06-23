import { listBoundaryShapes } from '@op/common';
import { z } from 'zod';

import { boundaryShapeEncoder } from '../../encoders/decision';
import { authenticatedProcedure, router } from '../../trpcFactory';

const listBoundaryShapesInputSchema = z.object({
  profileId: z.string().uuid(),
});

const listBoundaryShapesOutputSchema = z.object({
  boundaries: z.array(boundaryShapeEncoder),
});

export const listBoundaryShapesRouter = router({
  // Returns the boundaries owned by the given decision profile so the editable
  // location picker can render the valid-area outline beneath the marker.
  // Mirrors `resolveBoundary`'s tier — only the picker (which already requires
  // a composing session, anonymous Supabase included) calls this. Scoping is
  // by `profileId` (== `processInstances.profileId`); access control to the
  // decision is enforced upstream on the proposal-write paths, so this
  // procedure does not re-authorize the caller against the profile.
  listBoundaryShapes: authenticatedProcedure()
    .input(listBoundaryShapesInputSchema)
    .output(listBoundaryShapesOutputSchema)
    .query(async ({ input }) => {
      const boundaries = await listBoundaryShapes({
        profileId: input.profileId,
      });

      return { boundaries };
    }),
});
