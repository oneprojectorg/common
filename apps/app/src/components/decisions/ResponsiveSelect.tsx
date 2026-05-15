'use client';

import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Button } from '@op/ui-next/Button';
import { Select, SelectItem } from '@op/ui-next/Select';
import { Sheet, SheetBody, SheetHeader } from '@op/ui-next/Sheet';
import { type ReactNode, useId, useState } from 'react';
import { LuCheck, LuChevronDown } from 'react-icons/lu';

interface SelectOption<T extends string> {
  id: T;
  label: string;
  isDisabled?: boolean;
}

interface ResponsiveSelectProps<T extends string> {
  /** Currently selected value */
  selectedKey: T;
  /** Called when selection changes */
  onSelectionChange: (key: T) => void;
  /** Available options */
  items: SelectOption<T>[];
  /**
   * Required label. Shown in the SheetHeader on mobile; used as aria-label on
   * the desktop Select trigger.
   */
  label: string;
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
  label,
  className = 'min-w-36',
  size = 'small',
  renderSelectedLabel,
}: ResponsiveSelectProps<T>) {
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);
  const [isOpen, setIsOpen] = useState(false);
  const labelId = useId();

  const selectedItem = items.find((item) => item.id === selectedKey);
  const displayLabel = renderSelectedLabel
    ? renderSelectedLabel(selectedItem)
    : (selectedItem?.label ?? '');

  if (isMobile) {
    return (
      <>
        <Button
          color="secondary"
          size={size}
          className={`${className} justify-between`}
          onPress={() => setIsOpen(true)}
        >
          {displayLabel}
          <LuChevronDown className="size-4" />
        </Button>
        <Sheet
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          side="bottom"
          className="rounded-t-2xl"
        >
          <SheetHeader titleId={labelId}>{label}</SheetHeader>
          <SheetBody className="pb-safe">
            <div
              role="listbox"
              aria-labelledby={labelId}
              className="flex flex-col"
            >
              {items.map((item, index) => {
                const isSelected = selectedKey === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={item.isDisabled}
                    className={`hover:bg-accent focus-visible:bg-accent aria-selected:bg-accent/50 flex items-center justify-between px-6 py-4 text-left text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-selected:font-medium ${index < items.length - 1 ? 'border-b border-border' : ''}`}
                    onClick={() => {
                      onSelectionChange(item.id);
                      setIsOpen(false);
                    }}
                  >
                    <span>{item.label}</span>
                    {isSelected && <LuCheck className="size-4" />}
                  </button>
                );
              })}
            </div>
          </SheetBody>
        </Sheet>
      </>
    );
  }

  return (
    <Select
      selectedKey={selectedKey}
      size={size}
      className={className}
      onSelectionChange={(key) => onSelectionChange(key as T)}
      aria-label={label}
    >
      {items.map((item) => (
        <SelectItem key={item.id} id={item.id} isDisabled={item.isDisabled}>
          {item.label}
        </SelectItem>
      ))}
    </Select>
  );
}
