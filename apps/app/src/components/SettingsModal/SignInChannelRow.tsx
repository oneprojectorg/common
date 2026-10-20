'use client';

import { Button } from '@op/sense/Button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@op/sense/InputOTP';
import { cn } from '@op/sense/lib/utils';
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { useTranslations } from '@/lib/i18n';

import { type Confirmation, InlineConfirmation } from './InlineConfirmation';
import { cancelOnEscape } from './cancelOnEscape';
import {
  type ChannelValueError,
  type SignInChannel,
  formatChannelValue,
  validateChannelValue,
} from './signInChannels';

interface SignInChannelRowProps {
  channel: SignInChannel;
  value: string | null;
  otherValue: string | null;
  onSave: (value: string) => void;
  onRemove: () => void;
}

type EditMode = 'add' | 'change';

type Editor =
  | {
      step: 'enter';
      mode: EditMode;
      draft: string;
      error: ChannelValueError | null;
    }
  | {
      step: 'code';
      mode: EditMode;
      value: string;
      code: string;
      codeError: boolean;
      resent: boolean;
    }
  | { step: 'remove' };

const CODE_LENGTH = 6;

export const SignInChannelRow = ({
  channel,
  value,
  otherValue,
  onSave,
  onRemove,
}: SignInChannelRowProps) => {
  const t = useTranslations('settings');
  const tShared = useTranslations();
  const copy = useChannelCopy(channel);
  const descriptionId = useId();

  const [editor, setEditor] = useState<Editor | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const confirmationCount = useRef(0);

  // Add and Change share one slot so focus has somewhere to return when an inline flow closes
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (restoreFocus.current) {
      restoreFocus.current = false;
      primaryActionRef.current?.focus();
    }
  });

  const canRemove = Boolean(value && otherValue);
  // the other row can remove its channel mid-question; reset, since hiding would bring it back
  if (editor?.step === 'remove' && !canRemove) {
    setEditor(null);
  }
  const activeEditor = editor?.step === 'remove' && !canRemove ? null : editor;

  const confirm = (message: ReactNode, tone: Confirmation['tone']) => {
    confirmationCount.current += 1;
    setConfirmation({ id: confirmationCount.current, message, tone });
  };

  const close = () => {
    setEditor(null);
    restoreFocus.current = true;
  };

  const open = (mode: EditMode) => {
    setConfirmation(null);
    setEditor({
      step: 'enter',
      mode,
      draft: mode === 'change' ? (value ?? '') : '',
      error: null,
    });
  };

  const submitValue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (activeEditor?.step !== 'enter') {
      return;
    }

    const error = validateChannelValue(channel, activeEditor.draft, value);
    if (error) {
      setEditor({ ...activeEditor, error });
      return;
    }

    setEditor({
      step: 'code',
      mode: activeEditor.mode,
      value: formatChannelValue(channel, activeEditor.draft),
      code: '',
      codeError: false,
      resent: false,
    });
  };

  const submitCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (activeEditor?.step !== 'code') {
      return;
    }

    if (activeEditor.code.length !== CODE_LENGTH) {
      setEditor({ ...activeEditor, codeError: true });
      return;
    }

    // mock: any 6 digits pass until the API verifies them
    onSave(activeEditor.value);
    if (activeEditor.mode === 'add') {
      confirm(copy.added, 'success');
    } else if (channel === 'email') {
      // sent to the old address in case someone else changed it
      confirm(
        t.rich('emailUpdated', { email: value ?? '', value: isolateValue }),
        'success',
      );
    } else {
      confirm(t('phoneUpdated'), 'success');
    }
    close();
  };

  const confirmRemove = () => {
    if (!canRemove) {
      return;
    }

    onRemove();
    confirm(copy.removed, 'muted');
    close();
  };

  return (
    <FieldSet aria-describedby={descriptionId} className="min-w-0 gap-0">
      <FieldLegend variant="label" className="mb-0">
        {copy.title}
      </FieldLegend>
      <FieldDescription id={descriptionId}>{copy.hint}</FieldDescription>

      {activeEditor?.step === 'enter' ||
      activeEditor?.step === 'code' ? null : (
        <div className="mt-5 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span
            className={cn(
              'min-w-0 wrap-anywhere',
              !value && 'text-muted-foreground',
            )}
          >
            {value ? <bdi dir="ltr">{value}</bdi> : copy.empty}
          </span>
          {activeEditor?.step === 'remove' ? null : (
            <div className="flex items-center gap-2">
              {canRemove ? (
                <Button
                  variant="link"
                  onClick={() => {
                    setConfirmation(null);
                    setEditor({ step: 'remove' });
                  }}
                >
                  {tShared('Remove')}
                </Button>
              ) : null}
              <Button
                ref={primaryActionRef}
                variant="outline"
                onClick={() => open(value ? 'change' : 'add')}
              >
                {value ? t('changeAction') : tShared('Add')}
              </Button>
            </div>
          )}
        </div>
      )}

      {activeEditor?.step === 'enter' ? (
        <EnterValueStep
          channel={channel}
          editor={activeEditor}
          onDraftChange={(draft) =>
            setEditor({ ...activeEditor, draft, error: null })
          }
          onSubmit={submitValue}
          onCancel={close}
        />
      ) : null}

      {activeEditor?.step === 'code' ? (
        <EnterCodeStep
          channel={channel}
          editor={activeEditor}
          onCodeChange={(code) =>
            setEditor({ ...activeEditor, code, codeError: false })
          }
          onResend={() =>
            setEditor({ ...activeEditor, resent: true, codeError: false })
          }
          onSubmit={submitCode}
          onCancel={close}
        />
      ) : null}

      {activeEditor?.step === 'remove' && value ? (
        <ConfirmRemoveStep
          channel={channel}
          value={value}
          onConfirm={confirmRemove}
          onCancel={close}
        />
      ) : null}

      <InlineConfirmation
        confirmation={confirmation}
        onDismiss={() => setConfirmation(null)}
        className="not-empty:mt-2"
      />
    </FieldSet>
  );
};

const isolateValue = (chunks: ReactNode) => (
  <bdi dir="ltr" className="font-strong wrap-anywhere">
    {chunks}
  </bdi>
);

const useChannelCopy = (channel: SignInChannel) => {
  const t = useTranslations('settings');

  return channel === 'email'
    ? {
        title: t('signInEmailTitle'),
        hint: t('signInEmailHint'),
        empty: t('noEmail'),
        addLabel: t('emailInputLabel'),
        changeLabel: t('newEmailInputLabel'),
        placeholder: t('emailPlaceholder'),
        sendHint: t('emailSendHint'),
        removeAction: t('removeEmailAction'),
        added: t('emailAdded'),
        removed: t('emailRemoved'),
        errors: {
          required: t('emailRequiredError'),
          invalid: t('emailInvalidError'),
          unchanged: t('emailUnchangedError'),
        },
      }
    : {
        title: t('phoneTitle'),
        hint: t('phoneHint'),
        empty: t('noPhone'),
        addLabel: t('phoneInputLabel'),
        changeLabel: t('newPhoneInputLabel'),
        placeholder: t('phonePlaceholder'),
        sendHint: t('phoneSendHint'),
        removeAction: t('removePhoneAction'),
        added: t('phoneAdded'),
        removed: t('phoneRemoved'),
        errors: {
          required: t('phoneRequiredError'),
          invalid: t('phoneInvalidError'),
          unchanged: t('phoneUnchangedError'),
        },
      };
};

const EnterValueStep = ({
  channel,
  editor,
  onDraftChange,
  onSubmit,
  onCancel,
}: {
  channel: SignInChannel;
  editor: Extract<Editor, { step: 'enter' }>;
  onDraftChange: (draft: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) => {
  const t = useTranslations('settings');
  const copy = useChannelCopy(channel);
  const inputId = useId();
  const messageId = useId();

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      onKeyDown={cancelOnEscape(onCancel)}
      className="mt-4 flex flex-col gap-4"
    >
      <Field>
        <FieldLabel htmlFor={inputId}>
          {editor.mode === 'add' ? copy.addLabel : copy.changeLabel}
        </FieldLabel>
        <Input
          id={inputId}
          // replaces the button that opened it, so focus would otherwise be lost
          autoFocus
          type={channel === 'email' ? 'email' : 'tel'}
          autoComplete={channel === 'email' ? 'email' : 'tel'}
          placeholder={copy.placeholder}
          value={editor.draft}
          onChange={(event) => onDraftChange(event.target.value)}
          // prefilled: typing replaces it, a click drops into a typo fix
          onFocus={
            editor.mode === 'change'
              ? (event) => event.currentTarget.select()
              : undefined
          }
          aria-invalid={editor.error ? true : undefined}
          aria-describedby={messageId}
          className="sm:max-w-80"
        />
        {editor.error ? (
          <FieldError id={messageId}>{copy.errors[editor.error]}</FieldError>
        ) : (
          <FieldDescription id={messageId}>{copy.sendHint}</FieldDescription>
        )}
      </Field>
      <StepActions onCancel={onCancel} submitLabel={t('sendCodeAction')} />
    </form>
  );
};

// input-otp's REGEXP_ONLY_DIGITS, inlined to avoid a direct dependency (as in AuthPanel)
const DIGITS_ONLY_PATTERN = '^\\d+$';

const keepDigits = (pasted: string): string => pasted.replace(/\D/g, '');

const EnterCodeStep = ({
  channel,
  editor,
  onCodeChange,
  onResend,
  onSubmit,
  onCancel,
}: {
  channel: SignInChannel;
  editor: Extract<Editor, { step: 'code' }>;
  onCodeChange: (code: string) => void;
  onResend: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) => {
  const t = useTranslations('settings');
  const codeId = useId();
  const errorId = useId();

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      onKeyDown={cancelOnEscape(onCancel)}
      className="mt-4 flex flex-col gap-4"
    >
      <Field>
        {/* block: the label's default flex row would gap around the address in the sentence */}
        <FieldLabel htmlFor={codeId} className="block font-normal">
          {channel === 'email'
            ? t.rich('emailCodeLabel', {
                email: editor.value,
                value: isolateValue,
              })
            : t.rich('phoneCodeLabel', {
                phone: editor.value,
                value: isolateValue,
              })}
        </FieldLabel>
        <InputOTP
          id={codeId}
          autoFocus
          maxLength={CODE_LENGTH}
          pattern={DIGITS_ONLY_PATTERN}
          pasteTransformer={keepDigits}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={editor.code}
          onChange={onCodeChange}
          aria-invalid={editor.codeError ? true : undefined}
          aria-describedby={editor.codeError ? errorId : undefined}
        >
          {/* codes read LTR in every language */}
          <InputOTPGroup dir="ltr">
            {Array.from({ length: CODE_LENGTH }, (_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                aria-invalid={editor.codeError ? true : undefined}
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {editor.codeError ? (
          <FieldError id={errorId}>{t('codeIncompleteError')}</FieldError>
        ) : null}
        <FieldDescription>
          {t('resendPrompt')}{' '}
          <Button
            type="button"
            variant="link"
            size="inline"
            className="text-sm"
            onClick={onResend}
          >
            {t('resendCodeAction')}
          </Button>{' '}
          <span aria-live="polite">{editor.resent ? t('codeResent') : ''}</span>
        </FieldDescription>
      </Field>
      <StepActions onCancel={onCancel} submitLabel={t('confirmAction')} />
    </form>
  );
};

const ConfirmRemoveStep = ({
  channel,
  value,
  onConfirm,
  onCancel,
}: {
  channel: SignInChannel;
  value: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const t = useTranslations('settings');
  const tShared = useTranslations();
  const copy = useChannelCopy(channel);
  const questionId = useId();

  return (
    <div
      role="group"
      aria-labelledby={questionId}
      onKeyDown={cancelOnEscape(onCancel)}
      className="mt-4 flex flex-col gap-4"
    >
      <p id={questionId} className="text-sm text-muted-foreground">
        {channel === 'email'
          ? t.rich('removeEmailQuestion', { email: value, value: isolateValue })
          : t.rich('removePhoneQuestion', {
              phone: value,
              value: isolateValue,
            })}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        {/* the safe choice takes focus; the button that opened this is gone */}
        <Button variant="outline" autoFocus onClick={onCancel}>
          {tShared('Cancel')}
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          {copy.removeAction}
        </Button>
      </div>
    </div>
  );
};

const StepActions = ({
  onCancel,
  submitLabel,
}: {
  onCancel: () => void;
  submitLabel: string;
}) => {
  const tShared = useTranslations();

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>
        {tShared('Cancel')}
      </Button>
      <Button type="submit">{submitLabel}</Button>
    </div>
  );
};
