'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { skipBatch, trpc } from '@op/api/client';
import { Organization } from '@op/api/encoders';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { toast } from '@op/sense/Toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@op/sense/Tooltip';
import { cn } from '@op/sense/lib/utils';
import { relationshipMap } from '@op/types';
import { FormEvent, Suspense, useState, useTransition } from 'react';
import { LuCheck, LuChevronDown, LuClock, LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import { OrganizationAvatar } from '@/components/OrganizationAvatar';

import { AddRelationshipForm } from './AddRelationshipForm';
import { RemoveRelationshipModal } from './RemoveRelationshipModal';
import { RespondButton } from './RespondButton';

const RemoveRelationshipModalContent = ({
  relationship,
  utils,
  profileId,
  onClose,
}: {
  relationship: any;
  utils: any;
  profileId: string;
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

        utils.organization.listRelationships.invalidate({
          organizationId: profileId,
        });
        utils.organization.listDirectedRelationships.invalidate({
          from: profileId,
        });

        toast.success(t('Relationship removed'));
        onClose();
      } catch (e) {
        toast.error(t('Could not remove relationship'));
      }
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
          <Button onClick={onClose} variant="outline" type="button">
            {t('Cancel')}
          </Button>
          <Button variant="destructive" type="submit" loading={isSubmitting}>
            {t('Remove')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

export const AddRelationshipModalSuspense = ({
  profile,
}: {
  profile: Organization;
}) => {
  const { user } = useRequiredUser();
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<
    string | null
  >(null);
  const [addOpen, setAddOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  // checking for our relationships TOWARDS the profile
  const [{ relationships }] =
    trpc.organization.listDirectedRelationships.useSuspenseQuery(
      {
        from: profile.id,
      },
      {
        ...skipBatch,
      },
    );

  const selectedRelationship = relationships.find(
    (r) => r.id === selectedRelationshipId,
  );

  const dropdownItems = relationships.map((relationship) => ({
    id: relationship.id,
    label:
      relationshipMap[relationship.relationshipType]?.label ??
      relationship.relationshipType,
    icon: relationship.pending ? (
      <LuClock className="size-4" />
    ) : (
      <LuCheck className="size-4" />
    ),
    onAction: () => setSelectedRelationshipId(relationship.id),
  }));

  return (
    <>
      <RespondButton profile={profile} />
      {relationships.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                className={cn(
                  'min-w-full sm:min-w-fit',
                  relationships.some((r) => r.pending)
                    ? 'bg-transparent'
                    : 'bg-primary-tealWhite',
                )}
              >
                {t(
                  '{count, plural, =1 {1 relationship} other {# relationships}}',
                  { count: relationships.length },
                )}{' '}
                {user.currentProfile ? (
                  <>
                    {t('with')}
                    <OrganizationAvatar
                      profile={user.currentProfile}
                      className="size-6"
                    />
                  </>
                ) : null}
                <LuChevronDown className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="start">
            {dropdownItems.map((item) => (
              <DropdownMenuItem key={item.id} onClick={item.onAction}>
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : relationships.length === 1 ? (
        relationships.map((relationship) => (
          <Dialog
            key={relationship.id}
            open={removeOpen}
            onOpenChange={setRemoveOpen}
          >
            <TooltipProvider delay={500}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DialogTrigger
                      render={
                        <Button
                          className="w-full sm:w-auto"
                          variant={relationship.pending ? 'outline' : 'default'}
                        >
                          {relationship.pending ? (
                            <LuClock className="size-4" />
                          ) : (
                            <LuCheck className="size-4" />
                          )}
                          {relationshipMap[relationship.relationshipType]
                            ?.label ?? relationship.relationshipType}
                        </Button>
                      }
                    />
                  }
                />
                {relationship.pending && (
                  <TooltipContent>
                    {t('Pending confirmation from {name}', {
                      name: profile.profile.name,
                    })}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <RemoveRelationshipModal
              relationship={relationship}
              onClose={() => setRemoveOpen(false)}
            />
          </Dialog>
        ))
      ) : (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger
            render={
              <Button className="min-w-full text-nowrap sm:min-w-fit">
                <LuPlus className="size-4" />
                {t('Add relationship')}
              </Button>
            }
          />
          {addOpen && (
            <AddRelationshipForm
              profile={profile}
              onClose={() => setAddOpen(false)}
            />
          )}
        </Dialog>
      )}

      <Dialog
        open={!!selectedRelationship}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRelationshipId(null);
          }
        }}
      >
        {selectedRelationship && (
          <RemoveRelationshipModalContent
            relationship={selectedRelationship}
            utils={utils}
            profileId={profile.id}
            onClose={() => setSelectedRelationshipId(null)}
          />
        )}
      </Dialog>
    </>
  );
};

export const AddRelationshipModal = ({
  profile,
}: {
  profile: Organization;
}) => {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={<Button disabled loading />}>
        <AddRelationshipModalSuspense profile={profile} />
      </Suspense>
    </ErrorBoundary>
  );
};
