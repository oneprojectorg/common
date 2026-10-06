import { createFileRoute } from '@tanstack/react-router';

import { notFound } from '@/lib/navigation';

/** Any path no other route claims renders the not-found screen in the app shell. */
export const Route = createFileRoute('/$locale/_main/$')({
  beforeLoad: () => notFound(),
});
