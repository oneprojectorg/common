import { createFileRoute } from '@tanstack/react-router';

import { redirect } from '@/lib/i18n';

export const Route = createFileRoute('/$locale/_main/admin/_dashboard/')({
  beforeLoad: ({ params }) =>
    redirect({ href: '/admin/users', locale: params.locale }),
});
