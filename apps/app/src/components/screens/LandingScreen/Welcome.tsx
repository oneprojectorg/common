import type { CommonUser } from '@op/api/encoders';
import { Header1 } from '@op/sense/Header';
import { getTranslations } from 'next-intl/server';

/**
 * The landing headline. `isNew` comes from the page's `?new=1` search param
 * rather than a `useSearchParams()` hook so this stays on the server — nothing
 * here is interactive, and every key below is period-free, so the
 * dot-to-underscore lookup `useTranslations` applies is a no-op for them.
 */
export const Welcome = async ({
  user,
  isNew,
}: {
  user: CommonUser;
  isNew: boolean;
}) => {
  const t = await getTranslations();

  const orgName = user.currentProfile?.name;
  const name = orgName ? `, ${orgName}` : t(' to Common');

  return (
    <Header1 data-testid="welcome-heading" className="text-center">
      {isNew ? `${t('Welcome')}${name}!` : `${t('Welcome back')}${name}!`}
    </Header1>
  );
};
