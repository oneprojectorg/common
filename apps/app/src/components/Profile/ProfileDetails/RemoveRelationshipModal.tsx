import { trpc } from '@op/api/client';
import type { Relationship } from '@op/api/encoders';
import { Button } from '@op/ui-next/Button';
import { LoadingSpinner } from '@op/ui-next/LoadingSpinner';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui-next/Modal';
import { toast } from '@op/ui/Toast';
import { FormEvent, useTransition } from 'react';

import { useTranslations } from '@/lib/i18n';

export const RemoveRelationshipModal = ({
  relationship,
  isOpen,
  onOpenChange,
}: {
  relationship: Relationship;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) => {
  const t = useTranslations();
  const removeRelationship = trpc.organization.removeRelationship.useMutation();

  const [isSubmitting, startTransition] = useTransition();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      try {
        await removeRelationship.mutateAsync({
          id: relationship.id,
        });

        toast.success({
          message: t('Relationship removed'),
        });
      } catch (e) {
        toast.error({ message: t('Could not remove relationship') });
      }

      onOpenChange(false);
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="sm:min-w-[29rem]"
    >
      <form onSubmit={handleSubmit} className="contents">
        <ModalHeader>{t('Remove relationship')}</ModalHeader>
        <ModalBody>
          <div>
            {t(
              'Are you sure you want to remove the {relationshipType} relationship?',
              { relationshipType: relationship.relationshipType },
            )}
          </div>
          <div>
            {t(
              "You'll need to send a new request to restore this relationship on your profile.",
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            onPress={() => onOpenChange(false)}
            color="neutral"
            type="button"
            className="w-full sm:w-fit"
          >
            {t('Cancel')}
          </Button>
          <Button
            color="destructive"
            type="submit"
            isPending={isSubmitting}
            className="w-full sm:w-fit"
          >
            {isSubmitting ? <LoadingSpinner /> : t('Remove')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};
