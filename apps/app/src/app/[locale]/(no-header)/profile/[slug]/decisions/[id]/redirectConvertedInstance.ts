import { createClient } from '@op/api/serverClient';

import { type Locale, redirect } from '@/lib/i18n';

/**
 * Sends a legacy decision link to `/decisions/[slug]{path}` once its instance
 * has been converted to the current shape. A legacy, missing or unreadable
 * instance falls through, so the legacy page renders as before.
 */
export const redirectConvertedInstance = async ({
  instanceId,
  locale,
  path = '',
}: {
  instanceId: string;
  locale: Locale;
  path?: string;
}) => {
  const slug = await getConvertedInstanceSlug(instanceId);

  if (slug) {
    redirect({ href: `/decisions/${slug}${path}`, locale });
  }
};

const getConvertedInstanceSlug = async (instanceId: string) => {
  try {
    const client = await createClient();
    const { slug } = await client.decision.getConvertedInstanceSlug({
      instanceId,
    });
    return slug;
  } catch {
    // The API logs the failure; the legacy page still renders.
    return null;
  }
};
