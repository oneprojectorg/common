import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Dialog } from '@op/ui/RAC';
import { Radio, RadioGroup } from '@op/ui/RadioGroup';
import { useState, useTransition } from 'react';

export type FundingRole = 'funder' | 'fundee';

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
        <div className="contents">
          <ModalHeader>Funding Relationship</ModalHeader>
          <ModalBody>
            <div>
              <RadioGroup
                label="How do your organizations support each other?"
                value={selectedRole || ''}
                onChange={(value: string) =>
                  setSelectedRole(value as FundingRole)
                }
                orientation="vertical"
              >
                <Radio value="funder">
                  <div className="flex flex-col">
                    <div>Your organization funds {organizationName}</div>
                    <div className="text-sm text-neutral-gray4">
                      Your organization provides financial support to{' '}
                      {organizationName}.
                    </div>
                  </div>
                </Radio>
                <Radio value="fundee">
                  <div className="flex flex-col">
                    <div>{organizationName} funds your organization</div>
                    <div className="text-sm text-neutral-gray4">
                      {organizationName} provides financial support to your
                      organization.
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
            >
              Cancel
            </Button>
            <Button
              color="primary"
              type="button"
              isPending={isSubmitting}
              isDisabled={!selectedRole}
              onPress={handleSave}
            >
              {isSubmitting ? <LoadingSpinner /> : 'Save'}
            </Button>
          </ModalFooter>
        </div>
      )}
    </Dialog>
  );
};
