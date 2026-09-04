'use client';

import { SplitPane } from '@op/sense/SplitPane';
import type { ReactNode } from 'react';

interface ProposalEditorAsidePaneProps {
  /** Names the pane, and is the visible tab text on mobile. */
  label: string;
  children: ReactNode;
}

/**
 * The pane beside the document in the proposal editor. Owns the chrome the
 * editor's aside always has — pane id, background, no padding — so callers pass
 * a panel and a label rather than repeating the `SplitPane.Pane` wiring.
 */
export function ProposalEditorAsidePane({
  label,
  children,
}: ProposalEditorAsidePaneProps) {
  return (
    <SplitPane.Pane
      id="feedback"
      label={label}
      className="bg-background"
      unpadded
    >
      {children}
    </SplitPane.Pane>
  );
}
