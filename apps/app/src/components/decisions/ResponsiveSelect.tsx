'use client';

import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Button } from '@op/ui/Button';
import { MenuItem, MenuList } from '@op/ui/Menu';
import { Modal, ModalBody } from '@op/ui/Modal';
import { Select, SelectItem } from '@op/ui/Select';
import { type ReactNode, useState } from 'react';
import { LuChevronDown } from 'react-icons/lu';

const BOTTOM_SHEET_OVERLAY_CLASS =
  'p-0 items-end justify-center animate-in fade-in-0 duration-300';
const BOTTOM_SHEET_CLASS =
  'm-0 h-auto max-h-[calc(100svh-5rem)] w-screen max-w-none animate-in rounded-t-2xl rounded-b-none border-0 outline-0 duration-300 ease-out slide-in-from-bottom-full';

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
          className={`${className} max-w-48 shrink-0 justify-between shadow-none`}
          onPress={() => setIsOpen(true)}
        >
          <span className="min-w-0 overflow-hidden whitespace-nowrap">
            {displayLabel}
          </span>
          <LuChevronDown className="size-4 shrink-0" />
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
            <MenuList
              selectionMode="single"
              selectedKeys={[selectedKey]}
              className="flex min-w-full flex-col border-0 p-0 shadow-none"
            >
              {items.map((item, index) => (
                <MenuItem
                  key={item.id}
                  id={item.id}
                  textValue={item.textValue}
                  isDisabled={item.isDisabled}
                  className={`bg-transparent px-6 py-4 outline-0 focus-visible:bg-primary-tealWhite focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-primary-teal ${index === 0 ? 'rounded-t-2xl rounded-b-none' : 'rounded-none'} ${index < items.length - 1 ? 'border-b border-neutral-gray1' : ''}`}
                  onAction={() => {
                    onSelectionChange(item.id);
                    setIsOpen(false);
                  }}
                >
                  {item.label}
                </MenuItem>
              ))}
            </MenuList>
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
        <SelectItem
          key={item.id}
          id={item.id}
          textValue={item.textValue}
          isDisabled={item.isDisabled}
        >
          {item.label}
        </SelectItem>
      ))}
    </Select>
  );
}
