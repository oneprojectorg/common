import type { ReactNode } from 'react';

import { assertOpStaffViewer } from './assertOpStaffViewer';

export default async function InternalLayout({
  children,
}: {
  children: ReactNode;
}) {
  await assertOpStaffViewer();

  return <div className="flex w-full flex-col gap-8 p-8">{children}</div>;
}
