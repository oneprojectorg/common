'use client';

import { trpc } from '@op/api/client';
import type { DecisionProfile } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Checkbox, CheckboxGroup } from '@op/ui/Checkbox';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Select, SelectItem } from '@op/ui/Select';
import { Skeleton } from '@op/ui/Skeleton';
import { TextField } from '@op/ui/TextField';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

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
    <Modal
      isOpen
      isDismissable
      onOpenChange={(open) => !open && !isPendingRef.current && onClose()}
    >
      <ModalHeader>{t('Duplicate process')}</ModalHeader>
      <ErrorBoundary fallback={null}>
        <Suspense fallback={<DuplicateFormSkeleton />}>
          <DuplicateFormContent
            item={item}
            onClose={onClose}
            isPendingRef={isPendingRef}
          />
        </Suspense>
      </ErrorBoundary>
    </Modal>
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
      toast.success({ message: t('Decision duplicated successfully') });
      utils.decision.listDecisionProfiles.invalidate();
      onClose();
      router.push('/decisions?tab=drafts');
    },
    onError: () => {
      toast.error({ message: t('Failed to duplicate decision') });
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
      <ModalBody className="gap-6">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex-1">
            <TextField
              label={t('Process Name')}
              isRequired
              value={name}
              onChange={setName}
            />
          </div>
          <div className="flex-1">
            <StewardSelect
              stewardProfileId={stewardProfileId}
              onSelectionChange={setStewardProfileId}
              currentSteward={item.processInstance.steward}
            />
          </div>
        </div>

        <CheckboxGroup
          label={t('Include')}
          labelClassName="font-serif text-title-sm12"
          className="gap-4"
          value={selectedIncludes}
          onChange={setSelectedIncludes}
        >
          {includeOptions.map((option) => (
            <Checkbox key={option.key} value={option.key} size="small">
              {option.label}
            </Checkbox>
          ))}
        </CheckboxGroup>
      </ModalBody>
      <ModalFooter>
        <Button
          color="primary"
          className="w-full sm:w-auto"
          onPress={handleDuplicate}
          isDisabled={
            !name.trim() || !stewardProfileId || duplicateMutation.isPending
          }
        >
          {duplicateMutation.isPending
            ? t('Duplicating...')
            : t('Duplicate process')}
        </Button>
      </ModalFooter>
    </>
  );
};

const DuplicateFormSkeleton = () => (
  <ModalBody className="gap-6">
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
  </ModalBody>
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
    <Select
      label={t('Who is stewarding this process?')}
      isRequired
      placeholder={t('Select')}
      selectedKey={stewardProfileId || defaultProfileId || null}
      onSelectionChange={(key) => onSelectionChange(key as string)}
    >
      {profileItems.map((profile) => (
        <SelectItem key={profile.id} id={profile.id}>
          {profile.name}
        </SelectItem>
      ))}
    </Select>
  );
};
