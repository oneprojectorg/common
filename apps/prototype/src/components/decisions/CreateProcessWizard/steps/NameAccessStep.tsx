'use client';

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

import { useTranslations } from '@/lib/i18n';

import { PROTOTYPE_STEWARDS } from '@/components/prototype/fakeUser';

import { StepHeading } from '../StepHeading';
import { MIN_PROCESS_NAME_LENGTH } from '../content';

const NAME_ID = 'process-name';
const NAME_HINT_ID = 'process-name-hint';
const STEWARD_ID = 'process-steward';

/**
 * Step 5 — the two things that have to be true before a process can exist: what
 * it is called, and who is running it.
 *
 * Access used to be settled here too. It isn't any more: who can submit is a
 * property of the submissions phase, and asking about it before that phase has
 * a form or a window made it a guess. Submissions open to the public, and the
 * phase page is where that gets changed.
 */
export function NameAccessStep({
  name,
  onNameChange,
  steward,
  onStewardChange,
}: {
  name: string;
  onNameChange: (name: string) => void;
  steward: string;
  onStewardChange: (steward: string) => void;
}) {
  const t = useTranslations();
  const trimmed = name.trim();
  const isNameTooShort =
    trimmed.length > 0 && trimmed.length < MIN_PROCESS_NAME_LENGTH;

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
          aria-describedby={NAME_HINT_ID}
        />
        {/* Only once they have started typing: an untouched field being told
            off is noise. Announced, because nothing navigated. */}
        <FieldDescription id={NAME_HINT_ID} aria-live="polite">
          {isNameTooShort
            ? t('Use at least {count} characters.', {
                count: MIN_PROCESS_NAME_LENGTH,
              })
            : null}
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor={STEWARD_ID}>{t('Stewarded by')}</FieldLabel>
        <Select
          value={steward}
          onValueChange={(value) =>
            onStewardChange(typeof value === 'string' ? value : steward)
          }
          items={Object.fromEntries(
            PROTOTYPE_STEWARDS.map((option) => [option.name, option.name]),
          )}
        >
          <SelectTrigger id={STEWARD_ID} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PROTOTYPE_STEWARDS.map((option) => (
                <SelectItem key={option.id} value={option.name}>
                  <span className="flex min-w-0 items-center gap-2">
                    <ProfileAvatar
                      name={option.name}
                      alt={option.name}
                      size="sm"
                    />
                    <span className="truncate">{option.name}</span>
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
    </div>
  );
}
