import { createPhase, phaseDataSchema } from "@op/common";
import { db } from "@op/db/client";
import { z } from "zod";

import { authenticatedConfirmedProcedure, router } from "../../../trpcFactory";

const createPhaseOutputSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  processInstanceId: z.string(),
  sortOrder: z.number(),
  name: z.string(),
  slug: z.string(),
});

export const createPhaseRouter = router({
  createPhase: authenticatedConfirmedProcedure()
    .input(
      z.object({
        instanceId: z.uuid(),
        name: z.string().trim().min(1).max(256),
        sortOrder: z.number().int().min(0),
        data: phaseDataSchema,
      }),
    )
    .output(createPhaseOutputSchema)
    .mutation(async ({ ctx, input }) => {
      // The profile and the phase row commit together or not at all.
      const { phase, profile } = await db.transaction((tx) =>
        createPhase({
          user: ctx.user,
          processInstanceId: input.instanceId,
          name: input.name,
          sortOrder: input.sortOrder,
          data: input.data,
          db: tx,
        }),
      );

      return createPhaseOutputSchema.parse({
        id: phase.id,
        profileId: profile.id,
        processInstanceId: phase.processInstanceId,
        sortOrder: phase.sortOrder,
        name: profile.name,
        slug: profile.slug,
      });
    }),
});
