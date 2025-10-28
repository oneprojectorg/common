'use client';

import { getPublicUrl } from '@/utils';
import { useUser } from '@/utils/UserProvider';
import { pluralize } from '@/utils/pluralize';
import { getUniqueSubmitters } from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import { match } from '@op/core';
import { Avatar } from '@op/ui/Avatar';
import { Button } from '@op/ui/Button';
import { Dialog, DialogTrigger } from '@op/ui/Dialog';
import { GrowingFacePile } from '@op/ui/GrowingFacePile';
import { GradientHeader } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { Link, useTranslations } from '@/lib/i18n/routing';

import { RichTextEditorContent } from '../RichTextEditor';
import { ProcessPhase } from './types';

export function DecisionInstanceContent({
  instanceId,
}: {
  instanceId: string;
}) {
  const t = useTranslations();
  const { slug } = useParams();
  const { user } = useUser();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const [[{ proposals }, instance]] = trpc.useSuspenseQueries((t) => [
    t.decision.listProposals({
      processInstanceId: instanceId,
      limit: 20,
    }),
    t.decision.getInstance({
      instanceId,
    }),
  ]);

  // Get voting status for this user and process
  const { data: voteStatus } = trpc.decision.getVotingStatus.useQuery(
    {
      processInstanceId: instanceId,
      userId: user?.id || '',
    },
    {
      enabled: !!user?.id,
    },
  );

  const instanceData = instance.instanceData as any;
  const processSchema = instance.process?.processSchema as any;

  // Merge template states with actual instance phase data
  const templateStates: ProcessPhase[] = processSchema?.states || [];

  const currentStateId =
    instanceData?.currentStateId || instance.currentStateId;
  const currentState = templateStates.find(
    (state) => state.id === currentStateId,
  );

  const allowProposals = currentState?.config?.allowProposals !== false; // defaults to true
  const hasVoted = voteStatus?.hasVoted || false;

  // TODO: special key for People powered translations as a stop-gap
  const description = instance?.description?.match('PPDESCRIPTION')
    ? t('PPDESCRIPTION')
    : (instance.description ?? instance.process?.description);

  const uniqueSubmitters = getUniqueSubmitters(proposals);
  // TODO: This match statement is all going to go away. We are going to move all of this into a modal instead so hardcoding here won't be tech-debt.
  // We just need to be sure to move this content into the instance data
  return (
    <div className="min-h-full px-4 py-8">
      <div className="mx-auto flex max-w-3xl flex-col justify-center gap-4">
        <div className="flex flex-col gap-2 text-center">
          {match(slug, {
            'people-powered': (
              <>
                <GradientHeader className="items-center align-middle uppercase">
                  {t(
                    "Decide how to allocate part of People Powered's budget for 2026",
                  )}
                </GradientHeader>
                <p className="mt-4 text-base text-gray-700">
                  <p>
                    {t(
                      'During 2023, People Powered members and staff co-created the strategic plan that guides our work from 2024 to 2026.',
                    )}
                  </p>
                  <p>
                    {t(
                      "Now, you will decide how to allocate part of People Powered's 2026 budget, in order to advance our strategic plan and move us toward the future horizons of participatory democracy.",
                    )}
                  </p>
                  <p>
                    {' '}
                    {t(
                      'This is the idea collection phase! You can submit your ideas, even if they are not structured yet. We will have time to develop them in the next phase!',
                    )}
                  </p>
                </p>
              </>
            ),
            cowop: (
              <>
                <GradientHeader className="items-center align-middle uppercase">
                  {t('COWOPHEADER')}
                </GradientHeader>
                {
                  <p className="mt-4 text-base text-gray-700">
                    <p>
                      <a
                        href="https://docs.google.com/document/d/18RFVgnAnEawOb8vU8SU6s0zL9XTyTS7-Ju6TalWQMnA/edit?tab=t.0#heading=h.7vhwsm8mmlge"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal"
                      >
                        {t('Submit a Proposal Concept')}
                      </a>
                      : {t('COWOPSUBHEADER')}
                    </p>
                  </p>
                }
              </>
            ),

            'one-project': (
              <>
                <GradientHeader className="items-center align-middle uppercase">
                  {hasVoted
                    ? t('YOUR BALLOT IS IN.')
                    : match(currentState?.id, {
                        review: () => t('TIME TO VOTE.'),
                        voting: () => t('COMMITTEE DELIBERATION.'), // This being voting is a side-effect of having copied another voting process in a pinch. This should all be removed soon.
                        _: () => t('SHARE YOUR IDEAS.'),
                      })}
                </GradientHeader>
                {
                  <div className="mt-4 flex flex-col gap-2 text-base text-gray-700">
                    <p>
                      Step 1: Click “Read Full Proposal” to learn more about
                      each. Anyone can leave comments or “like” a proposal.
                    </p>
                    <p>
                      Step 2: Choose one person from your organization to cast
                      your votes.
                    </p>
                    <p>
                      Each organization gets 5 votes to identify the proposals
                      they think would be most impactful and aligned with the
                      goal of supporting and/or establishing mutual aid
                      infrastructure for our ecosystems.
                    </p>
                    <p>
                      Questions? Reach out to Meg{' '}
                      <a
                        className="hover:text-underline text-primary-teal"
                        href="mailto:meg@oneproject.org"
                      >
                        meg@oneproject.org
                      </a>
                    </p>

                    {currentState?.id === 'review' ? (
                      <p>
                        Please select{' '}
                        <strong>
                          {
                            instance?.instanceData?.fieldValues
                              ?.maxVotesPerMember as number
                          }{' '}
                          proposals.
                        </strong>
                      </p>
                    ) : null}
                  </div>
                }
              </>
            ),
            _: (
              <>
                <GradientHeader className="items-center align-middle uppercase">
                  {hasVoted
                    ? t('YOUR BALLOT IS IN.')
                    : match(currentState?.id, {
                        voting: () => t('TIME TO VOTE.'),
                        _: () => t('SHARE YOUR IDEAS.'),
                      })}
                </GradientHeader>
                {
                  <div className="flex flex-col gap-2 pb-2 text-base text-gray-700">
                    <p>Help determine how we invest our snack budget.</p>
                    {currentState?.id === 'voting' ? (
                      <p>
                        Please select{' '}
                        <strong>
                          {
                            instance?.instanceData?.fieldValues
                              ?.maxVotesPerMember as number
                          }{' '}
                          proposals.
                        </strong>
                      </p>
                    ) : null}
                  </div>
                }
              </>
            ),
          })}

          {/* Member avatars showing who submitted proposals */}
          {uniqueSubmitters.length > 0 && (
            <div className="flex items-center justify-center gap-2">
              <GrowingFacePile
                maxItems={20}
                items={uniqueSubmitters.map((submitter) => (
                  <Link
                    key={submitter.slug}
                    href={`/profile/${submitter.slug}`}
                    className="hover:no-underline"
                  >
                    <Avatar
                      placeholder={submitter.name || submitter.slug || 'U'}
                    >
                      {submitter.avatarImage?.name ? (
                        <Image
                          src={getPublicUrl(submitter.avatarImage.name) ?? ''}
                          alt={submitter.name || submitter.slug || ''}
                          width={32}
                          height={32}
                          className="aspect-square object-cover"
                        />
                      ) : null}
                    </Avatar>
                    <div className="absolute left-0 top-0 h-full w-full cursor-pointer rounded-full bg-white opacity-0 transition-opacity duration-100 ease-in-out active:bg-black hover:opacity-15" />
                  </Link>
                ))}
              >
                <span className="w-fit text-sm text-neutral-charcoal">
                  {uniqueSubmitters.length}{' '}
                  {pluralize(t('member'), uniqueSubmitters.length)}{' '}
                  {uniqueSubmitters.length > 1 ? t('have') : t('has')}{' '}
                  {t('submitted proposals')}
                </span>
              </GrowingFacePile>
            </div>
          )}
        </div>
        <div className="flex w-full justify-center">
          <div className="flex w-full max-w-md flex-col items-center justify-center gap-4 sm:flex-row">
            {description ? (
              <DialogTrigger>
                <Button color="secondary" className="w-full">
                  {t('About the process')}
                </Button>

                <Modal isDismissable>
                  <Dialog>
                    <ModalHeader>{t('About the process')}</ModalHeader>
                    <ModalBody>
                      <RichTextEditorContent
                        content={description}
                        readOnly={true}
                        editorClassName="prose prose-base max-w-none [&_p]:text-base"
                      />
                    </ModalBody>
                  </Dialog>
                </Modal>
              </DialogTrigger>
            ) : null}
            {allowProposals && (
              <Button
                color="primary"
                className="w-full"
                isDisabled={isNavigating}
                onPress={() => {
                  setIsNavigating(true);
                  router.push(
                    `/profile/${slug}/decisions/${instanceId}/proposal/create`,
                  );
                }}
              >
                {isNavigating ? <LoadingSpinner /> : null}
                {t('Submit a proposal')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
