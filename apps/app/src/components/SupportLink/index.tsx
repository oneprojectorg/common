'use client';

import { useUser } from '@/utils/UserProvider';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Button } from '@op/ui/Button';
import { IconButton } from '@op/ui/IconButton';
import { LuCircleHelp } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

// Feature requests & support hub. Signed-in, non-anonymous users reach this from
// the avatar menu; this button surfaces the same link for logged-out visitors
// and anonymous accounts, who have no account menu to show it in.
const SUPPORT_URL =
  'https://oneprojectorg.notion.site/Common-Support-Hub-a9ef0b6622538269927c01e51045638b';

export const SupportLink = () => {
  const t = useTranslations();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);
  const { user } = useUser();

  // Non-anonymous signed-in users already have this link in their avatar menu.
  if (user && !user.isAnonymous) {
    return null;
  }

  const openSupport = () => {
    window.open(SUPPORT_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <IconButton
        aria-label={t('Feature Requests & Support')}
        variant="outline"
        size="medium"
        className="hidden sm:flex"
        onPress={openSupport}
      >
        <LuCircleHelp className="size-4" />
      </IconButton>
      {isMobile ? (
        <Button
          color="neutral"
          unstyled
          variant="icon"
          aria-label={t('Feature Requests & Support')}
          className="flex size-8 items-center justify-center rounded-full bg-neutral-offWhite sm:hidden"
          onPress={openSupport}
        >
          <LuCircleHelp className="size-4" />
        </Button>
      ) : null}
    </>
  );
};
