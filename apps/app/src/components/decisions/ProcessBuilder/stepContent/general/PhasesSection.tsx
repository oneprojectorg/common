import type { SectionProps } from '../../contentRegistry';

export default function PhasesSection({
  decisionProfileId,
  decisionName,
}: SectionProps) {
  return (
    <div className="p-4 sm:p-8">
      <h2 className="text-xl font-semibold">Phases</h2>
      <p className="text-neutral-gray4">Decision: {decisionName}</p>
      <p className="text-neutral-gray4">ID: {decisionProfileId}</p>
      {/* TODO: Implement phases configuration */}
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
    <div className="w-[500px]">
      <Accordion defaultExpandedKeys={['proposal']} allowsMultipleExpanded>
        <Sortable
          items={phases}
          onChange={setPhases}
          dragTrigger="handle"
          getItemLabel={(phase) => phase.title}
          className="gap-2"
          dropIndicator="line"
        >
          {(phase, { dragHandleProps, isDragging }) => (
            <AccordionItem
              id={phase.id}
              unstyled
              className={cn(
                'rounded-lg border border-border bg-white shadow-sm',
                isDragging && 'opacity-50',
              )}
            >
              <AccordionHeader
                unstyled
                className="flex items-center gap-2 px-3 py-2"
              >
                <DragHandle {...dragHandleProps} />
                <AccordionTrigger unstyled className="flex items-center gap-2">
                  <AccordionIndicator />
                </AccordionTrigger>
                <AccordionTitleInput defaultValue={phase.title} />
              </AccordionHeader>
              <AccordionContent unstyled>
                <div className="border-t border-border px-4 py-4">
                  {phase.content}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Sortable>
      </Accordion>
    </div>
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
        'flex-1 rounded border bg-transparent px-2 py-1 font-serif text-title-sm font-medium',
        'disabled:cursor-default disabled:border-transparent',
        'enabled:bg-neutral-gray1 enabled:focus:border enabled:focus:bg-white',
        className,
      )}
    />
  );
};
