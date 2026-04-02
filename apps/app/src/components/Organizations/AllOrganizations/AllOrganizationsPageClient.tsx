'use client';

import { EntityType } from '@op/api/encoders';

import { AllOrganizations } from '.';

type ProfileListResponse = {
  items: Array<any>;
  next?: string | null;
};

export default function AllOrganizationsPageClient(props: {
  limit?: number;
  initialData?: ProfileListResponse;
  types?: EntityType[];
}) {
  return <AllOrganizations {...props} />;
}
