'use client';

import { getPublicUrl } from '@/utils';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Skeleton } from '@op/sense/Skeleton';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import { StepHeading } from '../StepHeading';
import { MAX_PROCESS_NAME_LENGTH, MIN_PROCESS_NAME_LENGTH } from '../content';

const NAME_ID = 'process-name';
const NAME_HINT_ID = 'process-name-hint';
const STEWARD_ID = 'process-steward';

/** Step 5 — what the process is called, and which identity fronts it. */
export function NameAccessStep({
  name,
  onNameChange,
  stewardProfileId,
  onStewardChange,
}: {
  name: string;
  onNameChange: (name: string) => void;
  stewardProfileId: string;
  onStewardChange: (profileId: string) => void;
}) {
  const t = useTranslations();
  const trimmed = name.trim();
  const isNameTooShort = trimmed.length < MIN_PROCESS_NAME_LENGTH;

  return (
    <div className="flex flex-col gap-6">
      <StepHeading title={t('Name it and say who is running it')} />

      <Field>
        <FieldLabel htmlFor={NAME_ID}>{t('Process name')}</FieldLabel>
        <Input
          id={NAME_ID}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={t('e.g. Neighborhood Grants 2026')}
          maxLength={MAX_PROCESS_NAME_LENGTH}
          aria-invalid={trimmed.length > 0 && isNameTooShort}
          aria-describedby={NAME_HINT_ID}
        />
        <FieldDescription id={NAME_HINT_ID} aria-live="polite">
          {isNameTooShort
            ? t('Use at least {count} characters.', {
                count: MIN_PROCESS_NAME_LENGTH,
              })
            : null}
        </FieldDescription>
      </Field>

      {/* Own boundary: a failed identities fetch drops the field rather than
          the name input, and the steward stays the acting profile. */}
      <APIErrorBoundary fallbacks={{ default: () => null }}>
        <Suspense fallback={<StewardFieldSkeleton />}>
          <StewardField
            stewardProfileId={stewardProfileId}
            onStewardChange={onStewardChange}
          />
        </Suspense>
      </APIErrorBoundary>
    </div>
  );
}

function StewardField({
  stewardProfileId,
  onStewardChange,
}: {
  stewardProfileId: string;
  onStewardChange: (profileId: string) => void;
}) {
  const t = useTranslations();
  const [profiles] = trpc.account.getUserProfiles.useSuspenseQuery(undefined);

  return (
    <Field>
      <FieldLabel htmlFor={STEWARD_ID}>{t('Stewarded by')}</FieldLabel>
      <Select
        value={stewardProfileId}
        onValueChange={(value) =>
          onStewardChange(typeof value === 'string' ? value : stewardProfileId)
        }
        items={Object.fromEntries(
          profiles.items.map((profile) => [profile.id, profile.name]),
        )}
      >
        <SelectTrigger id={STEWARD_ID} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {profiles.items.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                <span className="flex min-w-0 items-center gap-2">
                  <ProfileAvatar
                    name={profile.name}
                    src={
                      profile.avatarImage?.name
                        ? getPublicUrl(profile.avatarImage.name)
                        : undefined
                    }
                    alt={profile.name}
                    size="sm"
                  />
                  <span className="truncate">{profile.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <FieldDescription>
        {t('Shown on the process page as who is running it.')}
      </FieldDescription>
    </Field>
  );
}

function StewardFieldSkeleton() {
  return (
    <Field>
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-11 w-full" />
    </Field>
  );
}
