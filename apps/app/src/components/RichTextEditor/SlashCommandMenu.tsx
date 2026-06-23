'use client';

import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@op/sense/Item';
import { Popover, PopoverContent } from '@op/sense/Popover';
import type { Editor } from '@tiptap/react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  getSlashMenuController,
  type SlashMenuSnapshot,
} from '@/components/decisions/SlashCommands';

const EMPTY_SNAPSHOT: SlashMenuSnapshot = {
  open: false,
  items: [],
  command: null,
  clientRect: null,
};

const noopSubscribe = () => () => {};
const getEmptySnapshot = () => EMPTY_SNAPSHOT;

/**
 * Renders the slash-command menu with the `@op/sense` Popover (base-ui), so it
 * shares the design system and gets collision-aware positioning. The `@tiptap/
 * suggestion` plugin owns the trigger/query/range and stays the source of truth
 * for open/close; this component only subscribes to the per-editor controller
 * (in `editor.storage`) and delegates keyboard nav back through it.
 *
 * The menu is intentionally focus-less (`initialFocus`/`finalFocus={false}`,
 * `modal={false}`): the caret stays in the editor so the user can keep typing
 * the query. Anchored to the caret rect via a virtual anchor element.
 *
 * Mount it next to the editor wherever SlashCommands is enabled; no-ops when the
 * editor doesn't have the extension.
 */
export function SlashCommandMenu({ editor }: { editor: Editor | null }) {
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
  // the caret moves (each keystroke updates the controller → re-render).
  const anchor = useMemo(
    () => ({
      getBoundingClientRect: () => clientRectRef.current?.() ?? new DOMRect(),
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
        side="bottom"
        align="start"
        sideOffset={8}
        initialFocus={false}
        finalFocus={false}
        // Keep editor focus + selection when an item is clicked (mid-query).
        onMouseDown={(event) => event.preventDefault()}
        className="max-h-90 w-80 max-w-screen gap-0 overflow-auto p-2"
      >
        {snapshot.items.length ? (
          snapshot.items.map((item, index) => (
            <Item
              key={item.title}
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
                <ItemDescription className="text-base text-neutral-gray4">
                  {item.description}
                </ItemDescription>
              </ItemContent>
            </Item>
          ))
        ) : (
          <div className="px-2 py-1 text-neutral-gray4">No results</div>
        )}
      </PopoverContent>
    </Popover>
  );
}
