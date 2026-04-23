import type { Locale } from '@/lib/i18n';
import { redirect } from '@/lib/i18n';

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  redirect({ href: '/admin/users', locale });
}
