'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { Organization } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal } from '@op/ui/Modal';
import { DialogTrigger } from '@op/ui/RAC';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { Suspense } from 'react';
import { LuCheck, LuClock, LuPlus } from 'react-icons/lu';

import ErrorBoundary from '@/components/ErrorBoundary';

import { AddRelationshipForm } from './AddRelationshipForm';
import { RemoveRelationshipModal } from './RemoveRelationshipModal';

export const AddRelationshipModalSuspense = ({
  profile,
}: {
  profile: Organization;
}) => {
  const utils = trpc.useUtils();
  const { user } = useUser();
  // checking for our relationships TOWARDS the profile
  const [{ relationships }] =
    trpc.organization.listDirectedRelationships.useSuspenseQuery({
      to: profile.id,
    });
  // TODO: allow to filter in the API
  // checking for relationships FROM the profile
  const [{ organizations: inverseRelationships }] =
    trpc.organization.listRelationships.useSuspenseQuery({
      organizationId: profile.id,
    });

  const relationshipsToCurrentUserOrg = relationships.find(
    (relationship) =>
      relationship.sourceOrganizationId === user?.currentOrganization?.id,
  )
    ? []
    : inverseRelationships.filter(
        (relationship) => relationship.id === user?.currentOrganization?.id,
      );

  console.log('RELATIONSHIP', relationshipsToCurrentUserOrg[0]?.relationships);
  return (
    <>
      {relationships.length > 0 ? (
        relationships.map((relationship) => {
          return (
            <TooltipTrigger
              key={relationship.id}
              isDisabled={!relationship.pending}
            >
              {(() => {
                switch (relationship.relationshipType) {
                  case 'partnership':
                    return (
                      <DialogTrigger>
                        <Button
                          className="w-full sm:w-auto"
                          color={
                            relationship.pending ? 'unverified' : 'verified'
                          }
                        >
                          {relationship.pending ? (
                            <LuClock className="size-4 stroke-1" />
                          ) : (
                            <LuCheck className="size-4 stroke-1" />
                          )}
                          Partner
                        </Button>
                        {relationship.pending && (
                          <Tooltip>
                            Pending confirmation from {profile.profile.name}
                          </Tooltip>
                        )}
                        <RemoveRelationshipModal
                          relationship={relationship}
                          onChange={() => {
                            utils.organization.listRelationships.invalidate({
                              organizationId: profile.id,
                            });
                            utils.organization.listDirectedRelationships.invalidate(
                              {
                                to: profile.id,
                              },
                            );
                          }}
                        />
                      </DialogTrigger>
                    );
                  case 'funding':
                    return (
                      <DialogTrigger>
                        <Button
                          className="w-full sm:w-auto"
                          color={
                            relationship.pending ? 'unverified' : 'verified'
                          }
                        >
                          {relationship.pending ? (
                            <LuClock className="size-4 stroke-1" />
                          ) : (
                            <LuCheck className="size-4 stroke-1" />
                          )}
                          Funder
                        </Button>
                        <Tooltip>
                          {relationship.pending &&
                            `Pending confirmation from ${profile.profile.name}`}
                        </Tooltip>
                        <RemoveRelationshipModal
                          relationship={relationship}
                          onChange={() => {
                            utils.organization.listRelationships.invalidate({
                              organizationId: profile.id,
                            });
                            utils.organization.listDirectedRelationships.invalidate(
                              {
                                to: profile.id,
                              },
                            );
                          }}
                        />
                      </DialogTrigger>
                    );
                  case 'fundedBy':
                    return (
                      <DialogTrigger>
                        <Button
                          className="w-full sm:w-auto"
                          color={
                            relationship.pending ? 'unverified' : 'verified'
                          }
                        >
                          {relationship.pending ? (
                            <LuClock className="size-4 stroke-1" />
                          ) : (
                            <LuCheck className="size-4 stroke-1" />
                          )}
                          Fundee
                        </Button>
                        <Tooltip>
                          {relationship.pending &&
                            `Pending confirmation from ${profile.profile.name}`}
                        </Tooltip>
                        <RemoveRelationshipModal
                          relationship={relationship}
                          onChange={() => {
                            utils.organization.listRelationships.invalidate({
                              organizationId: profile.id,
                            });
                            utils.organization.listDirectedRelationships.invalidate(
                              {
                                to: profile.id,
                              },
                            );
                          }}
                        />
                      </DialogTrigger>
                    );
                  case 'affiliation':
                    return (
                      <DialogTrigger>
                        <Button
                          className="w-full sm:w-auto"
                          color={
                            relationship.pending ? 'unverified' : 'verified'
                          }
                        >
                          {relationship.pending ? (
                            <LuClock className="size-4 stroke-1" />
                          ) : (
                            <LuCheck className="size-4 stroke-1" />
                          )}
                          Affiliate
                        </Button>
                        <Tooltip>
                          {relationship.pending &&
                            `Pending confirmation from ${profile.profile.name}`}
                        </Tooltip>
                        <RemoveRelationshipModal
                          relationship={relationship}
                          onChange={() => {
                            utils.organization.listRelationships.invalidate({
                              organizationId: profile.id,
                            });
                            utils.organization.listDirectedRelationships.invalidate(
                              {
                                to: profile.id,
                              },
                            );
                          }}
                        />
                      </DialogTrigger>
                    );
                  default:
                    return (
                      <DialogTrigger>
                        <Button
                          color={
                            relationship.pending ? 'unverified' : 'verified'
                          }
                          className="w-full sm:w-auto"
                        >
                          {relationship.pending ? (
                            <LuClock className="size-4 stroke-1" />
                          ) : (
                            <LuCheck className="size-4 stroke-1" />
                          )}
                          Member
                        </Button>
                        <Tooltip>
                          {relationship.pending &&
                            `Pending confirmation from ${profile.profile.name}`}
                        </Tooltip>
                        <RemoveRelationshipModal
                          relationship={relationship}
                          onChange={() => {
                            utils.organization.listRelationships.invalidate({
                              organizationId: profile.id,
                            });
                            utils.organization.listDirectedRelationships.invalidate(
                              {
                                to: profile.id,
                              },
                            );
                          }}
                        />
                      </DialogTrigger>
                    );
                }
              })()}
            </TooltipTrigger>
          );
        })
      ) : relationshipsToCurrentUserOrg.length <= 0 ? (
        <DialogTrigger>
          <Button className="min-w-full sm:min-w-fit">
            <LuPlus className="size-4 stroke-1" />
            Add relationship
          </Button>
          <Modal className="sm:min-w-[29rem]">
            <AddRelationshipForm
              profile={profile}
              onChange={() => {
                utils.organization.listRelationships.invalidate({
                  organizationId: profile.id,
                });
                utils.organization.listDirectedRelationships.invalidate({
                  to: profile.id,
                });
              }}
            />
          </Modal>
        </DialogTrigger>
      ) : null}

      {relationshipsToCurrentUserOrg[0]?.relationships?.map((relationship) => {
        return (
          <TooltipTrigger isDisabled={!relationship.pending}>
            {(() => {
              switch (relationship.relationshipType) {
                case 'partnership':
                  return (
                    <>
                      <Button
                        color={relationship.pending ? 'unverified' : 'verified'}
                        className="w-full sm:w-auto"
                      >
                        {relationship.pending ? (
                          <LuClock className="size-4 stroke-1" />
                        ) : (
                          <LuCheck className="size-4 stroke-1" />
                        )}
                        Partner
                      </Button>
                      {relationship.pending && (
                        <Tooltip>
                          Pending confirmation from{' '}
                          {user?.currentOrganization?.profile.name}
                        </Tooltip>
                      )}
                    </>
                  );
                case 'funding':
                  return (
                    <>
                      <Button
                        className="w-full sm:w-auto"
                        color={relationship.pending ? 'unverified' : 'verified'}
                      >
                        {relationship.pending ? (
                          <LuClock className="size-4 stroke-1" />
                        ) : (
                          <LuCheck className="size-4 stroke-1" />
                        )}
                        Fundee
                      </Button>
                      <Tooltip>
                        {relationship.pending &&
                          `Pending confirmation from ${user?.currentOrganization?.profile.name}`}
                      </Tooltip>
                    </>
                  );
                case 'fundedBy':
                  return (
                    <>
                      <Button
                        color={relationship.pending ? 'unverified' : 'verified'}
                        className="w-full sm:w-auto"
                      >
                        {relationship.pending ? (
                          <LuClock className="size-4 stroke-1" />
                        ) : (
                          <LuCheck className="size-4 stroke-1" />
                        )}
                        Fundee
                      </Button>
                      {relationship.pending && (
                        <Tooltip>
                          Pending confirmation from{' '}
                          {user?.currentOrganization?.profile.name}
                        </Tooltip>
                      )}
                    </>
                  );
                case 'affiliation':
                  return (
                    <>
                      <Button
                        color={relationship.pending ? 'unverified' : 'verified'}
                        className="w-full sm:w-auto"
                      >
                        {relationship.pending ? (
                          <LuClock className="size-4 stroke-1" />
                        ) : (
                          <LuCheck className="size-4 stroke-1" />
                        )}
                        Affiliation
                      </Button>
                      {relationship.pending && (
                        <Tooltip>
                          Pending confirmation from{' '}
                          {user?.currentOrganization?.profile.name}
                        </Tooltip>
                      )}
                    </>
                  );
                default:
                  return (
                    <>
                      <Button
                        className="w-full sm:w-auto"
                        color={relationship.pending ? 'unverified' : 'verified'}
                      >
                        {relationship.pending ? (
                          <LuClock className="size-4 stroke-1" />
                        ) : (
                          <LuCheck className="size-4 stroke-1" />
                        )}
                        Member
                      </Button>
                      <Tooltip>
                        {relationship.pending &&
                          `Pending confirmation from ${user?.currentOrganization?.profile.name}`}
                      </Tooltip>
                    </>
                  );
              }
            })()}
          </TooltipTrigger>
        );
      })}
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
      <Suspense
        fallback={
          <Button isDisabled={true}>
            <LoadingSpinner />
          </Button>
        }
      >
        <AddRelationshipModalSuspense profile={profile} />
      </Suspense>
    </ErrorBoundary>
  );
};
