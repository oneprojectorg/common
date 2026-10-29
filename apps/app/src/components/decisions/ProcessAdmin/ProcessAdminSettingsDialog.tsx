'use client';

import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import {
  PROCESS_NAME_MAX_LENGTH,
  PROCESS_NAME_MIN_LENGTH,
} from '@op/common/client';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { OptionBox } from '@op/sense/OptionBox';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { toast } from '@op/sense/Toast';
import { useId, useState } from 'react';
import { LuCopy, LuGlobe, LuLock, LuSettings } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProcessAdminsPanel } from './ProcessAdminsPanel';

const SECTIONS = ['details', 'admins', 'visibility'] as const;
type SettingsSection = (typeof SECTIONS)[number];

const isSection = (value: unknown): value is SettingsSection =>
  SECTIONS.some((section) => section === value);

const PANEL_CLASSNAME = 'min-w-0 flex-1 overflow-y-auto p-6';

interface ProcessAdminSettingsDialogProps {
  slug: string;
  name: string;
  instance: ProcessInstance;
}

/** The live process's Settings: details, admins and visibility, each change saved as it is made. */
export function ProcessAdminSettingsDialog({
  slug,
  name,
  instance,
}: ProcessAdminSettingsDialogProps) {
  const t = useTranslations('decisions');
  const [section, setSection] = useState<SettingsSection>('details');
  const sectionLabels: Record<SettingsSection, string> = {
    details: t('processAdmin.detailsSection'),
    admins: t('processAdmin.adminsSection'),
    visibility: t('processAdmin.visibilitySection'),
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) {
          setSection('details');
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <LuSettings className="size-4" aria-hidden />
        {t('settingsAction')}
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-160">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{t('settingsAction')}</DialogTitle>
        </DialogHeader>
        <Tabs
          value={section}
          onValueChange={(value) => {
            if (isSection(value)) {
              setSection(value);
            }
          }}
          orientation="vertical"
          className="flex min-h-0 flex-col gap-0 sm:h-130 sm:flex-row"
        >
          <TabsList
            variant="sidebar"
            aria-label={t('processAdmin.settingsSectionsLabel')}
            className="w-full shrink-0 border-b p-2 sm:w-48 sm:border-e sm:border-b-0"
          >
            {SECTIONS.map((item) => (
              <TabsTrigger key={item} value={item}>
                {sectionLabels[item]}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="details" className={PANEL_CLASSNAME}>
            <DetailsSection slug={slug} name={name} instanceId={instance.id} />
          </TabsContent>
          <TabsContent value="admins" className={PANEL_CLASSNAME}>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {t('processAdmin.manageAdminsDescription')}
              </p>
              {instance.profileId ? (
                <ProcessAdminsPanel profileId={instance.profileId} />
              ) : null}
            </div>
          </TabsContent>
          <TabsContent value="visibility" className={PANEL_CLASSNAME}>
            <VisibilitySection
              slug={slug}
              instanceId={instance.id}
              isPrivate={Boolean(instance.instanceData.config?.isPrivate)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function useSaveInstance(slug: string) {
  const t = useTranslations('decisions.processAdmin');
  const utils = trpc.useUtils();

  return trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: async () => {
      await utils.decision.getDecisionBySlug.invalidate({ slug });
    },
    onError: (error) => {
      logger.error('Process settings save failed', { error });
      toast.error(t('saveError'));
    },
  });
}

function DetailsSection({
  slug,
  name,
  instanceId,
}: {
  slug: string;
  name: string;
  instanceId: string;
}) {
  const t = useTranslations('decisions.processAdmin');
  const tShared = useTranslations();
  const nameId = useId();
  const errorId = useId();
  const [draft, setDraft] = useState(name);
  const [isDirty, setIsDirty] = useState(false);
  const [seenName, setSeenName] = useState(name);
  const saveInstance = useSaveInstance(slug);

  // A rename that lands from elsewhere replaces an untouched draft; a draft
  // being typed keeps the user's text.
  if (name !== seenName) {
    setSeenName(name);
    if (!isDirty) {
      setDraft(name);
    }
  }

  const trimmed = draft.trim();
  const isTooShort = trimmed.length < PROCESS_NAME_MIN_LENGTH;

  // Enter and the blur that follows both land here; the dirty flag makes the
  // second a no-op.
  const commitName = () => {
    if (!isDirty || isTooShort) {
      return;
    }
    setIsDirty(false);
    setDraft(trimmed);
    if (trimmed !== name) {
      saveInstance.mutate({ instanceId, name: trimmed });
    }
  };

  const processUrl =
    typeof window === 'undefined'
      ? `/decisions/${slug}`
      : `${window.location.origin}/decisions/${slug}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(processUrl);
      toast.success(t('linkCopied'));
    } catch {
      toast.error(t('linkCopyFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Field>
        <FieldLabel htmlFor={nameId}>{t('processNameLabel')}</FieldLabel>
        <Input
          id={nameId}
          value={draft}
          maxLength={PROCESS_NAME_MAX_LENGTH}
          autoFocus
          dir="auto"
          aria-invalid={isTooShort || undefined}
          aria-describedby={isTooShort ? errorId : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setIsDirty(true);
          }}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitName();
            }
          }}
        />
        <FieldDescription>
          {t('nameCharacterCount', {
            count: draft.length,
            max: PROCESS_NAME_MAX_LENGTH,
          })}
        </FieldDescription>
        {isTooShort ? (
          <FieldError id={errorId}>
            {t('processNameTooShort', { min: PROCESS_NAME_MIN_LENGTH })}
          </FieldError>
        ) : null}
      </Field>
      <div className="flex flex-col gap-2">
        <FieldTitle>{t('processLinkLabel')}</FieldTitle>
        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
          <LuGlobe
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span dir="ltr" className="min-w-0 flex-1 truncate text-sm">
            {processUrl}
          </span>
          <Button variant="ghost" size="sm" onClick={copyLink}>
            <LuCopy className="size-4" aria-hidden />
            {tShared('Copy')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function VisibilitySection({
  slug,
  instanceId,
  isPrivate,
}: {
  slug: string;
  instanceId: string;
  isPrivate: boolean;
}) {
  const t = useTranslations('decisions.processAdmin');
  const publicId = useId();
  const privateId = useId();
  const [pending, setPending] = useState<boolean | null>(null);
  const saveInstance = useSaveInstance(slug);
  const shownPrivate = pending ?? isPrivate;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t('visibilityDescription')}
      </p>
      <RadioGroup
        value={shownPrivate ? 'private' : 'public'}
        aria-label={t('visibilitySection')}
        // Locked while a save runs, so two quick choices cannot race and the
        // last one to finish win over the last one chosen.
        disabled={saveInstance.isPending}
        className="gap-3"
        onValueChange={(value) => {
          const nextPrivate = value === 'private';
          setPending(nextPrivate);
          saveInstance.mutate(
            { instanceId, config: { isPrivate: nextPrivate } },
            { onSettled: () => setPending(null) },
          );
        }}
      >
        <OptionBox
          htmlFor={publicId}
          control={<RadioGroupItem id={publicId} value="public" />}
          controlPlacement="end"
          label={
            <span className="flex items-center gap-2">
              <LuGlobe className="size-4" aria-hidden />
              {t('visibilityPublic')}
            </span>
          }
          description={t('visibilityPublicHint')}
          className="rounded-xl p-4"
        />
        <OptionBox
          htmlFor={privateId}
          control={<RadioGroupItem id={privateId} value="private" />}
          controlPlacement="end"
          label={
            <span className="flex items-center gap-2">
              <LuLock className="size-4" aria-hidden />
              {t('visibilityPrivate')}
            </span>
          }
          description={t('visibilityPrivateHint')}
          className="rounded-xl p-4"
        />
      </RadioGroup>
    </div>
  );
}
