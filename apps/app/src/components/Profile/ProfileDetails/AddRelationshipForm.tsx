import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@op/sense/Field';
import { toast } from '@op/sense/Toast';
import { RELATIONSHIP_OPTIONS } from '@op/types/relationships';
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
  const [pendingRelationships, setPendingRelationships] = useState<
    string[] | null
  >(null);
  const isOnline = useConnectionStatus();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Check if funding is selected
    if (selectedRelations.includes('funding')) {
      // Store the form data and show funding role modal
      setPendingRelationships(selectedRelations);
      setShowFundingRoleModal(true);
      return;
    }

    // If no funding selected, proceed with normal submission
    submitRelationships(selectedRelations);
  };

  const submitRelationships = (relationships: string[]) => {
    if (!isOnline) {
      toast.error('No connection', {
        description: 'Please check your internet connection and try again.',
      });
      return;
    }

    startTransition(async () => {
      try {
        await addRelationship.mutateAsync({
          to: profile.id,
          relationships,
        });

        toast.success('Relationship requested');
        onClose();
      } catch (e) {
        const errorInfo = analyzeError(e);

        if (errorInfo.isConnectionError) {
          toast.error('Connection issue', {
            description: errorInfo.message + ' Please try submitting again.',
          });
        } else {
          toast.error('Could not create relationship', {
            description: errorInfo.message,
          });
        }
      }
    });
  };

  const handleFundingRoleSave = async (role: FundingRole) => {
    if (!pendingRelationships) return;

    // we process the funding relationship to determine which relationships need to be added

    const filteredRelationships = new Set(pendingRelationships);
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

    // Clean up state
    setPendingRelationships(null);
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

  if (showFundingRoleModal) {
    return (
      <FundingRoleModal
        organizationName={profile.profile.name}
        onSave={handleFundingRoleSave}
        onCancel={() => {
          setShowFundingRoleModal(false);
          setPendingRelationships(null);
          onClose();
        }}
      />
    );
  }

  return (
    <DialogContent className="sm:min-w-[29rem]">
      <form onSubmit={handleSubmit} className="contents">
        <DialogHeader>
          <DialogTitle>{t('Add relationship')}</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4">
          <p>
            {t("Choose how you're in relationship with")}{' '}
            <span className="font-strong">{profile.profile.name}:</span>
          </p>
          <FieldGroup className="mt-3 gap-4">
            {filteredRelationshipOptions.map((option) => {
              const id = `add-relationship-${option.key}`;

              return (
                <Field key={option.key} className="gap-0">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={selectedRelations.includes(option.key)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedRelations(
                            Array.from(
                              new Set(selectedRelations).add(option.key),
                            ),
                          );
                        } else {
                          setSelectedRelations(
                            selectedRelations.filter(
                              (relationship) => relationship !== option.key,
                            ),
                          );
                        }
                      }}
                    />
                    <FieldLabel htmlFor={id}>{option.label}</FieldLabel>
                  </div>
                  <FieldDescription className="ps-6">
                    {option.description(profile.profile.name)}
                  </FieldDescription>
                </Field>
              );
            })}
          </FieldGroup>
        </div>
        <DialogFooter>
          <Button
            onClick={onClose}
            className="w-full sm:w-fit"
            variant="outline"
            type="button"
          >
            {t('Cancel')}
          </Button>
          <Button
            variant="default"
            type="submit"
            className="w-full sm:w-fit"
            loading={isSubmitting}
          >
            {t('Add')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};
