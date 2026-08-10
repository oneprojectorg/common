'use client';

import { useMediaQuery } from '@op/hooks';
import { Button } from '@op/sense/Button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Sheet, SheetContent } from '@op/sense/Sheet';
import { cn } from '@op/sense/lib/utils';
import { screens } from '@op/styles/constants';
import { type ReactNode, useState } from 'react';
import { LuChevronDown } from 'react-icons/lu';

interface SelectOption<T extends string> {
  id: T;
  label: ReactNode;
  /** Plain-text value for typeahead — required when `label` isn't a plain string. */
  textValue?: string;
  isDisabled?: boolean;
}

interface ResponsiveSelectProps<T extends string> {
  /** Currently selected value */
  selectedKey: T;
  /** Called when selection changes */
  onSelectionChange: (key: T) => void;
  /** Available options */
  items: SelectOption<T>[];
  /** Accessible label for the select */
  'aria-label'?: string;
  /** Additional class for the trigger button/select */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'default';
  /** Render custom label for selected item (defaults to item.label) */
  renderSelectedLabel?: (item: SelectOption<T> | undefined) => ReactNode;
}

/**
 * A select component that renders as a native Select on desktop
 * and a bottom sheet Modal on mobile devices.
 */
export function ResponsiveSelect<T extends string>({
  selectedKey,
  onSelectionChange,
  items,
  'aria-label': ariaLabel,
  className = 'min-w-36',
  size = 'default',
  renderSelectedLabel,
}: ResponsiveSelectProps<T>) {
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);
  const [isOpen, setIsOpen] = useState(false);

  const selectedItem = items.find((item) => item.id === selectedKey);
  const displayLabel = renderSelectedLabel
    ? renderSelectedLabel(selectedItem)
    : (selectedItem?.label ?? '');

  if (isMobile) {
    return (
      <>
        <Button
          variant="outline"
          size={size}
          className={`${className} max-w-48 shrink-0 justify-between shadow-none`}
          onClick={() => setIsOpen(true)}
        >
          <span className="min-w-0 overflow-hidden whitespace-nowrap">
            {displayLabel}
          </span>
          <LuChevronDown className="size-4 shrink-0" />
        </Button>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          {/* Native bottom sheet (side="bottom"). Keyboard nav is plain tab
              order through the option buttons, not react-aria's roving
              selection — acceptable for this short single-select list. */}
          <SheetContent
            side="bottom"
            aria-label={ariaLabel}
            showCloseButton={false}
            className="max-h-[calc(100svh-5rem)] gap-0 overflow-hidden rounded-t-lg border-0 p-0"
          >
            <div className="pb-safe flex flex-col overflow-y-auto">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.isDisabled}
                  className={cn(
                    'bg-transparent px-6 py-4 text-start outline-0 focus-visible:bg-primary-tealWhite focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-primary-teal disabled:pointer-events-none disabled:opacity-50',
                    index < items.length - 1 && 'border-b border-border',
                    item.id === selectedKey && 'bg-primary-tealWhite',
                  )}
                  onClick={() => {
                    onSelectionChange(item.id);
                    setIsOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Select
      value={selectedKey}
      onValueChange={(value) => {
        if (value !== null) {
          onSelectionChange(value);
        }
      }}
    >
      <SelectTrigger size={size} className={className} aria-label={ariaLabel}>
        <SelectValue>{() => displayLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent size={size}>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem
              key={item.id}
              value={item.id}
              disabled={item.isDisabled}
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
