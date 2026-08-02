'use client';

import { useMediaQuery } from '@op/hooks';
import { Button } from '@op/sense/Button';
import { Dialog, DialogContent } from '@op/sense/Dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
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
  size?: 'small' | 'medium';
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
  size = 'small',
  renderSelectedLabel,
}: ResponsiveSelectProps<T>) {
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);
  const [isOpen, setIsOpen] = useState(false);

  const triggerSize = size === 'small' ? 'sm' : 'default';
  const selectedItem = items.find((item) => item.id === selectedKey);
  const displayLabel = renderSelectedLabel
    ? renderSelectedLabel(selectedItem)
    : (selectedItem?.label ?? '');

  if (isMobile) {
    return (
      <>
        <Button
          variant="outline"
          size={triggerSize}
          className={`${className} max-w-48 shrink-0 justify-between shadow-none`}
          onClick={() => setIsOpen(true)}
        >
          <span className="min-w-0 overflow-hidden whitespace-nowrap">
            {displayLabel}
          </span>
          <LuChevronDown className="size-4 shrink-0" />
        </Button>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent
            aria-label={ariaLabel}
            showCloseButton={false}
            className="top-auto bottom-0 left-1/2 m-0 h-auto max-h-[calc(100svh-5rem)] w-screen max-w-none -translate-x-1/2 translate-y-0 gap-0 rounded-t-2xl rounded-b-none border-0 p-0 duration-300 ease-out data-open:slide-in-from-bottom-full"
          >
            {/* TODO(sense-migration): the @op/ui Modal + MenuList bottom sheet
                had no sense structural equivalent; this reproduces the sheet
                with a Dialog + native option buttons. Roving keyboard
                selection from react-aria's MenuList is replaced by native
                button focus. */}
            <div className="pb-safe flex flex-col p-0">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.isDisabled}
                  className={cn(
                    'bg-transparent px-6 py-4 text-start outline-0 focus-visible:bg-primary-tealWhite focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-primary-teal disabled:pointer-events-none disabled:opacity-50',
                    index === 0
                      ? 'rounded-t-2xl rounded-b-none'
                      : 'rounded-none',
                    index < items.length - 1 && 'border-b border-neutral-gray1',
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
          </DialogContent>
        </Dialog>
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
      <SelectTrigger
        size={triggerSize}
        className={className}
        aria-label={ariaLabel}
      >
        <SelectValue>{() => displayLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent size={triggerSize}>
        {items.map((item) => (
          <SelectItem key={item.id} value={item.id} disabled={item.isDisabled}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
