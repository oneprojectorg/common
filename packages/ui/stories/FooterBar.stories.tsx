import {
  LuCheck,
  LuChevronLeft,
  LuChevronRight,
  LuLogOut,
} from 'react-icons/lu';

import { Button } from '../src/components/Button';
import { FooterBar } from '../src/components/FooterBar';

export default {
  title: 'FooterBar',
  component: FooterBar,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

/**
 * Review-style footer with previous/next navigation, a center status label,
 * and a primary action separated by a divider.
 */
export const ReviewNavigation = () => (
  <div className="flex h-64 flex-col">
    <div className="flex-1 bg-neutral-offWhite" />
    <FooterBar padding="spacious">
      <FooterBar.Start>
        <Button color="neutral" size="medium">
          <LuChevronLeft className="size-4" />
          Previous
        </Button>
      </FooterBar.Start>

      <FooterBar.Center>
        <span className="text-base text-neutral-black">Proposal 4 of 6</span>
        <span className="mx-2 text-midGray">•</span>
        <span className="text-base text-neutral-black">2 completed</span>
      </FooterBar.Center>

      <FooterBar.End>
        <Button color="secondary" size="medium">
          Next
          <LuChevronRight className="size-4" />
        </Button>
      </FooterBar.End>

      <FooterBar.Divider />

      <FooterBar.End>
        <Button color="primary" size="medium">
          <LuCheck className="size-4" />
          Review Complete
        </Button>
      </FooterBar.End>
    </FooterBar>
  </div>
);

/**
 * Process-builder-style footer with exit, back/next navigation,
 * and a progress bar in the center.
 */
export const ProcessNavigation = () => (
  <div className="flex h-64 flex-col">
    <div className="flex-1 bg-neutral-offWhite" />
    <FooterBar>
      <FooterBar.Start>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-1 px-2 text-base text-charcoal"
        >
          <LuLogOut className="size-4 rotate-180" />
          Exit
        </button>
        <Button color="secondary" size="medium">
          Back
        </Button>
      </FooterBar.Start>

      <FooterBar.Center className="gap-4">
        <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-neutral-gray2">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient"
            style={{ width: '48%' }}
          />
        </div>
        <span className="shrink-0 text-base text-charcoal">48% complete</span>
      </FooterBar.Center>

      <FooterBar.End>
        <Button color="secondary" size="medium">
          Next
        </Button>
      </FooterBar.End>
    </FooterBar>
  </div>
);

/**
 * Minimal footer with just back and a primary action — no center content.
 */
export const Minimal = () => (
  <div className="flex h-64 flex-col">
    <div className="flex-1 bg-neutral-offWhite" />
    <FooterBar>
      <FooterBar.Start>
        <Button color="neutral" size="medium">
          <LuChevronLeft className="size-4" />
          Back
        </Button>
      </FooterBar.Start>

      <FooterBar.Center />

      <FooterBar.End>
        <Button color="primary" size="medium">
          Save &amp; Continue
        </Button>
      </FooterBar.End>
    </FooterBar>
  </div>
);
