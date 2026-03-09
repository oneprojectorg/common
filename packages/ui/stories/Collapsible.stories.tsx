import { useState } from 'react';
import { LuChevronDown } from 'react-icons/lu';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../src/components/ui/collapsible';

export default {
  title: 'Collapsible',
  component: Collapsible,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

/**
 * Default collapsible — starts collapsed.
 */
export const Default = () => {
  return (
    <div className="w-[400px]">
      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-2 text-left font-medium">
          Click to expand
          <LuChevronDown className="size-4" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 py-3">
            <p>This is the collapsible content that is revealed on expand.</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

/**
 * Starts expanded by default.
 */
export const DefaultExpanded = () => {
  return (
    <div className="w-[400px]">
      <Collapsible defaultExpanded>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-2 text-left font-medium">
          Click to collapse
          <LuChevronDown className="size-4" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 py-3">
            <p>This content starts visible and can be collapsed.</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

/**
 * Controlled expansion state via isExpanded / onExpandedChange.
 */
export const Controlled = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-[400px] space-y-2">
      <button
        type="button"
        className="rounded border px-3 py-1 text-sm"
        onClick={() => setExpanded((prev) => !prev)}
      >
        Toggle externally ({expanded ? 'expanded' : 'collapsed'})
      </button>
      <Collapsible isExpanded={expanded} onExpandedChange={setExpanded}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-2 text-left font-medium">
          Controlled Collapsible
          <LuChevronDown className="size-4" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 py-3">
            <p>Controlled by external state.</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

/**
 * Multiple independent collapsibles on the same page.
 */
export const Multiple = () => {
  return (
    <div className="w-[400px] space-y-2">
      {['Section A', 'Section B', 'Section C'].map((title) => (
        <Collapsible key={title}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-2 text-left font-medium">
            {title}
            <LuChevronDown className="size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 py-3">
              <p>Content for {title}.</p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
};
