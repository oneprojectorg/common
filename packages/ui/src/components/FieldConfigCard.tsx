'use client';

import type { ReactNode } from 'react';
import { use, useLayoutEffect, useRef } from 'react';
import type { Key } from 'react-aria-components';
import {
  Button as AriaButton,
  DisclosurePanel as DisclosurePanelPrimitive,
  Disclosure as DisclosurePrimitive,
  DisclosureStateContext,
  Button as TriggerButton,
} from 'react-aria-components';
import { LuChevronRight, LuGripVertical, LuLock, LuX } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { AutoSizeInput } from './AutoSizeInput';
import { Button } from './Button';
import { DragHandle } from './Sortable';
import type { SortableItemControls } from './Sortable';
import { TextField } from './TextField';
import { Tooltip, TooltipTrigger } from './Tooltip';

export interface FieldConfigCardProps {
  /** Icon component to display next to the label */
  icon: React.ComponentType<{ className?: string }>;
  /** Tooltip text for the icon */
  iconTooltip?: string;
  /** The editable label text */
  label: string;
  /** Callback when the label changes */
  onLabelChange?: (label: string) => void;
  /** Accessible label for the label input */
  labelInputAriaLabel?: string;
  /** Description text */
  description?: string;
  /** Callback when description changes */
  onDescriptionChange?: (description: string) => void;
  /** Label for the description field */
  descriptionLabel?: string;
  /** Placeholder for the description field */
  descriptionPlaceholder?: string;
  /** Callback when remove button is clicked */
  onRemove?: () => void;
  /** Accessible label for the remove button */
  removeAriaLabel?: string;
  /** Accessible label for the drag handle */
  dragHandleAriaLabel?: string;
  /** Sortable controls for drag-and-drop */
  controls?: SortableItemControls;
  /** Additional content to render below the description (config options, toggles, etc.) */
  children?: React.ReactNode;
  /** Additional class name for the card container */
  className?: string;
  /** Whether the card is locked (non-editable, no drag handle or remove button) */
  locked?: boolean;
  /** Extra content rendered in the header row after the label (e.g. points badge) */
  headerExtra?: ReactNode;

  // --- Collapsible (accordion) props ---

  /**
   * Enable accordion/collapsible behavior. When true, the body (description +
   * children) is hidden behind a disclosure toggle and animates open/closed.
   * The card must be placed inside an `<Accordion>` (DisclosureGroup) for
   * group-level expand control, or used standalone with controlled/uncontrolled
   * expansion via `isExpanded` / `defaultExpanded`.
   */
  collapsible?: boolean;
  /** Unique id for this disclosure (required when inside an Accordion group) */
  disclosureId?: Key;
  /** Controlled expansion state */
  isExpanded?: boolean;
  /** Default expansion state (uncontrolled) */
  defaultExpanded?: boolean;
  /** Callback when expansion changes */
  onExpandedChange?: (isExpanded: boolean) => void;
}

/**
 * A configurable card component for form builders.
 * Features a header with drag handle, icon, editable label, and remove button,
 * plus an optional description field and slot for additional configuration.
 *
 * When `collapsible` is true the body content is wrapped in a React Aria
 * Disclosure panel with smooth height animation, and a chevron toggle is
 * added to the header.
 */
export function FieldConfigCard({
  icon: Icon,
  iconTooltip,
  label,
  onLabelChange,
  labelInputAriaLabel = 'Field label',
  description,
  onDescriptionChange,
  descriptionLabel = 'Description',
  descriptionPlaceholder,
  onRemove,
  removeAriaLabel = 'Remove field',
  dragHandleAriaLabel = 'Drag to reorder',
  controls,
  children,
  className,
  locked = false,
  headerExtra,
  collapsible = false,
  disclosureId,
  isExpanded,
  defaultExpanded,
  onExpandedChange,
}: FieldConfigCardProps) {
  const isDragging = controls?.isDragging ?? false;
  const labelInputRef = useRef<HTMLInputElement>(null!);

  // Locked variant: static card with lock icon, no drag handle or remove button
  if (locked) {
    return (
      <div
        className={cn(
          'space-y-2 rounded-lg border bg-neutral-offWhite px-3 py-4',
          className,
        )}
      >
        <div className={cn('flex items-center gap-2', className)}>
          <div className="flex size-6 items-center justify-center text-neutral-gray4">
            <LuLock className="size-4" />
          </div>
          <TooltipTrigger>
            <AriaButton className="flex items-center text-neutral-gray4">
              <Icon className="size-4" />
            </AriaButton>
            {iconTooltip && <Tooltip>{iconTooltip}</Tooltip>}
          </TooltipTrigger>
          <span className="flex-1 text-neutral-charcoal">{label}</span>
          {headerExtra}
        </div>
        {children}
      </div>
    );
  }

  const header = (
    <div className="flex w-full items-center gap-2">
      <div className="flex min-w-0 grow items-center gap-2">
        {controls && (
          <DragHandle
            {...controls.dragHandleProps}
            aria-label={dragHandleAriaLabel}
          />
        )}
        {collapsible && <CollapsibleIndicator />}
        <div className="flex min-w-0 items-center gap-2 rounded border border-neutral-gray1 bg-neutral-gray1 px-2 py-1 focus-within:border-neutral-gray2 focus-within:bg-white">
          <TooltipTrigger>
            <AriaButton
              className="flex shrink-0 items-center text-neutral-gray4"
              onPress={() => labelInputRef.current?.focus()}
            >
              <Icon className="size-4" />
            </AriaButton>
            {iconTooltip && <Tooltip>{iconTooltip}</Tooltip>}
          </TooltipTrigger>
          <div className="min-w-0 overflow-hidden">
            <AutoSizeInput
              inputRef={labelInputRef}
              value={label}
              onChange={(value) => onLabelChange?.(value)}
              className="text-neutral-charcoal"
              aria-label={labelInputAriaLabel}
            />
          </div>
        </div>
        {headerExtra}
      </div>
      {onRemove && (
        <Button
          color="ghost"
          size="small"
          aria-label={removeAriaLabel}
          onPress={onRemove}
          className="p-2 text-neutral-gray4 hover:text-neutral-charcoal"
        >
          <LuX className="size-4" />
        </Button>
      )}
    </div>
  );

  const body = (
    <div className="px-8">
      {onDescriptionChange && (
        <div className="mt-4">
          <TextField
            label={descriptionLabel}
            value={description ?? ''}
            onChange={onDescriptionChange}
            useTextArea
            textareaProps={{
              placeholder: descriptionPlaceholder,
              className: 'min-h-24 resize-none',
            }}
          />
        </div>
      )}
      {children}
    </div>
  );

  // Non-collapsible variant: render header + body directly
  if (!collapsible) {
    return (
      <div
        className={cn(
          'rounded-lg border bg-white px-3 py-4',
          isDragging && 'opacity-50',
          className,
        )}
      >
        {header}
        {body}
      </div>
    );
  }

  // Collapsible variant: wrap in Disclosure primitive
  return (
    <DisclosurePrimitive
      id={disclosureId}
      isExpanded={isExpanded}
      defaultExpanded={defaultExpanded}
      onExpandedChange={onExpandedChange}
      className={cn(
        'group/field-config rounded-lg border bg-white px-3 py-4',
        isDragging && 'opacity-50',
        className,
      )}
    >
      {header}
      <AnimatedDisclosurePanel>{body}</AnimatedDisclosurePanel>
    </DisclosurePrimitive>
  );
}

// ---------------------------------------------------------------------------
// Collapsible sub-components
// ---------------------------------------------------------------------------

/**
 * Chevron indicator that toggles the disclosure. Rotates 90° when expanded.
 * Rendered as a React Aria `Button` with `slot="trigger"` so it integrates
 * with the parent `Disclosure` primitive.
 */
function CollapsibleIndicator() {
  return (
    <TriggerButton
      slot="trigger"
      className="flex shrink-0 cursor-pointer items-center rounded p-0.5 text-neutral-gray4 outline-none hover:text-neutral-charcoal focus-visible:ring-2 focus-visible:ring-ring"
    >
      <LuChevronRight className="size-4 transition-transform duration-200 group-data-[expanded]/field-config:rotate-90" />
    </TriggerButton>
  );
}

/**
 * Animated disclosure panel that mirrors the height-transition logic from
 * the Accordion component. Uses the `--disclosure-panel-height` CSS custom
 * property for smooth expand/collapse animations.
 */
function AnimatedDisclosurePanel({ children }: { children: ReactNode }) {
  const state = use(DisclosureStateContext);
  const panelRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (state?.isExpanded) {
        panel.style.setProperty('--disclosure-panel-height', 'auto');
      } else {
        panel.style.setProperty('--disclosure-panel-height', '0px');
      }
      return;
    }

    if (state?.isExpanded) {
      if (
        panel.style.getPropertyValue('--disclosure-panel-height') === 'auto'
      ) {
        return;
      }

      panel.removeAttribute('hidden');
      const height = panel.scrollHeight;
      panel.style.setProperty('--disclosure-panel-height', `${height}px`);

      const onTransitionEnd = () => {
        panel.style.setProperty('--disclosure-panel-height', 'auto');
        panel.removeEventListener('transitionend', onTransitionEnd);
      };
      panel.addEventListener('transitionend', onTransitionEnd);
    } else {
      const height = panel.scrollHeight;
      panel.style.setProperty('--disclosure-panel-height', `${height}px`);
      void panel.offsetHeight;
      panel.style.setProperty('--disclosure-panel-height', '0px');
    }
  }, [state?.isExpanded]);

  return (
    <DisclosurePanelPrimitive
      ref={panelRef}
      className="h-[var(--disclosure-panel-height)] overflow-hidden transition-[height] duration-200 ease-out motion-reduce:transition-none [&[hidden]]:![content-visibility:visible]"
    >
      {children}
    </DisclosurePanelPrimitive>
  );
}

// ---------------------------------------------------------------------------
// Drag preview
// ---------------------------------------------------------------------------

export interface FieldConfigCardDragPreviewProps {
  /** Icon component to display next to the label */
  icon: React.ComponentType<{ className?: string }>;
  /** The label text */
  label: string;
  /** Optional custom content to override the default preview */
  children?: ReactNode;
  /** Additional class name for the preview container */
  className?: string;
}

/**
 * Drag preview shown while dragging a FieldConfigCard.
 * Shows a compact version with drag grip, icon, and label.
 */
export function FieldConfigCardDragPreview({
  icon: Icon,
  label,
  children,
  className,
}: FieldConfigCardDragPreviewProps) {
  if (children) {
    return (
      <div
        className={cn('rounded-lg border bg-white p-4 shadow-lg', className)}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border bg-white p-4 shadow-lg', className)}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center text-neutral-gray4">
          <LuGripVertical className="size-4" />
        </div>
        <div className="flex min-w-0 items-center gap-2 rounded border border-neutral-gray1 bg-neutral-gray1 px-2 py-1">
          <Icon className="size-4 text-neutral-gray4" />
          <span className="text-neutral-charcoal">{label}</span>
        </div>
      </div>
    </div>
  );
}
