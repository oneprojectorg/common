import { trpc } from '@op/trpc/client';
import type { Organization } from '@op/trpc/encoders';
import { Button } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Dialog } from '@op/ui/RAC';
import { FormEvent, startTransition, useState, useTransition } from 'react';
import { toast } from 'sonner';

const RELATIONSHIP_OPTIONS = [
  {
    key: 'partnership',
    label: 'Partnership',
    description: `You’ve partnered with One Project on projects/programs`,
  },
  {
    key: 'funding',
    label: 'Funding',
    description: `You’ve either received or given funds to One Project`,
  },
  {
    key: 'membership',
    label: 'Membership',
    description: `Your organization is a member of One Project's network`,
  },
];

type RelationshipType = (typeof RELATIONSHIP_OPTIONS)[number]['key'];

export const ModalForm = ({ profile }: { profile: Organization }) => {
  const addRelationship = trpc.organization.addRelationship.useMutation();

  const [selectedRelations, setSelectedRelations] = useState<Array<string>>([]);
  const [isSubmitting, startTransition] = useTransition();

  const handleSubmit = (e: FormEvent, close: () => void) => {
    e.preventDefault();

    startTransition(async () => {
      try {
        await addRelationship.mutateAsync({
          to: profile.id,
          relationships: selectedRelations,
        });

        toast.success('Relationship requested');
      } catch (e) {
        toast.error('Could not create relationship');
      }

      close();
    });
  };

  return (
    <Dialog>
      {({ close }) => (
        <form onSubmit={(e) => handleSubmit(e, close)} className="contents">
          <ModalHeader>Add relationship</ModalHeader>
          <ModalBody>
            <div>
              Choose how you’re in relationship with{' '}
              <span className="font-semibold">{profile.name}:</span>
              <ul>
                {RELATIONSHIP_OPTIONS.map((option) => (
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
                        {option.description}
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
  );
};
