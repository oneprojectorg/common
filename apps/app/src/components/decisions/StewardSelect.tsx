'use client';

import { trpc } from '@op/api/client';
import { Field, FieldLabel } from '@op/sense/Field';
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

/**
 * Picks which of the caller's identities stewards a process. Suspends, so a
 * consumer supplies the boundary.
 */
export const StewardSelect = ({
  stewardProfileId,
  onSelectionChange,
  currentSteward,
}: {
  stewardProfileId: string;
  onSelectionChange: (key: string) => void;
  /** Kept selectable even when it is no longer one of the caller's own. */
  currentSteward?: { id: string; name: string | null } | null;
}) => {
  const t = useTranslations();
  const [{ items: userProfiles }] =
    trpc.account.getUserProfiles.useSuspenseQuery();

  const profileItems = useMemo(() => {
    const items = userProfiles.map((p) => ({
      id: p.id,
      name: p.name,
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
      <FieldLabel htmlFor="steward-select">
        {t('decisions.processBuilder.stewardQuestion')} <RequiredAsterisk />
      </FieldLabel>
      <Select
        required
        value={stewardProfileId || defaultProfileId || null}
        onValueChange={(value) => onSelectionChange(value as string)}
        // base-ui Select.Value renders the raw value; pass the id→name map so
        // the trigger shows the steward's name, not their profile id.
        items={Object.fromEntries(
          profileItems.map((profile) => [profile.id, profile.name ?? '']),
        )}
      >
        <SelectTrigger id="steward-select" className="w-full">
          <SelectValue placeholder={t('Select')} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {profileItems.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
};
