import { listBoundaryShapes } from '@op/common';
import { z } from 'zod';

import { boundaryShapeEncoder } from '../../encoders/decision';
import { authenticatedProcedure, router } from '../../trpcFactory';

const listBoundaryShapesOutputSchema = z.object({
  boundaries: z.array(boundaryShapeEncoder),
});

export const listBoundaryShapesRouter = router({
  // Returns every persisted decision boundary so the editable location picker
  // can render the valid-area outline beneath the marker. Mirrors
  // `resolveBoundary`'s tier — only the picker (which already requires a
  // composing session, anonymous Supabase included) calls this. Boundaries are
  // deployment-global, so no per-resource scope is needed in the input.
  listBoundaryShapes: authenticatedProcedure()
    .output(listBoundaryShapesOutputSchema)
    .query(async () => {
      const boundaries = await listBoundaryShapes();

      return { boundaries };
    }),
});
