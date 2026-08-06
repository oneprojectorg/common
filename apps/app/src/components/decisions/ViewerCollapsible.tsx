'use client';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@op/sense/Collapsible';
import type { ReactNode } from 'react';
import { LuChevronRight } from 'react-icons/lu';

/**
 * Viewer rendering for TipTap's `details` node, on sense `Collapsible`.
 *
 * A client island inside the otherwise-static `RichTextRenderer`, like
 * `LinkPreview` — the disclosure needs state, and native `<details>` can't
 * animate its height.
 *
 * The editor still renders the vanilla node view (`div.details`, styled by the
 * `.details` block in `@op/styles`), so the two surfaces are deliberately
 * different here. That divergence is the known cost of this approach; closing it
 * means one shared React node view for both, which is filed separately.
 * Deliberately no `.details` class — that CSS targets the editor's markup and
 * would fight these styles.
 */
export function ViewerCollapsible({
  defaultOpen,
  children,
}: {
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="my-2">
      {children}
    </Collapsible>
  );
}

/** The `detailsSummary` node — the disclosure's trigger row. */
export function ViewerCollapsibleSummary({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <CollapsibleTrigger
      render={<button type="button" />}
      className="group/summary flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-start font-serif text-lg text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <LuChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-data-panel-open/summary:rotate-90 rtl:-scale-x-100" />
      {/* The node's children are already-rendered prose, so they can't be
          wrapped in another block element — a <p> inside a <button> is invalid. */}
      <span className="min-w-0 flex-1 [&>p]:m-0">{children}</span>
    </CollapsibleTrigger>
  );
}

/** The `detailsContent` node — the panel. */
export function ViewerCollapsibleContent({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
      <div className="ps-9 pe-2">{children}</div>
    </CollapsibleContent>
  );
}
