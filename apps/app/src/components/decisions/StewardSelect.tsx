'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { useEffect, useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

type StewardOption = {
  id: string;
  name: string | null;
  avatarImage?: { name: string | null } | null;
};

const STEWARD_SELECT_ID = 'steward-select';
const STEWARD_HINT_ID = 'steward-select-hint';

/**
 * Picks which of the caller's identities stewards a process. Suspends, so a
 * consumer supplies the boundary.
 */
export const StewardSelect = ({
  stewardProfileId,
  onSelectionChange,
  currentSteward,
  label,
  description,
}: {
  stewardProfileId: string;
  onSelectionChange: (key: string) => void;
  /** Kept selectable even when it is no longer one of the caller's own. */
  currentSteward?: { id: string; name: string | null } | null;
  /** Defaults to the process builder's steward question. */
  label?: string;
  description?: string;
}) => {
  const t = useTranslations();
  const [{ items: userProfiles }] =
    trpc.account.getUserProfiles.useSuspenseQuery();

  const profileItems = useMemo(() => {
    const items: StewardOption[] = userProfiles.map((p) => ({
      id: p.id,
      name: p.name,
      avatarImage: p.avatarImage,
    }));
    if (currentSteward && !items.some((p) => p.id === currentSteward.id)) {
      items.push({ id: currentSteward.id, name: currentSteward.name ?? '' });
    }
    return items;
  }, [userProfiles, currentSteward]);

  const defaultProfileId = userProfiles[0]?.id;
  useEffect(() => {
    if (defaultProfileId && !stewardProfileId) {
      onSelectionChange(defaultProfileId);
    }
  }, [defaultProfileId, stewardProfileId, onSelectionChange]);

  return (
    <Field>
      <FieldLabel htmlFor={STEWARD_SELECT_ID}>
        {label ?? t('decisions.processBuilder.stewardQuestion')}{' '}
        <RequiredAsterisk />
      </FieldLabel>
      <Select
        required
        value={stewardProfileId || defaultProfileId || null}
        onValueChange={(value) => onSelectionChange(value as string)}
        items={Object.fromEntries(
          profileItems.map((profile) => [profile.id, profile.name ?? '']),
        )}
      >
        <SelectTrigger
          id={STEWARD_SELECT_ID}
          className="w-full"
          aria-describedby={description ? STEWARD_HINT_ID : undefined}
        >
          <SelectValue>
            {(value) => {
              const selected = profileItems.find((p) => p.id === value);
              return selected ? (
                <StewardIdentity profile={selected} />
              ) : (
                t('Select')
              );
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {profileItems.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                <StewardIdentity profile={profile} />
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {description ? (
        <FieldDescription id={STEWARD_HINT_ID}>{description}</FieldDescription>
      ) : null}
    </Field>
  );
};

function StewardIdentity({ profile }: { profile: StewardOption }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {/* Decorative: the name beside it already names the option. */}
      <ProfileAvatar
        name={profile.name}
        src={
          profile.avatarImage?.name
            ? getPublicUrl(profile.avatarImage.name)
            : undefined
        }
        alt=""
        size="sm"
      />
      <span className="truncate">{profile.name}</span>
    </span>
  );
}
