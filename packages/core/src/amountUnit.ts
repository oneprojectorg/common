import { z } from 'zod';

/**
 * The unit a numeric template field is counted in: a currency, or a custom
 * label such as "dots". Lives here because `@op/db` types the stored ballot
 * with it and cannot depend on `@op/common`, which owns the pricing logic.
 */

const CUSTOM_UNIT_LABEL_MAX_LENGTH = 40;

export const amountUnitSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('currency'), code: z.string().min(1) }),
  z.object({
    kind: z.literal('custom'),
    label: z.string().trim().min(1).max(CUSTOM_UNIT_LABEL_MAX_LENGTH),
  }),
]);

export type AmountUnit = z.infer<typeof amountUnitSchema>;
