import { Organization } from '@op/api/encoders';

export type OrganizationListResponse = {
  items: Array<Organization>;
  next?: string | null;
  hasMore: boolean;
};
