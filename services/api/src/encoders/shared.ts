import { z } from 'zod';

export const entityTermsEncoder = z.record(
  z.string(),
  z.array(
    z.object({
      termUri: z.string(),
      taxonomyUri: z.string(),
      id: z.string(),
      label: z.string(),
      facet: z.string().nullish(),
    }),
  ),
);

export type EntityTerms = z.infer<typeof entityTermsEncoder>;

// Minimal storage item encoder for avatar/image references where we only need id and name
export const storageItemMinimalEncoder = z.object({
  id: z.string(),
  name: z.string().nullable(),
});

export type StorageItemMinimal = z.infer<typeof storageItemMinimalEncoder>;
