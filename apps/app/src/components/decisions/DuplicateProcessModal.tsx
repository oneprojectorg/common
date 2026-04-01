'use client';

import { trpc } from '@op/api/client';
import type { DecisionProfile } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Select, SelectItem } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

export const DuplicateProcessModal = ({
  item,
  onClose,
}: {
  item: DecisionProfile;
  onClose: () => void;
}) => {
  const t = useTranslations();
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: userProfiles } = trpc.account.getUserProfiles.useQuery();

  const currentUserProfile = userProfiles?.[0];

  const [name, setName] = useState(
    t('Duplicate of {name}', { name: item.name || item.processInstance.name }),
  );
  const [stewardProfileId, setStewardProfileId] = useState<string | null>(null);
  const [include, setInclude] = useState({
    processSettings: true,
    phases: true,
    proposalCategories: true,
    proposalTemplate: true,
    reviewSettings: true,
    reviewRubric: true,
    roles: true,
  });

  // Set steward to current user once profiles load
  useEffect(() => {
    if (currentUserProfile?.id && stewardProfileId === null) {
      setStewardProfileId(currentUserProfile.id);
    }
  }, [currentUserProfile?.id, stewardProfileId]);

  const profileItems = (userProfiles ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }));

  // Ensure current steward appears in dropdown
  const steward = item.processInstance.steward;
  if (steward && !profileItems.some((p) => p.id === steward.id)) {
    profileItems.push({
      id: steward.id,
      name: steward.name ?? '',
    });
  }

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

  const handleDuplicate = () => {
    if (!name.trim() || !stewardProfileId) {
      return;
    }
    duplicateMutation.mutate({
      instanceId: item.processInstance.id,
      name: name.trim(),
      stewardProfileId,
      include,
    });
  };

  const toggleInclude = (key: keyof typeof include) => {
    setInclude((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const includeOptions: Array<{
    key: keyof typeof include;
    label: string;
  }> = [
    { key: 'processSettings', label: t('Process Settings') },
    { key: 'phases', label: t('Phases') },
    { key: 'proposalCategories', label: t('Proposal Categories') },
    { key: 'proposalTemplate', label: t('Proposal Template') },
    { key: 'reviewSettings', label: t('Review Settings') },
    { key: 'reviewRubric', label: t('Review Rubric') },
    { key: 'roles', label: t('Roles') },
  ];

  return (
    <Modal
      isOpen
      isDismissable
      onOpenChange={(open) =>
        !open && !duplicateMutation.isPending && onClose()
      }
    >
      <ModalHeader>{t('Duplicate process')}</ModalHeader>
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
            <Select
              label={t('Who is stewarding this process?')}
              isRequired
              placeholder={t('Select')}
              selectedKey={stewardProfileId}
              onSelectionChange={(key) => setStewardProfileId(key as string)}
            >
              {profileItems.map((profile) => (
                <SelectItem key={profile.id} id={profile.id}>
                  {profile.name}
                </SelectItem>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <span className="font-serif text-title-sm12 text-neutral-black">
            {t('Include')}
          </span>
          <div className="flex flex-col gap-2">
            {includeOptions.map((option) => (
              <Checkbox
                key={option.key}
                size="small"
                isSelected={include[option.key]}
                onChange={() => toggleInclude(option.key)}
              >
                {option.label}
              </Checkbox>
            ))}
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          color="primary"
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
    </Modal>
  );
};
