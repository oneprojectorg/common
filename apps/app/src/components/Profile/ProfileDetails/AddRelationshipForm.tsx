import { RELATIONSHIP_OPTIONS, RelationshipType } from '@/utils/relationships';
import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
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
      } catch (e) {
        toast.error({ title: 'Could not create relationship' });
      }

      close();
    });
  };

  const handleFundingRoleSave = async (role: FundingRole) => {
    if (!pendingFormData) return;

    // we process the funding relationship to determine which relationships need to be added

    const filteredRelationships = new Set(pendingFormData.relationships);
    if (role === 'funder') {
      filteredRelationships.add('funding');
    } else if (role === 'fundee') {
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
    ? RELATIONSHIP_OPTIONS.filter((option) => option.key !== 'fundee')
    : RELATIONSHIP_OPTIONS.filter(
        (option) => option.key !== 'memberOf' && option.key !== 'fundee',
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
                <Button onPress={close} color="secondary" type="button">
                  Cancel
                </Button>
                <Button color="primary" type="submit" isPending={isSubmitting}>
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
