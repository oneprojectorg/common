'use client';

import { RouterProvider } from 'react-aria-components';

import { useRouter } from '@/lib/i18n/routing';

export function ReactAriaRouterProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  return <RouterProvider navigate={router.push}>{children}</RouterProvider>;
}
