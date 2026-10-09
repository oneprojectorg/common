'use client';

import { Button } from '@op/sense/Button';
import { Header3, Header4 } from '@op/sense/Header';
import { OptionBox } from '@op/sense/OptionBox';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { useTranslations } from '@/lib/i18n';

import type { ParticipationMode, ProcessPrivacy } from './useSettingsMockState';

interface PrivacySettingsProps {
  processes: Array<ProcessPrivacy>;
  /** The name other participants see when the user shows it. */
  userName: string;
  setParticipationMode: (processId: string, mode: ParticipationMode) => void;
}

/**
 * The Privacy tab: for each process the user joined, whether other
 * participants see their name or a participant number. Change opens the two
 * choices inline.
 */
export const PrivacySettings = ({
  processes,
  userName,
  setParticipationMode,
}: PrivacySettingsProps) => {
  const t = useTranslations('settings');

  return (
    <div className="flex flex-col gap-4">
      <Header3>{t('privacyTab')}</Header3>
      <p>{t('privacyIntro')}</p>
      <div className="mt-3 flex flex-col divide-y">
        {processes.map((process) => (
          <ProcessPrivacyRow
            key={process.id}
            process={process}
            userName={userName}
            onSave={(mode) => setParticipationMode(process.id, mode)}
          />
        ))}
      </div>
    </div>
  );
};

const ProcessPrivacyRow = ({
  process,
  userName,
  onSave,
}: {
  process: ProcessPrivacy;
  userName: string;
  onSave: (mode: ParticipationMode) => void;
}) => {
  const t = useTranslations('settings');
  const tShared = useTranslations();
  const headingId = useId();
  const statusId = useId();
  const nameOptionId = useId();
  const anonymousOptionId = useId();

  // The chosen option while editing; `null` when the choices are closed.
  const [draft, setDraft] = useState<ParticipationMode | null>(null);

  // Focus moves into the choices when they open and back to Change when they
  // close, since each replaces the other.
  const changeRef = useRef<HTMLButtonElement>(null);
  const choicesRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<'choices' | 'change' | null>(null);
  useEffect(() => {
    if (pendingFocus.current === 'change') {
      changeRef.current?.focus();
    } else if (pendingFocus.current === 'choices') {
      choicesRef.current
        ?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
        ?.focus();
    }
    pendingFocus.current = null;
  });

  const close = () => {
    setDraft(null);
    pendingFocus.current = 'change';
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft) {
      onSave(draft);
    }
    close();
  };

  const strong = (chunks: ReactNode) => (
    <span className="font-strong text-foreground">{chunks}</span>
  );

  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 py-6 first:pt-0 last:pb-0"
    >
      <Header4 id={headingId}>{process.processName}</Header4>
      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        {/* Decorative: the organization's name is right beside it. */}
        <ProfileAvatar
          name={process.organizationName}
          alt=""
          size="sm"
          // The size has to carry the same variant as Avatar's own, or it
          // loses on specificity.
          className="data-[size=sm]:size-5"
        />
        <bdi>{process.organizationName}</bdi>
      </div>

      {draft ? (
        <form onSubmit={save} className="mt-5 flex flex-col gap-4">
          <RadioGroup
            ref={choicesRef}
            value={draft}
            onValueChange={(value) => {
              if (value === 'name' || value === 'anonymous') {
                setDraft(value);
              }
            }}
            aria-label={t('participationChoiceLabel', {
              process: process.processName,
            })}
            className="gap-4"
          >
            <OptionBox
              htmlFor={nameOptionId}
              control={<RadioGroupItem id={nameOptionId} value="name" />}
              label={t('showNameOption')}
              description={t('showNameHint')}
              className="rounded-xl p-4"
            />
            <OptionBox
              htmlFor={anonymousOptionId}
              control={
                <RadioGroupItem id={anonymousOptionId} value="anonymous" />
              }
              label={t('stayAnonymousOption')}
              description={t.rich('stayAnonymousHint', {
                number: process.participantNumber,
                strong,
              })}
              className="rounded-xl p-4"
            />
          </RadioGroup>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {tShared('Cancel')}
            </Button>
            <Button type="submit">{tShared('Save changes')}</Button>
          </div>
        </form>
      ) : (
        <div className="mt-5 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p id={statusId} className="min-w-0">
            {process.mode === 'anonymous' ? (
              t('participantLabel', { number: process.participantNumber })
            ) : (
              <bdi>{userName}</bdi>
            )}{' '}
            <span className="text-sm text-muted-foreground">
              {process.mode === 'anonymous'
                ? t('anonymousStatus')
                : t('nameShownStatus')}
            </span>
          </p>
          {/* Described by the status, so returning focus here after a save
              announces the new choice. */}
          <Button
            ref={changeRef}
            variant="outline"
            aria-describedby={statusId}
            onClick={() => {
              setDraft(process.mode);
              pendingFocus.current = 'choices';
            }}
          >
            {t('changeAction')}
          </Button>
        </div>
      )}
    </section>
  );
};
