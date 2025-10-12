import { z } from 'zod';

export const geoNamesDataSchema = z
  .object({
    toponymName: z.string(),
    name: z.string(),
    lat: z.number(),
    lng: z.number(),
    geonameId: z.number(),
    countryCode: z.string(),
    countryName: z.string(),
    fcl: z.string(),
    fcode: z.string(),
  })
  .partial();

export const whereWeWorkSchema = z.object({
  id: z.string(),
  label: z.string(),
  data: z.record(z.string(), z.any()),
});

export const baseOrganizationSchema = z.object({
  slug: z.string(),
  email: z.email(),
  name: z.string(),
  bio: z.string(),
  orgType: z.string(),
  isOfferingFunds: z.boolean(),
  isReceivingFunds: z.boolean(),
  website: z.string(),
  mission: z.string(),
  networkOrganization: z.boolean(),
  acceptingApplications: z.boolean(),
  headerImageId: z.string(),
  avatarImageId: z.string(),
  whereWeWork: z.array(whereWeWorkSchema),
  strategies: z.array(
    z.object({
      id: z.string(),
    }),
  ),
  focusAreas: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
    }),
  ),
  receivingFundsTerms: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
      }),
    )
    .optional(),
  offeringFundsTerms: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
      }),
    )
    .optional(),
  communitiesServed: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
    }),
  ),
});

export const organizationInputSchema = baseOrganizationSchema
  .extend({
    // name: z.string().optional(),
    // bio: z.string().optional(),
    isOfferingFunds: z.boolean().optional(),
    isReceivingFunds: z.boolean().optional(),
    // website: z.string().optional(),
    // mission: z.string().optional(),
    networkOrganization: z.boolean().optional(),
    acceptingApplications: z.boolean().optional(),

    // TODO: redundant. Pausing to remove while running tests
    communitiesServed: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
        }),
      )
      .optional(),
  })
  .strip()
  .partial();

export const updateOrganizationInputSchema = baseOrganizationSchema
  .omit({ slug: true })
  .partial();

export const fundingLinksInputSchema = z
  .object({
    receivingFundsDescription: z.string().optional(),
    receivingFundsLink: z
      .url({
        error: 'Enter a valid website address',
      })
      .optional(),
    receivingFundsTerms: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
        }),
      )
      .optional(),
    offeringFundsDescription: z.string().optional(),
    offeringFundsLink: z
      .url({
        error: 'Enter a valid website address',
      })
      .optional(),
  })
  .partial();

export type OrganizationInput = z.infer<typeof organizationInputSchema>;
export type UpdateOrganizationInput = z.infer<
  typeof updateOrganizationInputSchema
>;
export type FundingLinksInput = z.infer<typeof fundingLinksInputSchema>;

export const OrganizationInputParser = organizationInputSchema.transform(
  (data: OrganizationInput) => {
    // Remove keys with undefined values
    return Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined),
    ) as OrganizationInput;
  },
);

export const UpdateOrganizationInputParser =
  updateOrganizationInputSchema.transform((data: UpdateOrganizationInput) => {
    // Remove keys with undefined values
    return Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined),
    ) as UpdateOrganizationInput;
  });
