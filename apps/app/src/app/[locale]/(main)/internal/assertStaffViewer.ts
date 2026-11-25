import { getUser } from '@/utils/getUser';
import { isUserEmailStaff } from '@op/common';
import { notFound } from 'next/navigation';

// The layout, the page and `generateMetadata` render in parallel, so each one
// checks; `getUser` is request-cached, so the account loads once.
export const assertStaffViewer = async (): Promise<void> => {
  const user = await getUser();

  if (!user?.email || !isUserEmailStaff(user.email)) {
    notFound();
  }
};
