'use client';

import { useUser } from '@/utils/UserProvider';
import { LuCircleHelp } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

// Feature requests & support hub. Signed-in, non-anonymous users reach this from
// the avatar menu; this button surfaces the same link for logged-out visitors
// and anonymous accounts, who have no account menu to show it in.
const SUPPORT_URL =
  'https://oneprojectorg.notion.site/Common-Support-Hub-a9ef0b6622538269927c01e51045638b';

export const SupportLink = () => {
  const t = useTranslations();
  const { user } = useUser();

  // Non-anonymous signed-in users already have this link in their avatar menu.
  if (user && !user.isAnonymous) {
    return null;
  }

  return (
    <>
      <ButtonLink
        aria-label={t('Feature Requests & Support')}
        variant="outline"
        className="hidden sm:flex"
        size="icon"
        href={SUPPORT_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        <LuCircleHelp className="size-4" />
      </ButtonLink>
    </>
  );
};
