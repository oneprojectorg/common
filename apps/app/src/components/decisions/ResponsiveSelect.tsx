'use client';

import { useMediaQuery } from '@op/hooks';
import { Button } from '@op/ui/Button';
import { Menu, MenuItem } from '@op/ui/Menu';
import { Modal, ModalBody } from '@op/ui/Modal';
import { Select, SelectItem } from '@op/ui/Select';
import { type ReactNode, useState } from 'react';
import { LuChevronDown } from 'react-icons/lu';

const BOTTOM_SHEET_OVERLAY_CLASS =
  'p-0 items-end justify-center animate-in fade-in-0 duration-300';
const BOTTOM_SHEET_CLASS =
  'm-0 h-auto w-screen max-w-none animate-in rounded-t-2xl rounded-b-none border-0 outline-0 duration-300 ease-out slide-in-from-bottom-full';

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
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [isOpen, setIsOpen] = useState(false);

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
        <Modal
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          isDismissable={true}
          isKeyboardDismissDisabled={false}
          overlayClassName={BOTTOM_SHEET_OVERLAY_CLASS}
          className={BOTTOM_SHEET_CLASS}
        >
          <ModalBody className="pb-safe p-0">
            <Menu className="flex min-w-full flex-col border-0 p-0 shadow-none">
              {items.map((item, index) => (
                <MenuItem
                  key={item.id}
                  id={item.id}
                  selected={selectedKey === item.id}
                  isDisabled={item.isDisabled}
                  className={`rounded-none px-6 py-4 ${index < items.length - 1 ? 'border-b border-neutral-gray1' : ''}`}
                  onAction={() => {
                    onSelectionChange(item.id);
                    setIsOpen(false);
                  }}
                >
                  {item.label}
                </MenuItem>
              ))}
            </Menu>
          </ModalBody>
        </Modal>
      </>
    );
  }

  return (
    <Select
      selectedKey={selectedKey}
      size={size}
      className={className}
      onSelectionChange={(key) => onSelectionChange(key as T)}
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <SelectItem key={item.id} id={item.id} isDisabled={item.isDisabled}>
          {item.label}
        </SelectItem>
      ))}
    </Select>
  );
}
