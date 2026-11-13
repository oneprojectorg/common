import { createClient } from '@op/api/serverClient';

import { type Locale, redirect } from '@/lib/i18n';

/**
 * Sends a legacy decision link to its current route once its instance has been
 * converted to the current shape; `href` builds that route from the decision
 * slug. A legacy, missing or unreadable instance falls through, so the legacy
 * page renders as before.
 */
export const redirectConvertedInstance = async ({
  instanceId,
  locale,
  href,
}: {
  instanceId: string;
  locale: Locale;
  href: (decisionSlug: string) => string;
}) => {
  const decisionSlug = await getConvertedInstanceSlug(instanceId);

  if (decisionSlug) {
    redirect({ href: href(decisionSlug), locale });
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
