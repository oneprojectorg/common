'use client';

import { trpc } from '@op/api/client';
import type { DecisionProfile } from '@op/api/encoders';
import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { Field, FieldLabel, FieldLegend, FieldSet } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Skeleton } from '@op/sense/Skeleton';
import { toast } from '@op/sense/Toast';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';

export const DuplicateProcessModal = ({
  item,
  onClose,
}: {
  item: DecisionProfile;
  onClose: () => void;
}) => {
  const t = useTranslations();
  const isPendingRef = useRef(false);

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !isPendingRef.current && onClose()}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('Duplicate process')}</DialogTitle>
        </DialogHeader>
        <ErrorBoundary fallback={null}>
          <Suspense fallback={<DuplicateFormSkeleton />}>
            <DuplicateFormContent
              item={item}
              onClose={onClose}
              isPendingRef={isPendingRef}
            />
          </Suspense>
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
};

const DuplicateFormContent = ({
  item,
  onClose,
  isPendingRef,
}: {
  item: DecisionProfile;
  onClose: () => void;
  isPendingRef: React.RefObject<boolean>;
}) => {
  const t = useTranslations();
  const router = useRouter();
  const utils = trpc.useUtils();

  const [name, setName] = useState(
    t('Duplicate of {name}', { name: item.name || item.processInstance.name }),
  );
  const [stewardProfileId, setStewardProfileId] = useState('');

  const includeOptions = [
    { key: 'processSettings', label: t('Process Settings') },
    { key: 'phases', label: t('Phases') },
    { key: 'proposalCategories', label: t('Proposal Categories') },
    { key: 'proposalTemplate', label: t('Proposal Template') },
    { key: 'reviewSettings', label: t('Review Settings') },
    { key: 'reviewRubric', label: t('Review Rubric') },
    { key: 'roles', label: t('Roles') },
  ] as const;

  const [selectedIncludes, setSelectedIncludes] = useState<string[]>(
    includeOptions.map((o) => o.key),
  );

  const duplicateMutation = trpc.decision.duplicateInstance.useMutation({
    onSuccess: () => {
      toast.success(t('Decision duplicated successfully'));
      utils.decision.listDecisionProfiles.invalidate();
      onClose();
      router.push('/decisions?tab=drafts');
    },
    onError: () => {
      toast.error(t('Failed to duplicate decision'));
    },
  });

  // Keep parent's ref in sync so the modal dismiss guard works
  isPendingRef.current = duplicateMutation.isPending;

  const handleDuplicate = () => {
    if (!name.trim() || !stewardProfileId) {
      return;
    }
    duplicateMutation.mutate({
      instanceId: item.processInstance.id,
      name: name.trim(),
      stewardProfileId,
      include: Object.fromEntries(
        includeOptions.map((o) => [o.key, selectedIncludes.includes(o.key)]),
      ) as Record<(typeof includeOptions)[number]['key'], boolean>,
    });
  };

  return (
    <>
      <div className="flex flex-col gap-6 px-6 py-4">
        <div className="flex flex-col gap-6">
          <div className="flex-1">
            <Field>
              <FieldLabel htmlFor="duplicate-process-name">
                {t('Process Name')} <RequiredAsterisk />
              </FieldLabel>
              <Input
                id="duplicate-process-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="[unicode-bidi:plaintext]"
              />
            </Field>
          </div>
          <div className="flex-1">
            <StewardSelect
              stewardProfileId={stewardProfileId}
              onSelectionChange={setStewardProfileId}
              currentSteward={item.processInstance.steward}
            />
          </div>
        </div>

        <FieldSet className="gap-2">
          <FieldLegend className="font-serif text-title-sm12">
            {t('Include')}
          </FieldLegend>
          <div className="grid grid-cols-2 gap-2">
            {includeOptions.map((option) => (
              <Field key={option.key} orientation="horizontal">
                <Checkbox
                  id={`duplicate-include-${option.key}`}
                  checked={selectedIncludes.includes(option.key)}
                  onCheckedChange={(checked) =>
                    setSelectedIncludes((prev) =>
                      checked
                        ? [...prev, option.key]
                        : prev.filter((key) => key !== option.key),
                    )
                  }
                />
                <FieldLabel htmlFor={`duplicate-include-${option.key}`}>
                  {option.label}
                </FieldLabel>
              </Field>
            ))}
          </div>
        </FieldSet>
      </div>
      <DialogFooter>
        <Button
          variant="default"
          className="w-full sm:w-auto"
          onClick={handleDuplicate}
          disabled={
            !name.trim() || !stewardProfileId || duplicateMutation.isPending
          }
        >
          {duplicateMutation.isPending
            ? t('Duplicating...')
            : t('Duplicate process')}
        </Button>
      </DialogFooter>
    </>
  );
};

const DuplicateFormSkeleton = () => (
  <div className="flex flex-col gap-6 px-6 py-4">
    <div className="flex flex-col gap-6 sm:flex-row">
      <div className="flex-1">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-4.5 w-24" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
      <div className="flex-1">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-4.5 w-48" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-16" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-32" />
        ))}
      </div>
    </div>
  </div>
);

const StewardSelect = ({
  stewardProfileId,
  onSelectionChange,
  currentSteward,
}: {
  stewardProfileId: string;
  onSelectionChange: (key: string) => void;
  currentSteward?: { id: string; name: string | null } | null;
}) => {
  const t = useTranslations();
  const [userProfiles] = trpc.account.getUserProfiles.useSuspenseQuery();

  const profileItems = useMemo(() => {
    const items = (userProfiles ?? []).map((p) => ({
      id: p.id,
      name: p.name,
    }));
    if (currentSteward && !items.some((p) => p.id === currentSteward.id)) {
      items.push({ id: currentSteward.id, name: currentSteward.name ?? '' });
    }
    return items;
  }, [userProfiles, currentSteward]);

  // Set steward to current user on mount if not already set
  const defaultProfileId = userProfiles?.[0]?.id;
  useEffect(() => {
    if (defaultProfileId && !stewardProfileId) {
      onSelectionChange(defaultProfileId);
    }
  }, [defaultProfileId, stewardProfileId, onSelectionChange]);

  return (
    <Field>
      <FieldLabel htmlFor="steward-select">
        {t('Who is stewarding this process?')} <RequiredAsterisk />
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
