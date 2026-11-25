import type { ReactNode } from 'react';

import { assertStaffViewer } from './assertStaffViewer';

export default async function InternalLayout({
  children,
}: {
  children: ReactNode;
}) {
  await assertStaffViewer();

  return <div className="flex w-full flex-col gap-8 p-8">{children}</div>;
}
