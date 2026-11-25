import { getUser } from '@/utils/getUser';
import { isUserEmailOpStaff } from '@op/common';
import { notFound } from 'next/navigation';

// The layout, the page and `generateMetadata` render in parallel, so each one
// checks; `getUser` is request-cached, so the account loads once.
export const assertOpStaffViewer = async (): Promise<void> => {
  const user = await getUser();

  if (!user?.email || !isUserEmailOpStaff(user.email)) {
    notFound();
  }
};
