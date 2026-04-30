import {
  LuCheck,
  LuChevronLeft,
  LuChevronRight,
  LuLogOut,
} from 'react-icons/lu';

import { Button } from '../src/components/Button';
import { FooterBar } from '../src/components/FooterBar';
import { StepperProgressIndicator } from '../src/components/Stepper';

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
    <div className="flex-1 bg-muted" />
    <FooterBar padding="spacious">
      <FooterBar.Start>
        <Button variant="outline">
          <LuChevronLeft className="size-4" />
          Previous
        </Button>
      </FooterBar.Start>

      <FooterBar.Center>
        <span className="text-base text-foreground">Proposal 4 of 6</span>
        <span className="mx-2 text-muted-foreground">•</span>
        <span className="text-base text-foreground">2 completed</span>
      </FooterBar.Center>

      <FooterBar.End>
        <Button variant="outline">
          Next
          <LuChevronRight className="size-4" />
        </Button>
      </FooterBar.End>

      <FooterBar.Divider />

      <FooterBar.End>
        <Button variant="default">
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
    <div className="flex-1 bg-muted" />
    <FooterBar>
      <FooterBar.Start>
        <Button variant="ghost">
          <LuLogOut className="size-4 rotate-180" />
          Exit
        </Button>
        <Button variant="outline">Back</Button>
      </FooterBar.Start>

      <FooterBar.Center className="gap-4">
        <div className="w-40">
          <StepperProgressIndicator currentStep={1} numItems={4} />
        </div>
        <span className="shrink-0 text-base text-foreground">50% complete</span>
      </FooterBar.Center>

      <FooterBar.End>
        <Button variant="outline">Next</Button>
      </FooterBar.End>
    </FooterBar>
  </div>
);

/**
 * Minimal footer with just back and a primary action — no center content.
 */
export const Minimal = () => (
  <div className="flex h-64 flex-col">
    <div className="flex-1 bg-muted" />
    <FooterBar>
      <FooterBar.Start>
        <Button variant="outline">
          <LuChevronLeft className="size-4" />
          Back
        </Button>
      </FooterBar.Start>

      <FooterBar.Center />

      <FooterBar.End>
        <Button variant="default">Save &amp; Continue</Button>
      </FooterBar.End>
    </FooterBar>
  </div>
);
