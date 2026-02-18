import { useState } from 'react';
import {
  LuAlignLeft,
  LuCalendar,
  LuChevronDown,
  LuHash,
  LuType,
} from 'react-icons/lu';

import {
  FieldConfigCard,
  FieldConfigCardDragPreview,
} from '../src/components/FieldConfigCard';
import { Sortable } from '../src/components/Sortable';
import type { SortableItemControls } from '../src/components/Sortable';
import { ToggleButton } from '../src/components/ToggleButton';

export default {
  title: 'FieldConfigCard',
  component: FieldConfigCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

/**
 * Mock controls to show the drag handle in standalone examples.
 * In real usage, these would come from the Sortable component.
 */
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
 * Basic field config card with editable label and description.
 */
export const Default = () => {
  const [label, setLabel] = useState('Short text');
  const [description, setDescription] = useState('');

  return (
    <div className="w-[500px]">
      <FieldConfigCard
        icon={LuType}
        iconTooltip="Short text"
        label={label}
        onLabelChange={setLabel}
        description={description}
        onDescriptionChange={setDescription}
        descriptionPlaceholder="Provide additional guidance for participants..."
        onRemove={() => alert('Remove clicked')}
        controls={mockControls}
      />
    </div>
  );
};

/**
 * Card with custom children for additional configuration options.
 */
export const WithCustomConfig = () => {
  const [label, setLabel] = useState('Dropdown');
  const [description, setDescription] = useState('');
  const [required, setRequired] = useState(false);

  return (
    <div className="w-[500px]">
      <FieldConfigCard
        icon={LuChevronDown}
        iconTooltip="Dropdown"
        label={label}
        onLabelChange={setLabel}
        description={description}
        onDescriptionChange={setDescription}
        descriptionPlaceholder="Provide additional guidance for participants..."
        onRemove={() => alert('Remove clicked')}
        controls={mockControls}
      >
        {/* Custom config section */}
        <div className="mt-4 space-y-2">
          <h4 className="text-sm text-neutral-charcoal">Options</h4>
          <div className="space-y-2">
            <div className="rounded border bg-neutral-gray1 px-3 py-2 text-sm">
              Option 1
            </div>
            <div className="rounded border bg-neutral-gray1 px-3 py-2 text-sm">
              Option 2
            </div>
            <div className="rounded border bg-neutral-gray1 px-3 py-2 text-sm">
              Option 3
            </div>
          </div>
        </div>

        {/* Required toggle */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-neutral-charcoal">Required?</span>
          <ToggleButton
            size="small"
            isSelected={required}
            onChange={setRequired}
            aria-label="Required"
          />
        </div>
      </FieldConfigCard>
    </div>
  );
};

/**
 * Card without remove button (e.g., for locked fields).
 */
export const WithoutRemoveButton = () => {
  const [label, setLabel] = useState('Date');
  const [description, setDescription] = useState('When should this happen?');

  return (
    <div className="w-[500px]">
      <FieldConfigCard
        icon={LuCalendar}
        iconTooltip="Date"
        label={label}
        onLabelChange={setLabel}
        description={description}
        onDescriptionChange={setDescription}
        descriptionPlaceholder="Provide additional guidance for participants..."
        controls={mockControls}
      />
    </div>
  );
};

/**
 * Locked card variant - non-editable with lock icon.
 */
export const Locked = () => {
  return (
    <div className="w-[500px] space-y-3">
      <FieldConfigCard
        icon={LuType}
        iconTooltip="Short text"
        label="Proposal title"
        locked
      />
      <FieldConfigCard
        icon={LuChevronDown}
        iconTooltip="Dropdown"
        label="Category"
        locked
      />
    </div>
  );
};

/**
 * Card without description field.
 */
export const WithoutDescription = () => {
  const [label, setLabel] = useState('Number');

  return (
    <div className="w-[500px]">
      <FieldConfigCard
        icon={LuHash}
        iconTooltip="Number"
        label={label}
        onLabelChange={setLabel}
        onRemove={() => alert('Remove clicked')}
        controls={mockControls}
      >
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-neutral-charcoal">Required?</span>
          <ToggleButton size="small" aria-label="Required" />
        </div>
      </FieldConfigCard>
    </div>
  );
};

interface FieldItem {
  id: string;
  type: 'short_text' | 'long_text' | 'dropdown';
  label: string;
  description: string;
  required: boolean;
}

const iconMap = {
  short_text: LuType,
  long_text: LuAlignLeft,
  dropdown: LuChevronDown,
};

const tooltipMap = {
  short_text: 'Short text',
  long_text: 'Long text',
  dropdown: 'Dropdown',
};

/**
 * Drag preview shown while dragging a card.
 */
export const DragPreview = () => {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-sm font-medium text-neutral-gray4">
          Default preview
        </h4>
        <FieldConfigCardDragPreview icon={LuType} label="Short text" />
      </div>
      <div>
        <h4 className="mb-2 text-sm font-medium text-neutral-gray4">
          With longer label
        </h4>
        <FieldConfigCardDragPreview
          icon={LuAlignLeft}
          label="Project description"
        />
      </div>
      <div>
        <h4 className="mb-2 text-sm font-medium text-neutral-gray4">
          Custom override
        </h4>
        <FieldConfigCardDragPreview icon={LuHash} label="Budget">
          <div className="flex items-center gap-2 text-primary-teal">
            <LuHash className="size-5" />
            <span className="font-medium">Moving: Budget field</span>
          </div>
        </FieldConfigCardDragPreview>
      </div>
    </div>
  );
};

/**
 * Multiple cards in a sortable list with drag handles.
 */
export const SortableList = () => {
  const [fields, setFields] = useState<FieldItem[]>([
    {
      id: '1',
      type: 'short_text',
      label: 'Project name',
      description: '',
      required: true,
    },
    {
      id: '2',
      type: 'long_text',
      label: 'Project description',
      description: 'Describe your project in detail',
      required: true,
    },
    {
      id: '3',
      type: 'dropdown',
      label: 'Category',
      description: 'Select a category',
      required: false,
    },
  ]);

  const updateField = (id: string, updates: Partial<FieldItem>) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    );
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="w-[500px]">
      <h3 className="mb-4 text-lg font-semibold">Sortable Field Cards</h3>
      <Sortable
        items={fields}
        onChange={setFields}
        dragTrigger="handle"
        getItemLabel={(field) => field.label}
        className="gap-3"
        renderDragPreview={(items) =>
          items[0] ? (
            <FieldConfigCardDragPreview
              icon={iconMap[items[0].type]}
              label={items[0].label}
            />
          ) : null
        }
      >
        {(field, controls) => (
          <FieldConfigCard
            icon={iconMap[field.type]}
            iconTooltip={tooltipMap[field.type]}
            label={field.label}
            onLabelChange={(label) => updateField(field.id, { label })}
            description={field.description}
            onDescriptionChange={(description) =>
              updateField(field.id, { description })
            }
            descriptionPlaceholder="Provide additional guidance for participants..."
            onRemove={() => removeField(field.id)}
            controls={controls}
            dragHandleAriaLabel={`Drag to reorder ${field.label}`}
          >
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-neutral-charcoal">Required?</span>
              <ToggleButton
                size="small"
                isSelected={field.required}
                onChange={(required) => updateField(field.id, { required })}
                aria-label="Required"
              />
            </div>
          </FieldConfigCard>
        )}
      </Sortable>
    </div>
  );
};
