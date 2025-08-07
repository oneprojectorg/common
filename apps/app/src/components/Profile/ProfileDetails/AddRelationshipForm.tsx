import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import {
  RELATIONSHIP_OPTIONS,
  RelationshipType,
} from '@op/types/relationships';
import { Button } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Dialog } from '@op/ui/RAC';
import { toast } from '@op/ui/Toast';
import { FormEvent, useState, useTransition } from 'react';

import { FundingRole, FundingRoleModal } from './FundingRoleModal';

export const AddRelationshipForm = ({
  profile,
  onChange,
}: {
  profile: Organization;
  onChange: () => void;
}) => {
  const addRelationship = trpc.organization.addRelationship.useMutation();

  const [selectedRelations, setSelectedRelations] = useState<Array<string>>([]);
  const [isSubmitting, startTransition] = useTransition();
  const [showFundingRoleModal, setShowFundingRoleModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<{
    relationships: string[];
    closeModal: () => void;
  } | null>(null);
  const isOnline = useConnectionStatus();

  const handleSubmit = (e: FormEvent, close: () => void) => {
    e.preventDefault();

    // Check if funding is selected
    if (selectedRelations.includes('funding')) {
      // Store the form data and show funding role modal
      setPendingFormData({
        relationships: selectedRelations,
        closeModal: close,
      });
      setShowFundingRoleModal(true);
      return;
    }

    // If no funding selected, proceed with normal submission
    submitRelationships(selectedRelations, close);
  };

  const submitRelationships = (relationships: string[], close: () => void) => {
    if (!isOnline) {
      toast.error({
        title: 'No connection',
        message: 'Please check your internet connection and try again.',
      });
      return;
    }

    startTransition(async () => {
      try {
        await addRelationship.mutateAsync({
          to: profile.id,
          relationships,
        });

        onChange();
        toast.success({
          message: 'Relationship requested',
        });
        close();
      } catch (e) {
        const errorInfo = analyzeError(e);

        if (errorInfo.isConnectionError) {
          toast.error({
            title: 'Connection issue',
            message: errorInfo.message + ' Please try submitting again.',
          });
        } else {
          toast.error({
            title: 'Could not create relationship',
            message: errorInfo.message,
          });
        }
      }
    });
  };

  const handleFundingRoleSave = async (role: FundingRole) => {
    if (!pendingFormData) return;

    // we process the funding relationship to determine which relationships need to be added

    const filteredRelationships = new Set(pendingFormData.relationships);
    if (role === 'funder') {
      filteredRelationships.add('funding');
    } else if (role === 'fundee') {
      filteredRelationships.delete('funding');
      filteredRelationships.add('fundedBy');
    } else if (role === 'funderAndFundee') {
      filteredRelationships.add('funding');
      filteredRelationships.add('fundedBy');
    }

    submitRelationships(
      Array.from(filteredRelationships),
      pendingFormData.closeModal,
    );

    // Clean up state
    setPendingFormData(null);
    setShowFundingRoleModal(false);
  };

  const filteredRelationshipOptions = profile.networkOrganization
    ? RELATIONSHIP_OPTIONS.filter(
        (option) => option.key !== 'hasMember' && option.key !== 'fundedBy',
      )
    : RELATIONSHIP_OPTIONS.filter(
        (option) =>
          option.key !== 'memberOf' &&
          option.key !== 'hasMember' &&
          option.key !== 'fundedBy',
      );

  return (
    <>
      {!showFundingRoleModal ? (
        <Dialog>
          {({ close }) => (
            <form onSubmit={(e) => handleSubmit(e, close)} className="contents">
              <ModalHeader>Add relationship</ModalHeader>
              <ModalBody>
                <div>
                  Choose how you’re in relationship with{' '}
                  <span className="font-semibold">{profile.profile.name}:</span>
                  <ul>
                    {filteredRelationshipOptions.map((option) => (
                      <li key={option.key} className="flex gap-3 py-2">
                        <Checkbox
                          isSelected={Array.from(selectedRelations).includes(
                            option.key as RelationshipType,
                          )}
                          onChange={(checked) => {
                            if (checked) {
                              const newSet = new Set(selectedRelations);
                              newSet.add(option.key);
                              setSelectedRelations(Array.from(newSet));
                            } else {
                              setSelectedRelations(
                                selectedRelations.filter(
                                  (relationship) => relationship !== option.key,
                                ),
                              );
                            }
                          }}
                          value={option.key}
                        />

                        <div className="flex flex-col text-neutral-charcoal">
                          <span>{option.label}</span>
                          <span className="text-sm text-neutral-gray4">
                            {option.description(profile.profile.name)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  onPress={close}
                  className="w-full sm:w-fit"
                  color="secondary"
                  type="button"
                >
                  Cancel
                </Button>
                <Button
                  color="primary"
                  type="submit"
                  className="w-full sm:w-fit"
                  isPending={isSubmitting}
                >
                  {isSubmitting ? <LoadingSpinner /> : 'Add'}
                </Button>
              </ModalFooter>
            </form>
          )}
        </Dialog>
      ) : null}

      {showFundingRoleModal && (
        <FundingRoleModal
          organizationName={profile.profile.name}
          onSave={handleFundingRoleSave}
          isOpen={showFundingRoleModal}
          onClose={() => {
            setShowFundingRoleModal(false);
            setPendingFormData(null);
          }}
        />
      )}
    </>
  );
};
