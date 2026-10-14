'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { Button } from '@op/sense/Button';
import { Header2 } from '@op/sense/Header';
import { useEffect, useState } from 'react';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { UpdateProfileModal } from '@/components/Profile/ProfileDetails/UpdateProfile/UpdateProfileModal';

/**
 * Nudges a person whose profile is still bare — no avatar and no headline —
 * to fill it in (Figma 21477:62250). Dismissal is remembered per profile in
 * this browser only; it is a nudge, not a task.
 */
export const SetUpProfilePrompt = () => {
  const t = useTranslations('shell');
  const { user } = useRequiredUser();
  const profile = user.profile;
  // null until localStorage has been read, so the prompt never flashes in
  // for someone who already dismissed it.
  const [isDismissed, setIsDismissed] = useState<boolean | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!profile) {
      return;
    }
    try {
      setIsDismissed(
        window.localStorage.getItem(dismissKey(profile.id)) === '1',
      );
    } catch {
      setIsDismissed(false);
    }
  }, [profile]);

  const isBare = profile && !profile.avatarImage && !profile.bio;

  // An avatar upload un-bares the profile mid-edit; unmounting would drop edits
  if (!profile || isDismissed !== false || (!isBare && !isEditing)) {
    return null;
  }

  const dismiss = () => {
    setIsDismissed(true);
    try {
      window.localStorage.setItem(dismissKey(profile.id), '1');
    } catch {
      // Storage blocked: the prompt stays hidden for this visit only.
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-background p-6 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex flex-1 flex-col gap-2">
        <Header2 className="font-sans text-base font-strong">
          {t('setUpProfileHeading')}
        </Header2>
        <p className="text-muted-foreground">{t('setUpProfileBody')}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => setIsEditing(true)}>
          {t('setUpProfileAction')}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={dismiss}
          aria-label={t('dismissSetUpProfileLabel')}
        >
          <LuX />
        </Button>
      </div>
      <UpdateProfileModal isOpen={isEditing} setIsOpen={setIsEditing} />
    </section>
  );
};

const dismissKey = (profileId: string) =>
  `home:setUpProfilePromptDismissed:${profileId}`;
