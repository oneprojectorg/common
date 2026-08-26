'use client';

import { Button } from '@op/sense/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@op/sense/Tooltip';
import type { IconType } from 'react-icons';

interface FeedbackDotIconButtonProps {
  icon: IconType;
  /** Accessible name and tooltip text — the button has no visible label. */
  label: string;
  onToggle: () => void;
  /** Whether the pane this button opens is currently showing. */
  isExpanded: boolean;
}

/**
 * Header disclosure for a reviewer-feedback pane, marked with a dot.
 *
 * The dot is static, not an unread badge: we hold no read state for reviewer
 * notes. It stays a plain `span` until `@op/sense` grows a badge slot, which is
 * a design-system change with its own Storybook and a11y obligations.
 */
export function FeedbackDotIconButton({
  icon: Icon,
  label,
  onToggle,
  isExpanded,
}: FeedbackDotIconButtonProps) {
  return (
    // The header's action row supplies the tooltip group and its delay
    // (`ProposalEditorHeader`), so this only needs a Tooltip.
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onToggle}
            aria-label={label}
            aria-expanded={isExpanded}
            className="relative"
          >
            <Icon className="size-4" />
            <span
              aria-hidden
              className="absolute -end-0.5 -top-0.5 size-1.5 rounded-full bg-warning"
            />
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
