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

  const handleSubmit = (e: FormEvent, close: () => void) => {
    e.preventDefault();

    startTransition(async () => {
      try {
        await addRelationship.mutateAsync({
          to: profile.id,
          relationships: selectedRelations,
        });

        onChange();
        toast.success({
          title: 'Relationship requested',
        });
      } catch (e) {
        toast.error({ title: 'Could not create relationship' });
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
                        {option.description(profile.name)}
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
