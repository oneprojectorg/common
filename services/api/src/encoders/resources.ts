// The resources wire contract is defined once as Zod schemas in @op/common
// (services/resources/schemas.ts), derived from the Drizzle tables via
// createSelectSchema. Re-export them here under the *Encoder names the routers'
// `.output()` expects, so the API contract and the service-layer DTOs share a
// single definition and can't drift.
export {
  attachmentSummarySchema as attachmentSummaryEncoder,
  collectionListSchema as collectionListEncoder,
  collectionSchema as collectionEncoder,
  resourceInCollectionSchema as resourceInCollectionEncoder,
  resourceListSchema as resourceListEncoder,
  resourceWithSignedUrlSchema as resourceWithSignedUrlEncoder,
} from '@op/common';
