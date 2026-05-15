import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import {
  RELATIONSHIP_OPTIONS,
  RelationshipType,
} from '@op/types/relationships';
import { Button } from '@op/ui-next/Button';
import { Checkbox } from '@op/ui-next/Checkbox';
import { LoadingSpinner } from '@op/ui-next/LoadingSpinner';
import { ModalBody, ModalFooter, ModalHeader } from '@op/ui-next/Modal';
import { toast } from '@op/ui/Toast';
import { FormEvent, useState, useTransition } from 'react';

import { useTranslations } from '@/lib/i18n';

import { FundingRole, FundingRoleModal } from './FundingRoleModal';

export const AddRelationshipForm = ({
  profile,
  onClose,
}: {
  profile: Organization;
  onClose: () => void;
}) => {
  const t = useTranslations();
  const addRelationship = trpc.organization.addRelationship.useMutation();

  const [selectedRelations, setSelectedRelations] = useState<Array<string>>([]);
  const [isSubmitting, startTransition] = useTransition();
  const [showFundingRoleModal, setShowFundingRoleModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<{
    relationships: string[];
  } | null>(null);
  const isOnline = useConnectionStatus();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (selectedRelations.includes('funding')) {
      setPendingFormData({ relationships: selectedRelations });
      setShowFundingRoleModal(true);
      return;
    }

    submitRelationships(selectedRelations);
  };

  const submitRelationships = (relationships: string[]) => {
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

        toast.success({
          message: 'Relationship requested',
        });
        onClose();
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

    submitRelationships(Array.from(filteredRelationships));

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
        <form onSubmit={handleSubmit} className="contents">
          <ModalHeader>{t('Add relationship')}</ModalHeader>
          <ModalBody>
            <div>
              {t("Choose how you're in relationship with")}{' '}
              <span className="font-semibold">{profile.profile.name}:</span>
              <ul>
                {filteredRelationshipOptions.map((option) => (
                  <li key={option.key} className="flex gap-3 py-2">
                    <Checkbox
                      checked={Array.from(selectedRelations).includes(
                        option.key as RelationshipType,
                      )}
                      onCheckedChange={(checked) => {
                        if (checked === true) {
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
              onPress={onClose}
              className="w-full sm:w-fit"
              color="secondary"
              type="button"
            >
              {t('Cancel')}
            </Button>
            <Button
              color="primary"
              type="submit"
              className="w-full sm:w-fit"
              isPending={isSubmitting}
            >
              {isSubmitting ? <LoadingSpinner /> : t('Add')}
            </Button>
          </ModalFooter>
        </form>
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
