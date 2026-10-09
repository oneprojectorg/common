'use client';

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from '@op/sense/Field';
import { Header3 } from '@op/sense/Header';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Switch } from '@op/sense/Switch';
import { useId } from 'react';

import { useTranslations } from '@/lib/i18n';
import { i18nConfig } from '@/lib/i18n/config';

import { localeDisplayNames, useLocaleSwitch } from '../LocaleChooser';
import { SignInChannelRow } from './SignInChannelRow';
import type {
  AccountSettings as AccountSettingsValues,
  AccountSettingsActions,
} from './useSettingsMockState';

type AccountSettingsProps = AccountSettingsValues & AccountSettingsActions;

/**
 * The Account tab: the two sign-in channels (each optional, at least one
 * required), two-step verification, and the interface language.
 */
export const AccountSettings = ({
  email,
  phone,
  twoStepEnabled,
  setChannel,
  removeChannel,
  setTwoStepEnabled,
}: AccountSettingsProps) => {
  const t = useTranslations('settings');
  const twoStepId = useId();
  const twoStepHintId = useId();
  const hasBothChannels = Boolean(email && phone);

  let twoStepHint = t('twoStepHint');
  if (!email) {
    twoStepHint = t('twoStepNeedsEmail');
  } else if (!phone) {
    twoStepHint = t('twoStepNeedsPhone');
  }

  return (
    <div className="flex flex-col gap-4">
      <Header3>{t('accountTab')}</Header3>
      <div className="flex flex-col gap-6">
        <SignInChannelRow
          channel="email"
          value={email}
          otherValue={phone}
          onSave={(value) => setChannel('email', value)}
          onRemove={() => removeChannel('email')}
        />
        <SignInChannelRow
          channel="phone"
          value={phone}
          otherValue={email}
          onSave={(value) => setChannel('phone', value)}
          onRemove={() => removeChannel('phone')}
        />
        <Field orientation="horizontal" className="items-start gap-4">
          <FieldContent className="gap-0">
            <FieldLabel htmlFor={twoStepId}>{t('twoStepTitle')}</FieldLabel>
            <FieldDescription id={twoStepHintId}>
              {twoStepHint}
            </FieldDescription>
          </FieldContent>
          {/* Base UI's Switch renders a hidden <input> carrying the id, so the
              label associates with it. */}
          <Switch
            id={twoStepId}
            aria-describedby={twoStepHintId}
            checked={hasBothChannels && twoStepEnabled}
            disabled={!hasBothChannels}
            onCheckedChange={setTwoStepEnabled}
          />
        </Field>
        <LanguageField />
      </div>
    </div>
  );
};

const languageItems = i18nConfig.locales.map((locale) => ({
  value: locale,
  label: localeDisplayNames[locale],
}));

/**
 * Moved here from the old General tab. Unlike the rest of the modal this is
 * live: choosing a language reloads the page in it, as the header's globe
 * menu does.
 */
const LanguageField = () => {
  const t = useTranslations('settings');
  const { currentLocale, switchLocale } = useLocaleSwitch();
  const triggerId = useId();
  const descriptionId = useId();

  return (
    <Field className="gap-3 sm:flex-row sm:items-center sm:gap-4 sm:*:w-auto">
      <FieldContent className="gap-0">
        <FieldLabel htmlFor={triggerId}>{t('languageTitle')}</FieldLabel>
        <FieldDescription id={descriptionId}>
          {t('languageHint')}
        </FieldDescription>
      </FieldContent>
      <Select
        items={languageItems}
        value={currentLocale}
        onValueChange={(value) => {
          if (value) {
            switchLocale(value);
          }
        }}
      >
        <SelectTrigger
          id={triggerId}
          aria-describedby={descriptionId}
          className="w-full sm:w-auto sm:min-w-30"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {languageItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                <span lang={item.value}>{item.label}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
};
