'use client';

import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { Separator } from '@op/sense/Separator';
import { Switch } from '@op/sense/Switch';

import { useTranslations } from '@/lib/i18n';

import { ToggleRow } from '@/components/layout/split/form/ToggleRow';

import { ChoiceList } from '../ChoiceList';
import { StepHeading } from '../StepHeading';
import { MIN_PROCESS_NAME_LENGTH } from '../content';
import type { Audience, Choice } from '../types';

const NAME_ID = 'process-name';
const NAME_HINT_ID = 'process-name-hint';
const AUDIENCE_LABEL_ID = 'process-audience-label';

const AUDIENCE_OPTIONS: Choice<Audience>[] = [
  {
    key: 'anyone',
    label: 'Open to the public',
    description:
      'Anyone can take part, or anyone meeting eligibility rules you set.',
  },
  {
    key: 'invite',
    label: 'Invite only',
    description: "Only people you invite. You'll add them before this opens.",
  },
];

/** Step 5 — the only two things the wizard needs before it can create anything. */
export function NameAccessStep({
  name,
  onNameChange,
  audience,
  onAudienceChange,
  submissionsPrivate,
  onSubmissionsPrivateChange,
}: {
  name: string;
  onNameChange: (name: string) => void;
  audience: Audience;
  onAudienceChange: (audience: Audience) => void;
  submissionsPrivate: boolean;
  onSubmissionsPrivateChange: (value: boolean) => void;
}) {
  const t = useTranslations();
  const trimmed = name.trim();
  const isNameTooShort =
    trimmed.length > 0 && trimmed.length < MIN_PROCESS_NAME_LENGTH;

  return (
    <div className="flex flex-col gap-6">
      <StepHeading title={t('Name it and set who can take part')} />

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

      <FieldSet>
        <FieldLegend id={AUDIENCE_LABEL_ID} variant="label">
          {t('Who can submit?')}
        </FieldLegend>
        {/* The legend names the fieldset; point the radio group at it too, so
            the group is named whichever of the two a screen reader reads. */}
        <ChoiceList
          idPrefix="process-audience"
          options={AUDIENCE_OPTIONS}
          value={audience}
          onChange={onAudienceChange}
          labelledBy={AUDIENCE_LABEL_ID}
        />
      </FieldSet>

      {/* A real rule, not a border on the row: ToggleRow is `rounded-xl`, so a
          `border-t` follows its corners and reads as half a box. */}
      <Separator />

      {/* ToggleRow owns the id/aria wiring between the label and the Switch. */}
      <ToggleRow
        label={t('Make submissions private')}
        description={t('Only admins and reviewers can see submissions.')}
      >
        <Switch
          checked={submissionsPrivate}
          onCheckedChange={onSubmissionsPrivateChange}
        />
      </ToggleRow>
    </div>
  );
}
