import type { Meta, StoryObj } from '@storybook/react';
import { use, useState } from 'react';
import { DisclosureStateContext } from 'react-aria-components';
import { LuPlus } from 'react-icons/lu';

import { DragHandle, Sortable } from '../src/components/Sortable';
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionIndicator,
  AccordionItem,
  AccordionTrigger,
} from '../src/components/ui/accordion';
import { cn } from '../src/lib/utils';

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

const meta: Meta<typeof Accordion> = {
  title: 'Accordion',
  component: Accordion,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Accordion>;

export const Default: Story = {
  render: () => (
    <div className="w-[400px]">
      <Accordion defaultExpandedKeys={['1']}>
        <AccordionItem id="1">
          <AccordionHeader>
            <AccordionTrigger>
              <AccordionIndicator />
              <span>What is React Aria?</span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionContent>
            React Aria is a library of React Hooks that provides accessible UI
            primitives for your design system. It provides accessibility and
            behavior according to WAI-ARIA Authoring Practices.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem id="2">
          <AccordionHeader>
            <AccordionTrigger>
              <AccordionIndicator />
              <span>How does it work?</span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionContent>
            React Aria separates behavior and accessibility from the DOM
            structure, giving you full control over the rendered output while
            ensuring your components are accessible to all users.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem id="3">
          <AccordionHeader>
            <AccordionTrigger>
              <AccordionIndicator />
              <span>Can I customize the styling?</span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionContent>
            Yes! React Aria Components are completely unstyled by default. You
            have full control over the DOM structure and styling of your
            components using any CSS solution.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

export const MultipleExpanded: Story = {
  render: () => (
    <div className="w-[400px]">
      <Accordion allowsMultipleExpanded defaultExpandedKeys={['1', '2']}>
        <AccordionItem id="1">
          <AccordionHeader>
            <AccordionTrigger>
              <AccordionIndicator />
              <span>Section 1</span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionContent>
            Content for section 1. Multiple sections can be open at once.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem id="2">
          <AccordionHeader>
            <AccordionTrigger>
              <AccordionIndicator />
              <span>Section 2</span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionContent>
            Content for section 2. Try opening section 3 - this one stays open!
          </AccordionContent>
        </AccordionItem>

        <AccordionItem id="3">
          <AccordionHeader>
            <AccordionTrigger>
              <AccordionIndicator />
              <span>Section 3</span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionContent>Content for section 3.</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

interface FormSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

const initialSections: FormSection[] = [
  {
    id: 'proposal',
    title: 'Proposal Submission',
    content: (
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Headline</label>
          <input
            type="text"
            defaultValue="Share your proposals."
            className="w-full rounded-md border border-border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            rows={3}
            className="w-full rounded-md border border-border px-3 py-2"
            defaultValue="Enter your proposal details here..."
          />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium">Start date</label>
            <input
              type="date"
              className="w-full rounded-md border border-border px-3 py-2"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium">End date</label>
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

export const CustomHeader: Story = {
  name: 'Custom Header (Form Builder)',
  render: function FormBuilderStory() {
    const [sections, setSections] = useState<FormSection[]>(initialSections);

    return (
      <div className="w-[500px]">
        <Accordion defaultExpandedKeys={['proposal']} allowsMultipleExpanded>
          <Sortable
            items={sections}
            onChange={setSections}
            dragTrigger="handle"
            getItemLabel={(section) => section.title}
            className="gap-2"
            dropIndicator="placeholder"
          >
            {(section, { dragHandleProps, isDragging }) => (
              <AccordionItem
                id={section.id}
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
                  <AccordionTrigger
                    unstyled
                    className="flex items-center gap-2"
                  >
                    <AccordionIndicator />
                  </AccordionTrigger>
                  <AccordionTitleInput defaultValue={section.title} />
                </AccordionHeader>
                <AccordionContent unstyled>
                  <div className="border-t border-border px-4 py-4">
                    {section.content}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Sortable>
        </Accordion>
      </div>
    );
  },
};

export const Nested: Story = {
  render: () => (
    <div className="w-[400px]">
      <Accordion defaultExpandedKeys={['outer']}>
        <AccordionItem id="outer">
          <AccordionHeader>
            <AccordionTrigger>
              <AccordionIndicator />
              <span>Main Settings</span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionContent>
            <p className="mb-4">
              Configure the main settings for your project.
            </p>

            <Accordion>
              <AccordionItem id="advanced">
                <AccordionHeader className="rounded-md bg-muted/50 px-3 py-2">
                  <AccordionTrigger>
                    <LuPlus className="size-4 text-primary" />
                    <span className="text-sm text-primary">
                      Advanced options
                    </span>
                  </AccordionTrigger>
                </AccordionHeader>
                <AccordionContent className="pt-2">
                  <div className="space-y-2 text-sm text-muted-fg">
                    <p>Advanced configuration options go here.</p>
                    <ul className="list-inside list-disc">
                      <li>Custom validation rules</li>
                      <li>API integration settings</li>
                      <li>Performance tuning</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

export const Controlled: Story = {
  render: function ControlledStory() {
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
      new Set(['1']),
    );

    return (
      <div className="w-[400px]">
        <div className="mb-4 flex gap-2">
          <button
            className="text-primary-fg rounded-md bg-primary px-3 py-1 text-sm"
            onClick={() => setExpandedKeys(new Set(['1', '2', '3']))}
          >
            Expand All
          </button>
          <button
            className="rounded-md bg-secondary px-3 py-1 text-sm text-secondary-fg"
            onClick={() => setExpandedKeys(new Set())}
          >
            Collapse All
          </button>
        </div>

        <Accordion
          expandedKeys={expandedKeys}
          onExpandedChange={(keys) => setExpandedKeys(keys as Set<string>)}
          allowsMultipleExpanded
        >
          <AccordionItem id="1">
            <AccordionHeader>
              <AccordionTrigger>
                <AccordionIndicator />
                <span>Section 1</span>
              </AccordionTrigger>
            </AccordionHeader>
            <AccordionContent>Content for section 1.</AccordionContent>
          </AccordionItem>

          <AccordionItem id="2">
            <AccordionHeader>
              <AccordionTrigger>
                <AccordionIndicator />
                <span>Section 2</span>
              </AccordionTrigger>
            </AccordionHeader>
            <AccordionContent>Content for section 2.</AccordionContent>
          </AccordionItem>

          <AccordionItem id="3">
            <AccordionHeader>
              <AccordionTrigger>
                <AccordionIndicator />
                <span>Section 3</span>
              </AccordionTrigger>
            </AccordionHeader>
            <AccordionContent>Content for section 3.</AccordionContent>
          </AccordionItem>
        </Accordion>

        <p className="mt-4 text-sm text-muted-fg">
          Expanded: {Array.from(expandedKeys).join(', ') || 'none'}
        </p>
      </div>
    );
  },
};

export const Unstyled: Story = {
  render: () => (
    <div className="w-[400px]">
      <Accordion unstyled defaultExpandedKeys={['1']}>
        <AccordionItem
          id="1"
          className="mb-2 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50"
        >
          <AccordionHeader className="p-4">
            <AccordionTrigger className="flex w-full items-center justify-between text-purple-700">
              <span>Custom Styled Section 1</span>
              <AccordionIndicator className="text-purple-500" />
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionContent className="p-4 pt-0">
            <p className="text-purple-600">
              This accordion uses unstyled mode with custom classes.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          id="2"
          className="mb-2 rounded-lg border-2 border-dashed border-teal-300 bg-teal-50"
        >
          <AccordionHeader className="p-4">
            <AccordionTrigger className="flex w-full items-center justify-between text-teal-700">
              <span>Custom Styled Section 2</span>
              <AccordionIndicator className="text-teal-500" />
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionContent className="p-4 pt-0">
            <p className="text-teal-600">
              You have full control over the styling!
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-[400px]">
      <Accordion defaultExpandedKeys={['1']}>
        <AccordionItem id="1">
          <AccordionHeader>
            <AccordionTrigger>
              <AccordionIndicator />
              <span>Enabled Section</span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionContent>This section works normally.</AccordionContent>
        </AccordionItem>

        <AccordionItem id="2" isDisabled>
          <AccordionHeader>
            <AccordionTrigger>
              <AccordionIndicator />
              <span>Disabled Section</span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionContent>
            You should not be able to see this.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem id="3">
          <AccordionHeader>
            <AccordionTrigger>
              <AccordionIndicator />
              <span>Another Enabled Section</span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionContent>This section also works normally.</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

export const WithShowIndicator: Story = {
  name: 'Using showIndicator prop',
  render: () => (
    <div className="w-[400px]">
      <Accordion defaultExpandedKeys={['1']}>
        <AccordionItem id="1">
          <AccordionHeader>
            <AccordionTrigger showIndicator>
              <span>Indicator at Start (default)</span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionContent>
            Using showIndicator prop adds the chevron automatically.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem id="2">
          <AccordionHeader>
            <AccordionTrigger showIndicator indicatorPosition="end">
              <span>Indicator at End</span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionContent>
            Set indicatorPosition="end" to move it to the right.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};
