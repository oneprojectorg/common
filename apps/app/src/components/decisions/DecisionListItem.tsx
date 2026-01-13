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
      className="flex flex-col gap-4 rounded-lg border p-4 hover:bg-primary-tealWhite hover:no-underline sm:flex-row sm:items-center sm:justify-between sm:rounded-none sm:border-0 sm:border-b sm:border-b-neutral-gray1"
    >
      <div className="flex flex-col gap-2">
        {/* Process name and status chip */}
        <DecisionProcessHeader
          name={processInstance?.name || item.name}
          currentState={currentStateName}
        />

        {/* Organization and closing date */}
        <div className="flex flex-wrap items-center gap-2 py-1 text-xs sm:gap-6">
          {owner && (
            <div className="flex items-center gap-1">
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

      <div className="flex items-end gap-4 text-neutral-black sm:items-center sm:gap-12">
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
      className={cn('flex flex-col gap-4 pb-4 hover:no-underline', className)}
    >
      <div className="flex flex-col gap-2">
        {/* Process name and status chip */}
        <DecisionProcessHeader
          name={processInstance?.name || item.name}
          currentState={currentStateName}
        />

        {/* Organization and closing date */}
        <div className="flex flex-col flex-wrap gap-2 py-1 text-xs sm:flex-row sm:items-center sm:justify-between">
          {closingDate && <DecisionClosingDate closingDate={closingDate} />}
          <div className="flex items-end gap-4 text-neutral-black">
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
      'flex items-end gap-1 sm:flex-col sm:items-center sm:gap-0',
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
    <div className="flex items-center gap-1">
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
  <div className="flex items-start justify-between gap-2 sm:items-center sm:justify-start">
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
