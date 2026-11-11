'use client';

import { Button } from '@op/sense/Button';
import { FieldLegend, FieldSet } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { DragHandle, Sortable } from '@op/sense/Sortable';
import { useEffect, useRef, useState } from 'react';
import { LuGripVertical, LuPlus, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { DraftProblem } from './formDefinition';
import { ProblemMessages } from './formProblems';

export type SortableInputItem = {
  id: string;
  value: string;
};

export type SortableInputListProps = {
  label: string;
  addLabel: string;
  /** Placeholder and accessible name of the item at `index`, e.g. "Row 2". */
  getItemName: (index: number) => string;
  items: SortableInputItem[];
  problems: DraftProblem[];
  /** Longest trimmed value an item may hold. Omit for no limit. */
  maxLength?: number;
  onChange: (items: SortableInputItem[]) => void;
};

/**
 * One input per item, reordered by drag handle. Not shared with the proposal
 * template builder's options list, which enforces a two-option minimum this
 * builder does not have.
 */
export const SortableInputList = ({
  label,
  addLabel,
  getItemName,
  items,
  problems,
  maxLength,
  onChange,
}: SortableInputListProps) => {
  const t = useTranslations();
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  // Set when an item is added; the input does not exist until the next render.
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (pendingFocusId) {
      inputs.current.get(pendingFocusId)?.focus();
      setPendingFocusId(null);
    }
  }, [pendingFocusId]);

  const getName = (item: SortableInputItem) =>
    item.value.trim() || getItemName(items.indexOf(item));

  const addItem = () => {
    const id = crypto.randomUUID();
    setPendingFocusId(id);
    onChange([...items, { id, value: '' }]);
  };

  // Focus moves to a neighbour, so a keyboard user is not dropped to the page.
  const removeItem = (index: number) => {
    const neighbour = items[index - 1] ?? items[index + 1];
    const target = neighbour ? inputs.current.get(neighbour.id) : null;
    (target ?? addButton.current)?.focus();
    onChange(items.filter((_, at) => at !== index));
  };

  return (
    <FieldSet>
      <FieldLegend variant="label">{label}</FieldLegend>
      <Sortable
        items={items}
        onChange={onChange}
        dragTrigger="handle"
        getItemLabel={getName}
        renderDragPreview={([item]) =>
          item ? (
            <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 shadow-lg">
              <LuGripVertical className="size-4 text-muted-foreground" />
              <bdi>{getName(item)}</bdi>
            </div>
          ) : null
        }
        aria-label={label}
        className="gap-2"
      >
        {(item, controls) => {
          const index = items.indexOf(item);
          return (
            <div className="flex items-center gap-2">
              <DragHandle
                {...controls.dragHandleProps}
                aria-label={t('admin.reorderItemAction', {
                  item: getName(item),
                })}
              />
              <Input
                ref={(node) => {
                  if (node) {
                    inputs.current.set(item.id, node);
                  } else {
                    inputs.current.delete(item.id);
                  }
                }}
                value={item.value}
                aria-label={getItemName(index)}
                placeholder={getItemName(index)}
                aria-invalid={
                  maxLength != null && item.value.trim().length > maxLength
                }
                className="w-full"
                onChange={(event) =>
                  onChange(
                    items.map((entry) =>
                      entry.id === item.id
                        ? { ...entry, value: event.target.value }
                        : entry,
                    ),
                  )
                }
                onKeyDown={(event) => {
                  // Enter on the last filled input starts the next one.
                  const isLast = index === items.length - 1;
                  if (event.key === 'Enter' && isLast && item.value.trim()) {
                    event.preventDefault();
                    addItem();
                  }
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('admin.removeItemAction', {
                  item: getName(item),
                })}
                onClick={() => removeItem(index)}
              >
                <LuX />
              </Button>
            </div>
          );
        }}
      </Sortable>
      <Button
        ref={addButton}
        type="button"
        variant="ghost"
        className="w-fit"
        onClick={addItem}
      >
        <LuPlus data-icon="inline-start" />
        {addLabel}
      </Button>
      <ProblemMessages problems={problems} />
    </FieldSet>
  );
};
