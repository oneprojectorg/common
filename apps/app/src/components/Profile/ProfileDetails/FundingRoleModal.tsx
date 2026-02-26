import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Dialog } from '@op/ui/RAC';
import { Radio, RadioGroup } from '@op/ui/RadioGroup';
import { useState, useTransition } from 'react';

import { useTranslations } from '@/lib/i18n';

export type FundingRole = 'funder' | 'fundee' | 'funderAndFundee';

interface FundingRoleModalProps {
  organizationName: string;
  onSave: (role: FundingRole) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
}

export const FundingRoleModal = ({
  organizationName,
  onSave,
  isOpen,
  onClose,
}: FundingRoleModalProps) => {
  const t = useTranslations();
  const [selectedRole, setSelectedRole] = useState<FundingRole | null>(null);
  const [isSubmitting, startTransition] = useTransition();

  const handleSave = () => {
    if (!selectedRole) return;

    startTransition(async () => {
      await onSave(selectedRole);
      onClose();
    });
  };

  if (!isOpen) return null;

  return (
    <Dialog>
      {({ close }) => (
        <div>
          <ModalHeader>{t('Specify your funding relationship')}</ModalHeader>
          <ModalBody>
            <div>
              <RadioGroup
                label={t('How do your organizations support each other?')}
                value={selectedRole || ''}
                onChange={(value: string) =>
                  setSelectedRole(value as FundingRole)
                }
                orientation="vertical"
              >
                <Radio value="funder">
                  <div className="flex flex-col">
                    <div>
                      {t('Your organization funds {organizationName}', {
                        organizationName,
                      })}
                    </div>
                    <div className="text-sm text-neutral-gray4">
                      {t(
                        'Your organization provides financial support to {organizationName}.',
                        { organizationName },
                      )}
                    </div>
                  </div>
                </Radio>
                <Radio value="fundee">
                  <div className="flex flex-col">
                    <div>
                      {t('{organizationName} funds your organization', {
                        organizationName,
                      })}
                    </div>
                    <div className="text-sm text-neutral-gray4">
                      {t(
                        '{organizationName} provides financial support to your organization.',
                        { organizationName },
                      )}
                    </div>
                  </div>
                </Radio>
                <Radio value="funderAndFundee">
                  <div className="flex flex-col">
                    <div>{t('Mutual funding')}</div>
                    <div className="text-sm text-neutral-gray4">
                      {t(
                        'Both organizations provide financial support to each other.',
                      )}
                    </div>
                  </div>
                </Radio>
              </RadioGroup>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              onPress={() => {
                onClose();
                close();
              }}
              color="secondary"
              type="button"
              className="w-full sm:w-fit"
            >
              {t('Cancel')}
            </Button>
            <Button
              color="primary"
              type="button"
              isPending={isSubmitting}
              isDisabled={!selectedRole}
              onPress={handleSave}
              className="w-full sm:w-fit"
            >
              {isSubmitting ? <LoadingSpinner /> : t('Save')}
            </Button>
          </ModalFooter>
        </div>
      )}
    </Dialog>
  );
};
