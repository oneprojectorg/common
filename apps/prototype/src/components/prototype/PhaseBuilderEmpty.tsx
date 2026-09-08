'use client';

import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { cn } from '@op/sense/lib/utils';
import { Fragment, type ReactNode } from 'react';
import { LuPlus } from 'react-icons/lu';

export interface BuilderMenuItem {
  key: string;
  label: string;
  /** The answer type's own glyph — what the row will collect, at a glance. */
  icon?: ReactNode;
  /**
   * Ruled off from the choices above it: this one isn't another answer type,
   * it's a different kind of thing to add.
   */
  separated?: boolean;
  onSelect: () => void;
}

export interface BuilderAction {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /** primary + secondary sit side by side; tertiary is a quiet line beneath. */
  tier: 'primary' | 'secondary' | 'tertiary';
  /**
   * When the action is really "add one of these", the choice comes first and
   * `onClick` is never used — the picked option carries it. The type is decided
   * before the question exists, not corrected after.
   */
  menu?: BuilderMenuItem[];
}

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * The builder's empty state: a dashed card with the two real ways to start, then
 * the quieter shortcut underneath. Which action leads is the caller's call — for
 * a Develop phase it depends on the kind of process.
 */
export function PhaseBuilderEmpty({
  heading,
  text,
  actions,
}: {
  heading: string;
  text: string;
  actions: BuilderAction[];
}) {
  const buttons = actions.filter((action) => action.tier !== 'tertiary');
  const quiet = actions.filter((action) => action.tier === 'tertiary');

  return (
    <div className="rounded-lg border border-dashed border-input px-6 py-10 text-center">
      <EmptyStateBody
        heading={heading}
        text={text}
        shortcut={
          quiet.length > 0
            ? quiet.map((action) => (
                /* A link at a button's own size: bringing a form in from
                   somewhere else is a shortcut past the empty state rather than
                   one of its buttons, but it is still a thing you can do. */
                <Button
                  key={action.key}
                  variant="link"
                  onClick={action.onClick}
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))
            : null
        }
      >
        {buttons.map((action) => {
          // One filled button per empty state — the way in. Anything else that
          // would fill it is a second route, and a second route is outlined.
          const variant = action.tier === 'primary' ? 'default' : 'outline';

          return action.menu ? (
            <BuilderAddMenu
              key={action.key}
              label={action.label}
              icon={action.icon}
              variant={variant}
              items={action.menu}
            />
          ) : (
            <Button key={action.key} variant={variant} onClick={action.onClick}>
              {action.icon}
              {action.label}
            </Button>
          );
        })}
      </EmptyStateBody>
    </div>
  );
}

/**
 * The inside of an empty state, wherever one appears: what is missing, one
 * sentence on what it is for, then the ways to fill it. The box around it is the
 * caller's — dashed where a slot is waiting to be filled, solid where the empty
 * thing is a card of its own.
 */
export function EmptyStateBody({
  heading,
  text,
  children,
  shortcut,
}: {
  heading: string;
  /** One sentence. Two is a paragraph, and nobody reads a paragraph here. */
  text: string;
  /** The buttons that fill the thing. Laid out here so every empty state matches. */
  children?: ReactNode;
  /**
   * A way in from somewhere else — copying a panel, reusing an old form. Its own
   * row under the buttons: a link set beside a filled one reads as a caption on
   * it rather than as a second thing you could do.
   */
  shortcut?: ReactNode;
}) {
  return (
    <>
      <p className="text-base font-strong">{heading}</p>
      <p className="mx-auto mt-1 max-w-sm text-muted-foreground">{text}</p>
      {children ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {children}
        </div>
      ) : null}
      {shortcut ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
          {shortcut}
        </div>
      ) : null}
    </>
  );
}

/**
 * The "add" button under a list that already has something in it. It leads —
 * adding the next question is the main thing to do on this screen — and it asks
 * for the type up front so the new row lands ready to name.
 */
/**
 * Adding to the form, as the last row of the form. Full width and outlined
 * rather than a filled button off to one side: the row is where the next
 * question will appear, so it belongs in the list's flow — and a primary fill
 * on a page whose primary action is `Save` was two of them competing.
 */
export function PhaseBuilderAddButton({
  label,
  items,
}: {
  label: string;
  items: BuilderMenuItem[];
}) {
  return (
    <BuilderAddMenu
      label={label}
      icon={<LuPlus className="size-4" aria-hidden />}
      variant="outline"
      items={items}
      className="w-full justify-center"
    />
  );
}

function BuilderAddMenu({
  label,
  icon,
  variant,
  items,
  className,
}: {
  label: string;
  icon: ReactNode;
  variant: 'default' | 'outline';
  items: BuilderMenuItem[];
  className?: string;
}) {
  return (
    <DropdownMenu>
      {/* No trailing chevron: the leading plus already says this adds, and a
          second glyph on the other end made one action look like two. */}
      <DropdownMenuTrigger
        render={<Button variant={variant} className={className} />}
      >
        {icon}
        {label}
      </DropdownMenuTrigger>
      {/* Centred under the trigger, which is the width of the list — anchored to
          one end it opened away from the button it belongs to. */}
      <DropdownMenuContent align="center">
        {items.map((item) => (
          <Fragment key={item.key}>
            {item.separated ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem onClick={item.onSelect}>
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * A dashed box offering the one thing that belongs in an empty slot. Used where
 * a list has nothing in it yet and the way to start is the only content worth
 * showing.
 */
export function PrototypeDashedEmptyState({
  heading,
  message,
  actionLabel,
  onAction,
  className,
}: {
  heading: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-input px-4 py-6 text-center',
        className,
      )}
    >
      <EmptyStateBody
        heading={heading}
        text={message}
        /* A link, unlike the other empty states' lead action: this one sits in
           the rail under `Add a phase`, and a second filled button in one column
           is a second thing claiming to be the next step. */
        shortcut={
          <Button variant="link" onClick={onAction}>
            <LuPlus className="size-4" aria-hidden />
            {actionLabel}
          </Button>
        }
      />
    </div>
  );
}
