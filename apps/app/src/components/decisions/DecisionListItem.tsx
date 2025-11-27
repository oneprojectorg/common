import { RouterOutput } from '@op/api/client';
import { Avatar } from '@op/ui/Avatar';
import { Chip } from '@op/ui/Chip';
import { Calendar } from 'lucide-react';
import Image from 'next/image';

import { Link } from '@/lib/i18n';
import { getPublicUrl } from '@/utils';

type DecisionProfileItem =
  RouterOutput['decision']['listDecisionProfiles']['items'][number];

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const isClosingSoon = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const daysUntilClose = Math.ceil(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  return daysUntilClose >= 0 && daysUntilClose <= 7;
};

export const DecisionListItem = ({ item }: { item: DecisionProfileItem }) => {
  const { processInstance } = item;

  // Get current state name from process schema
  const currentStateName = processInstance?.process?.processSchema?.states?.find(
    (state) => state.id === processInstance.currentStateId,
  )?.name;

  // Get closing date from phases - find the current phase's end date
  const currentPhase = processInstance?.instanceData?.phases?.find(
    (phase) => phase.stateId === processInstance.currentStateId,
  );
  const closingDate = currentPhase?.plannedEndDate;

  // Owner organization info
  const owner = processInstance?.owner;

  return (
    <Link
      href={`/decisions/${item.slug}`}
      className="flex items-center justify-between border-b border-neutral-gray1 p-4 transition-colors hover:bg-neutral-offWhite hover:no-underline"
    >
      <div className="flex flex-col gap-1">
        {/* Process name and status chip */}
        <div className="flex items-center gap-2">
          <span className="font-serif text-xl font-light tracking-tight text-neutral-black">
            {processInstance?.name || item.name}
          </span>
          {currentStateName && (
            <Chip className="bg-primary-teal96White text-[10px] text-primary-tealBlack">
              {currentStateName}
            </Chip>
          )}
        </div>

        {/* Organization and closing date */}
        <div className="flex items-center gap-6 pt-0.5 text-xs">
          {owner && (
            <div className="flex items-center gap-1">
              <Avatar placeholder={owner.name} className="size-4">
                {owner.avatarImage?.name ? (
                  <Image
                    src={getPublicUrl(owner.avatarImage.name) ?? ''}
                    alt={`${owner.name} avatar`}
                    fill
                    className="object-cover"
                  />
                ) : null}
              </Avatar>
              <span className="text-neutral-black">{owner.name}</span>
            </div>
          )}

          {closingDate && (
            <div className="flex items-center gap-1">
              <Calendar className="size-4 text-neutral-gray4" />
              <span
                className={
                  isClosingSoon(closingDate)
                    ? 'text-functional-red'
                    : 'text-neutral-charcoal'
                }
              >
                Closes {formatDate(closingDate)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-12">
        <div className="flex flex-col items-center text-neutral-black">
          <span className="font-serif text-xl font-light tracking-tight">
            {processInstance?.participantCount ?? 0}
          </span>
          <span className="text-xs">Participants</span>
        </div>
        <div className="flex flex-col items-center text-neutral-black">
          <span className="font-serif text-xl font-light tracking-tight">
            {processInstance?.proposalCount ?? 0}
          </span>
          <span className="text-xs">Proposals</span>
        </div>
      </div>
    </Link>
  );
};
