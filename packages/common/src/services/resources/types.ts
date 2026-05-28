export const RESOURCE_LIST_DEFAULT_LIMIT = 50;
export const RESOURCE_LIST_MAX_LIMIT = 200;

export type AttachmentSummary = {
  storageObjectId: string;
  fileName: string;
  mimeType: string;
  fileSize: number | null;
};

type ResourceBase = {
  id: string;
  title: string;
  description: string | null;
  addedByProfileId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  signedUrl: string | null;
};

type LinkResourceDTO = ResourceBase & {
  type: 'link';
  linkUrl: string;
  attachmentId: null;
  attachment: null;
};

type DocumentResourceDTO = ResourceBase & {
  type: 'document';
  linkUrl: null;
  attachmentId: string;
  attachment: AttachmentSummary;
};

export type ResourceDTO = LinkResourceDTO | DocumentResourceDTO;

export type ResourceInCollectionDTO = ResourceDTO & {
  collectionId: string;
  sortKey: string;
};

export type ResourceListResult = {
  collectionId: string | null;
  items: ResourceInCollectionDTO[];
  next: string | null;
};

export type CollectionDTO = {
  id: string;
  name: string;
  sortKey: string;
  addedByProfileId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CollectionListResult = {
  items: CollectionDTO[];
  next: string | null;
};
