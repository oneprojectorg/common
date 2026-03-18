import { useState } from 'react';
import {
  LuAlignLeft,
  LuChevronDown,
  LuHash,
  LuLetterText,
} from 'react-icons/lu';

import {
  CollapsibleConfigCard,
  CollapsibleConfigCardDragPreview,
} from '../src/components/CollapsibleConfigCard';
import type { SortableItemControls } from '../src/components/Sortable';

export default {
  title: 'CollapsibleConfigCard',
  component: CollapsibleConfigCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

const mockControls: SortableItemControls = {
  dragHandleProps: {
    ref: () => {},
    tabIndex: 0,
    role: 'button',
    'aria-roledescription': 'sortable',
    'aria-describedby': 'sortable-description',
    'aria-disabled': false,
    'aria-pressed': undefined,
  },
  isDragging: false,
  isDropTarget: false,
  index: 0,
};

/**
 * Collapsed state — shows header with icon pill, badge, and chevron.
 */
export const Collapsed = () => {
  return (
    <div className="w-[500px]">
      <CollapsibleConfigCard
        icon={LuAlignLeft}
        label="Project name"
        badgeLabel="Required"
        isCollapsible
        controls={mockControls}
      >
        <div className="px-8">
          <p className="text-neutral-charcoal">
            This is the expanded body content.
          </p>
        </div>
      </CollapsibleConfigCard>
    </div>
  );
};

/**
 * Expanded state — body visible, chevron rotated.
 */
export const Expanded = () => {
  return (
    <div className="w-[500px]">
      <CollapsibleConfigCard
        icon={LuLetterText}
        label="Project description"
        badgeLabel="Optional"
        isCollapsible
        defaultExpanded
        controls={mockControls}
      >
        <div className="space-y-4 px-8">
          <p className="text-neutral-charcoal">
            This card starts expanded. The chevron is rotated.
          </p>
          <div className="rounded border bg-neutral-gray1 p-3">
            <span className="text-sm text-neutral-gray4">
              Configuration options would go here
            </span>
          </div>
        </div>
      </CollapsibleConfigCard>
    </div>
  );
};

/**
 * Newly added — teal border fades out after a few seconds.
 */
export const NewlyAdded = () => {
  return (
    <div className="w-[500px]">
      <CollapsibleConfigCard
        icon={LuAlignLeft}
        label="Project name"
        badgeLabel="Required"
        isCollapsible
        defaultExpanded
        className="animate-border-highlight"
        controls={mockControls}
      >
        <div className="px-8">
          <p className="text-neutral-charcoal">
            This card has a teal border that fades out after 3 seconds.
          </p>
        </div>
      </CollapsibleConfigCard>
    </div>
  );
};

/**
 * Locked variant — lock icon, no drag handle, no pill.
 */
export const Locked = () => {
  return (
    <div className="w-[500px] space-y-3">
      <CollapsibleConfigCard
        icon={LuAlignLeft}
        label="Proposal title"
        badgeLabel="Required"
        locked
      />
      <CollapsibleConfigCard
        icon={LuChevronDown}
        label="Category"
        badgeLabel="Optional"
        locked
      >
        <div className="px-8 pt-2">
          <p className="text-neutral-charcoal">
            These are the categories you defined in Proposal Categories.
          </p>
        </div>
      </CollapsibleConfigCard>
    </div>
  );
};

/**
 * Locked + collapsible (e.g. Budget field).
 */
export const LockedCollapsible = () => {
  return (
    <div className="w-[500px]">
      <CollapsibleConfigCard
        icon={LuHash}
        label="Budget"
        badgeLabel="Optional"
        isCollapsible
        defaultExpanded
        locked
      >
        <div className="space-y-4 px-8">
          <div className="flex items-center justify-between">
            <span className="text-neutral-charcoal">Show in template?</span>
            <span className="text-sm text-neutral-gray4">Toggle here</span>
          </div>
        </div>
      </CollapsibleConfigCard>
    </div>
  );
};

/**
 * Multiple collapsible cards — each manages own state.
 */
export const MultipleCards = () => {
  const [expandedId, setExpandedId] = useState<string | null>('1');

  const cards = [
    { id: '1', label: 'Project name', icon: LuAlignLeft, badge: 'Required' },
    {
      id: '2',
      label: 'Description',
      icon: LuLetterText,
      badge: 'Optional',
    },
    { id: '3', label: 'Category', icon: LuChevronDown, badge: 'Required' },
  ];

  return (
    <div className="w-[500px] space-y-3">
      {cards.map((card) => (
        <CollapsibleConfigCard
          key={card.id}
          icon={card.icon}
          label={card.label}
          badgeLabel={card.badge}
          isCollapsible
          isExpanded={expandedId === card.id}
          onExpandedChange={(expanded) =>
            setExpandedId(expanded ? card.id : null)
          }
          controls={mockControls}
        >
          <div className="px-8">
            <p className="text-neutral-charcoal">
              Configuration for {card.label}
            </p>
          </div>
        </CollapsibleConfigCard>
      ))}
    </div>
  );
};

/**
 * Drag preview.
 */
export const DragPreview = () => {
  return (
    <div className="space-y-4">
      <CollapsibleConfigCardDragPreview
        icon={LuAlignLeft}
        label="Project name"
      />
      <CollapsibleConfigCardDragPreview
        icon={LuLetterText}
        label="Project description"
      />
    </div>
  );
};
