'use client';

import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@op/sense/Item';
import type { Editor } from '@tiptap/react';
import type { CSSProperties } from 'react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { useTranslations } from '@/lib/i18n';

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

const MENU_WIDTH = 320; // w-80
const MENU_MAX_HEIGHT = 360; // max-h-90

/**
 * Slash-command menu surface. The `@tiptap/suggestion` plugin owns the whole
 * lifecycle — trigger, query, range, keyboard, open/close, and position (via
 * `clientRect`) — so this is a plain positioned surface, NOT a Popover. It
 * mounts only while the suggestion says open and unmounts instantly on close.
 *
 * (A base-ui Popover layered its own portal + enter/exit animation + dismiss +
 * focus on top; the exit animation flashed the menu to the corner when the caret
 * anchor disappeared on close. A plain surface has nothing to animate.)
 *
 * Rendered through a portal so it has app providers + i18n + design tokens and
 * isn't clipped by editor overflow. Focus-less: the caret stays in the editor so
 * the user keeps typing the query.
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

  // Refs so the stable key handler reads current values.
  const itemsRef = useRef(snapshot.items);
  itemsRef.current = snapshot.items;
  const commandRef = useRef(snapshot.command);
  commandRef.current = snapshot.command;
  const selectedRef = useRef(0);
  selectedRef.current = selectedIndex;
  // The currently-highlighted row, so arrow nav can scroll it into view.
  const selectedItemRef = useRef<HTMLButtonElement>(null);

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

  if (!controller || !snapshot.open) {
    return null;
  }

  const rect = snapshot.clientRect?.();
  if (!rect) {
    return null;
  }

  // Below the caret; flip above when there isn't room, clamp horizontally.
  const spaceBelow = window.innerHeight - rect.bottom;
  const placeAbove = spaceBelow < MENU_MAX_HEIGHT && rect.top > spaceBelow;
  const left = Math.max(
    8,
    Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8),
  );
  const style: CSSProperties = placeAbove
    ? { bottom: window.innerHeight - rect.top + 8, left }
    : { top: rect.bottom + 8, left };

  return createPortal(
    <div
      // Focus-less: keep editor focus + selection (user is mid-query). Clicks on
      // items still fire onClick — preventDefault only blocks the focus shift.
      onMouseDown={(event) => event.preventDefault()}
      style={style}
      className="fixed z-50 flex max-h-90 w-80 flex-col gap-0 overflow-auto rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-md"
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
        <div className="px-2 py-1 text-neutral-gray4">{t('No results')}</div>
      )}
    </div>,
    document.body,
  );
}
