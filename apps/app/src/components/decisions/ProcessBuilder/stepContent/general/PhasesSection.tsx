import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionIndicator,
  AccordionItem,
  AccordionTrigger,
} from '@op/ui/Accordion';
import { DragHandle, Sortable } from '@op/ui/Sortable';
import { cn } from '@op/ui/utils';
import { use, useState } from 'react';
import { DisclosureStateContext } from 'react-aria-components';
import { LuChevronRight, LuGripVertical } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { SectionProps } from '../../contentRegistry';

interface Phase {
  id: string;
  title: string;
  content: React.ReactNode;
}

const initialPhases: Phase[] = [
  {
    id: 'proposal',
    title: 'Proposal Submission',
    content: (
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm">Headline</label>
          <input
            type="text"
            defaultValue="Share your proposals."
            className="w-full rounded-md border border-border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">Description</label>
          <textarea
            rows={3}
            className="w-full rounded-md border border-border px-3 py-2"
            defaultValue="Enter your proposal details here..."
          />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm">Start date</label>
            <input
              type="date"
              className="w-full rounded-md border border-border px-3 py-2"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm">End date</label>
            <input
              type="date"
              className="w-full rounded-md border border-border px-3 py-2"
            />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'review',
    title: 'Review & Shortlisting',
    content: (
      <p className="text-muted-fg">
        Configure review and shortlisting settings...
      </p>
    ),
  },
  {
    id: 'voting',
    title: 'Voting',
    content: <p className="text-muted-fg">Configure voting settings...</p>,
  },
  {
    id: 'results',
    title: 'Results Announcement',
    content: (
      <p className="text-muted-fg">
        Configure results announcement settings...
      </p>
    ),
  },
];

export default function PhasesSection({ decisionProfileId }: SectionProps) {
  const [phases, setPhases] = useState(initialPhases);
  const t = useTranslations();
  return (
    <div className="mx-auto w-full max-w-160 space-y-4 p-4 md:p-8">
      <h2 className="font-serif text-title-sm">{t('Phases')}</h2>
      <p className="text-neutral-charcoal">
        Define the phases of your decision-making process
      </p>
      <PhaseEditor phases={phases} setPhases={setPhases} />
    </div>
  );
}

export const PhaseEditor = ({
  phases,
  setPhases,
}: {
  phases: Phase[];
  setPhases: (phases: Phase[]) => void;
}) => {
  return (
    <Accordion allowsMultipleExpanded variant="unstyled">
      <Sortable
        items={phases}
        onChange={setPhases}
        dragTrigger="handle"
        getItemLabel={(phase) => phase.title}
        className="gap-2"
        renderDragPreview={(items) => (
          <PhaseDragPreview title={items[0]?.title} />
        )}
        renderDropIndicator={PhaseDropIndicator}
      >
        {(phase, { dragHandleProps, isDragging }) => (
          <AccordionItem
            id={phase.id}
            className={cn(
              'rounded-lg border bg-white',
              isDragging && 'opacity-50',
            )}
          >
            <AccordionHeader className="flex items-center gap-2 px-3 py-2">
              <DragHandle {...dragHandleProps} />
              <AccordionTrigger className="flex items-center gap-2">
                <AccordionIndicator />
              </AccordionTrigger>
              <AccordionTitleInput defaultValue={phase.title} />
            </AccordionHeader>
            <AccordionContent>
              <hr />
              <div className="p-4">{phase.content}</div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Sortable>
    </Accordion>
  );
};

/** Input that is only editable when the accordion is expanded */
const AccordionTitleInput = ({
  defaultValue,
  className,
}: {
  defaultValue: string;
  className?: string;
}) => {
  const state = use(DisclosureStateContext);
  const isExpanded = state?.isExpanded ?? false;

  return (
    <input
      type="text"
      defaultValue={defaultValue}
      disabled={!isExpanded}
      className={cn(
        'flex-1 rounded border bg-transparent px-2 py-1 font-serif text-title-sm',
        'disabled:cursor-default disabled:border-transparent',
        'enabled:bg-neutral-gray1 enabled:focus:border enabled:focus:bg-white',
        className,
      )}
    />
  );
};

/** Element to show when a phase is being dragged */
const PhaseDragPreview = ({ title }: { title?: string }) => {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
      <div className="p-1">
        <LuGripVertical size={16} />
      </div>
      <LuChevronRight size={16} />
      <p className="px-2 py-1 font-serif text-title-sm">{title}</p>
    </div>
  );
};

/** DropIndicator to show when a phase is being dragged */
const PhaseDropIndicator = () => {
  return (
    <div className="flex h-12 items-center gap-2 rounded-lg border bg-neutral-offWhite"></div>
  );
};
