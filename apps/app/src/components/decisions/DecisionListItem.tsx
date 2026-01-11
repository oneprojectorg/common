import { getPublicUrl } from '@/utils';
import { DecisionProfile } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { Chip } from '@op/ui/Chip';
import { Header3 } from '@op/ui/Header';
import { cn } from '@op/ui/utils';
import Image from 'next/image';
import { LuCalendar } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { TranslatedText } from '../TranslatedText';

const formatDateShort = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
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

export const DecisionListItem = ({ item }: { item: DecisionProfile }) => {
  const { processInstance } = item;

  // Get current state name from process schema
  const currentStateName =
    processInstance?.process?.processSchema?.states?.find(
      (state) => state.id === processInstance.currentStateId,
    )?.name;

  // Get closing date from phases - find the current phase's end date
  const currentPhase = processInstance?.instanceData?.phases?.find(
    (phase) => phase.phaseId === processInstance.currentStateId,
  );
  const closingDate = currentPhase?.endDate;

  // Owner organization info
  const owner = processInstance?.owner;

  return (
    <Link
      href={`/decisions/${item.slug}`}
      className="sm:border-b-neutral-gray1 gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-none sm:border-0 sm:border-b flex flex-col rounded-lg border hover:bg-primary-tealWhite hover:no-underline"
    >
      <div className="gap-2 flex flex-col">
        {/* Process name and status chip */}
        <DecisionProcessHeader
          name={processInstance?.name || item.name}
          currentState={currentStateName}
        />

        {/* Organization and closing date */}
        <div className="gap-2 py-1 sm:gap-6 flex flex-wrap items-center text-xs">
          {owner && (
            <div className="gap-1 flex items-center">
              <Avatar placeholder={owner.name} className="size-4 border">
                {owner.avatarImage?.name ? (
                  <Image
                    src={getPublicUrl(owner.avatarImage.name) ?? ''}
                    alt={`${owner.name} avatar`}
                    fill
                    className="object-cover"
                  />
                ) : null}
              </Avatar>
              <span className="text-sm text-neutral-black">{owner.name}</span>
            </div>
          )}

          {closingDate && <DecisionClosingDate closingDate={closingDate} />}
        </div>
      </div>

      <div className="gap-4 sm:items-center sm:gap-12 flex items-end text-neutral-black">
        <DecisionStat
          number={processInstance?.participantCount ?? 0}
          label="Participants"
        />
        <DecisionStat
          number={processInstance?.proposalCount ?? 0}
          label="Proposals"
        />
      </div>
    </Link>
  );
};

export const ProfileDecisionListItem = ({
  item,
  className,
}: {
  item: DecisionProfile;
  className?: string;
}) => {
  const { processInstance } = item;

  // Get current state name from process schema
  const currentStateName =
    processInstance?.process?.processSchema?.states?.find(
      (state) => state.id === processInstance.currentStateId,
    )?.name;

  // Get closing date from phases - find the current phase's end date
  const currentPhase = processInstance?.instanceData?.phases?.find(
    (phase) => phase.phaseId === processInstance.currentStateId,
  );
  const closingDate = currentPhase?.endDate;

  return (
    <Link
      href={`/decisions/${item.slug}`}
      className={cn('gap-4 pb-4 flex flex-col hover:no-underline', className)}
    >
      <div className="gap-2 flex flex-col">
        {/* Process name and status chip */}
        <DecisionProcessHeader
          name={processInstance?.name || item.name}
          currentState={currentStateName}
        />

        {/* Organization and closing date */}
        <div className="gap-2 py-1 sm:flex-row sm:items-center sm:justify-between flex flex-col flex-wrap text-xs">
          {closingDate && <DecisionClosingDate closingDate={closingDate} />}
          <div className="gap-4 flex items-end text-neutral-black">
            <DecisionStat
              number={processInstance?.participantCount ?? 0}
              label="Participants"
              className="sm:flex-row sm:items-end sm:gap-1"
            />
            <DecisionStat
              number={processInstance?.proposalCount ?? 0}
              label="Proposals"
              className="sm:flex-row sm:items-end sm:gap-1"
            />
          </div>
        </div>
      </div>
    </Link>
  );
};

const DecisionStat = ({
  number,
  label,
  className,
}: {
  number: number;
  label: string;
  className?: string;
}) => (
  <div
    className={cn(
      'gap-1 sm:flex-col sm:items-center sm:gap-0 flex items-end',
      className,
    )}
  >
    <span className="font-serif text-title-base">{number}</span>
    <span className="text-sm">
      <TranslatedText text={label} />
    </span>
  </div>
);

const DecisionClosingDate = ({ closingDate }: { closingDate: string }) => {
  return (
    <div className="gap-1 flex items-center">
      <LuCalendar
        className={`size-4 ${isClosingSoon(closingDate) ? 'text-functional-red' : 'text-neutral-charcoal'}`}
      />
      <span
        className={cn(
          isClosingSoon(closingDate)
            ? 'text-functional-red'
            : 'text-neutral-charcoal',
          'text-sm',
        )}
      >
        <TranslatedText text="Closes" /> {formatDateShort(closingDate)}
      </span>
    </div>
  );
};

const DecisionProcessHeader = ({
  name,
  currentState,
}: {
  name: string;
  currentState?: string;
}) => (
  <div className="gap-2 sm:items-center sm:justify-start flex items-start justify-between">
    <Header3 className="font-serif !text-title-base text-neutral-black">
      {name}
    </Header3>
    {currentState ? (
      <Chip className="bg-primary-tealWhite text-primary-tealBlack">
        {currentState}
      </Chip>
    ) : null}
  </div>
);
