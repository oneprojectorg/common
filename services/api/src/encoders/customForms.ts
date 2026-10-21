import {
  customFormSchema,
  customFormSubmissionSchema,
  customFormWithPhaseSchema,
} from '@op/common/client';
import type { z } from 'zod';

/** Re-export the @op/common wire schemas so the API contract is co-located
 *  with the rest of the encoders the client consumes. */
export const customFormEncoder = customFormSchema;
export type CustomForm = z.infer<typeof customFormEncoder>;
export const customFormWithPhaseEncoder = customFormWithPhaseSchema;
export const customFormSubmissionEncoder = customFormSubmissionSchema;
