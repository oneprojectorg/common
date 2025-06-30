import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Dialog } from '@op/ui/RAC';
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
              <p className="mb-4">
                How are you related to{' '}
                <span className="font-semibold">{organizationName}</span> in
                terms of funding?
              </p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setSelectedRole('funder')}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    selectedRole === 'funder'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium">Funder</div>
                  <div className="text-sm text-gray-600">
                    You provide funding to {organizationName}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('fundee')}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    selectedRole === 'fundee'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium">Fundee</div>
                  <div className="text-sm text-gray-600">
                    You receive funding from {organizationName}
                  </div>
                </button>
              </div>
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
