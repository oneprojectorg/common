'use client';

import type { Organization } from '@op/api/encoders';

import { Link } from '@/lib/i18n';

import { OrganizationList } from '../OrganizationList';
import { TranslatedText } from '../TranslatedText';

export const NewOrganizationsContentClient = ({
  organizations,
}: {
  organizations: Array<Organization>;
}) => {
  return (
    <div className="flex flex-col gap-4">
      <OrganizationList organizations={organizations} />
      <div className="px-8 sm:px-0">
        <Link href="/org" className="text-teal">
          <TranslatedText text="See more" />
        </Link>
      </div>
    </div>
  );
};
