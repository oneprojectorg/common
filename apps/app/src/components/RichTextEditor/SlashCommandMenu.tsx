'use client';

import { Item, ItemContent, ItemMedia, ItemTitle } from '@op/sense/Item';
import { Popover, PopoverContent } from '@op/sense/Popover';
import type { Editor } from '@tiptap/react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  EMPTY_SNAPSHOT,
  getSlashMenuController,
} from '@/components/decisions/SlashCommands';

const noopSubscribe = () => () => {};
const getEmptySnapshot = () => EMPTY_SNAPSHOT;

/**
 * Slash-command menu, rendered with the `@op/sense` Popover (base-ui) so it
 * shares the design system + gets collision-aware positioning. The `@tiptap/
 * suggestion` plugin owns the lifecycle (trigger, query, range, keyboard,
 * open/close, position via `clientRect`); this only subscribes to the per-editor
 * controller and delegates keyboard nav back through it.
 *
 * Focus-less (`initialFocus`/`finalFocus={false}`, `modal={false}`): the caret
 * stays in the editor so the user keeps typing the query. `noAnimation` so the
 * Popover unmounts instantly on close — base-ui's exit animation otherwise
 * repaints the popup at a stale position when the caret anchor disappears.
 *
 * Mount next to the editor wherever SlashCommands is enabled; no-ops otherwise.
 */
export function SlashCommandMenu({ editor }: { editor: Editor | null }) {
  const t = useTranslations();
  const controller = getSlashMenuController(editor);

  const snapshot = useSyncExternalStore(
    controller ? controller.subscribe : noopSubscribe,
    controller ? controller.getSnapshot : getEmptySnapshot,
    getEmptySnapshot,
  );

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Refs so the stable key handler / virtual anchor read current values.
  const itemsRef = useRef(snapshot.items);
  itemsRef.current = snapshot.items;
  const commandRef = useRef(snapshot.command);
  commandRef.current = snapshot.command;
  const selectedRef = useRef(0);
  selectedRef.current = selectedIndex;
  const clientRectRef = useRef(snapshot.clientRect);
  clientRectRef.current = snapshot.clientRect;
  // The currently-highlighted row, so arrow nav can scroll it into view.
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  // Virtual anchor at the caret. Stable identity; base-ui re-reads the rect as
  // the caret moves. Cache the last good rect so a transient null on close can't
  // jump the popup to the corner.
  const lastRectRef = useRef<DOMRect | null>(null);
  const anchor = useMemo(
    () => ({
      getBoundingClientRect: () => {
        const rect = clientRectRef.current?.() ?? null;
        if (rect) {
          lastRectRef.current = rect;
        }

        return lastRectRef.current ?? new DOMRect();
      },
    }),
    [],
  );

  // Reset the highlight when the filtered item set changes.
  useEffect(() => {
    setSelectedIndex(0);
  }, [snapshot.items]);

  // Keep the highlighted row visible as arrow keys move past the menu's edge.
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // The suggestion plugin delegates keydown here while the menu is open.
  useEffect(() => {
    if (!controller) {
      return;
    }

    controller.setKeyHandler((event) => {
      const items = itemsRef.current;
      if (!items.length) {
        return false;
      }

      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i + items.length - 1) % items.length);
        return true;
      }

      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }

      if (event.key === 'Enter') {
        const item = items[selectedRef.current];
        if (item) {
          commandRef.current?.(item);
        }

        return true;
      }

      return false;
    });

    return () => controller.setKeyHandler(null);
  }, [controller]);

  if (!controller) {
    return null;
  }

  return (
    <Popover open={snapshot.open} onOpenChange={() => {}} modal={false}>
      <PopoverContent
        anchor={anchor}
        noAnimation
        initialFocus={false}
        finalFocus={false}
        side="bottom"
        align="start"
        sideOffset={8}
        // Keep editor focus + selection when an item is clicked (mid-query).
        onMouseDown={(event) => event.preventDefault()}
        // Clip on the rounded container; scroll on the inner wrapper — so the
        // scrollbar can't paint past the rounded corner.
        className="w-auto overflow-hidden p-0"
      >
        <div className="flex max-h-90 flex-col gap-0 overflow-auto p-2">
          {snapshot.items.length ? (
            snapshot.items.map((item, index) => (
              <Item
                key={item.title}
                size="xs"
                render={
                  <button
                    type="button"
                    ref={index === selectedIndex ? selectedItemRef : null}
                  />
                }
                onClick={() => commandRef.current?.(item)}
                aria-selected={index === selectedIndex}
                // scroll-my gives scrollIntoView({block:'nearest'}) breathing room
                // so the highlighted row doesn't sit flush against the menu edge.
                className={`cursor-pointer scroll-my-2 transition-none ${
                  index === selectedIndex
                    ? 'bg-neutral-gray1 text-neutral-black'
                    : 'text-neutral-charcoal hover:bg-neutral-gray1'
                }`}
              >
                <ItemMedia>
                  <item.icon className="size-4" />
                </ItemMedia>
                <ItemContent className="gap-0">
                  <ItemTitle className="text-base font-medium">
                    {item.title}
                  </ItemTitle>
                </ItemContent>
              </Item>
            ))
          ) : (
            <div className="px-2 py-1 text-neutral-gray4">
              {t('No results')}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
