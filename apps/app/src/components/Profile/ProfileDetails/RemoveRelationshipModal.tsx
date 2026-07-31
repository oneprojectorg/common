import { trpc } from '@op/api/client';
import type { Relationship } from '@op/api/encoders';
import { Button } from '@op/sense/Button';
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { toast } from '@op/sense/Toast';
import { FormEvent, useTransition } from 'react';

import { useTranslations } from '@/lib/i18n';

export const RemoveRelationshipModal = ({
  relationship,
  onClose,
}: {
  relationship: Relationship;
  onClose: () => void;
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

        toast.success(t('Relationship removed'));
      } catch (e) {
        toast.error(t('Could not remove relationship'));
      }

      onClose();
    });
  };

  return (
    <DialogContent className="sm:min-w-[29rem]">
      <form onSubmit={handleSubmit} className="contents">
        <DialogHeader>
          <DialogTitle>{t('Remove relationship')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6 py-4">
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
        </div>
        <DialogFooter>
          <Button
            onClick={onClose}
            variant="outline"
            type="button"
            className="w-full sm:w-fit"
          >
            {t('Cancel')}
          </Button>
          <Button
            variant="destructive"
            type="submit"
            loading={isSubmitting}
            className="w-full sm:w-fit"
          >
            {t('Remove')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};
