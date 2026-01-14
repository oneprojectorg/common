import { trpc } from '@op/api/client';
import type { Relationship } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Dialog } from '@op/ui/RAC';
import { toast } from '@op/ui/Toast';
import { FormEvent, useTransition } from 'react';

export const RemoveRelationshipModal = ({
  relationship,
}: {
  relationship: Relationship;
}) => {
  const removeRelationship = trpc.organization.removeRelationship.useMutation();

  const [isSubmitting, startTransition] = useTransition();

  const handleSubmit = (e: FormEvent, close: () => void) => {
    e.preventDefault();

    startTransition(async () => {
      try {
        await removeRelationship.mutateAsync({
          id: relationship.id,
        });

        toast.success({
          message: 'Relationship removed',
        });
      } catch (e) {
        toast.error({ message: 'Could not remove relationship' });
      }

      close();
    });
  };

  return (
    <Modal className="sm:min-w-[29rem]">
      <Dialog>
        {({ close }) => (
          <form onSubmit={(e) => handleSubmit(e, close)} className="contents">
            <ModalHeader>Remove relationship</ModalHeader>
            <ModalBody>
              <div>
                Are you sure you want to remove the Funding relationship with{' '}
                {relationship.relationshipType}?
              </div>
              <div>
                You’ll need to send a new request to restore this relationship
                on your profile.
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                onPress={close}
                color="neutral"
                type="button"
                className="w-full sm:w-fit"
              >
                Cancel
              </Button>
              <Button
                color="destructive"
                type="submit"
                isPending={isSubmitting}
                className="w-full sm:w-fit"
              >
                {isSubmitting ? <LoadingSpinner /> : 'Remove'}
              </Button>
            </ModalFooter>
          </form>
        )}
      </Dialog>
    </Modal>
  );
};
