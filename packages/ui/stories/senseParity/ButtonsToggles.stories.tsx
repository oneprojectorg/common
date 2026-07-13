import { Button } from '@op/sense/Button';
import { ButtonGroup } from '@op/sense/ButtonGroup';
import { Toggle } from '@op/sense/Toggle';
import { ToggleGroup, ToggleGroupItem } from '@op/sense/ToggleGroup';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuBold, LuCircleArrowLeft } from 'react-icons/lu';

import figmaButtonDefault from '../assets/figma/button-default.png';
import figmaButtonDestructive from '../assets/figma/button-destructive.png';
import figmaButtonGhost from '../assets/figma/button-ghost.png';
import figmaButtonGroupOutline from '../assets/figma/button-group-outline.png';
import figmaButtonGroupPrimary from '../assets/figma/button-group-primary.png';
import figmaButtonLink from '../assets/figma/button-link.png';
import figmaButtonOutline from '../assets/figma/button-outline.png';
import figmaButtonSecondary from '../assets/figma/button-secondary.png';
import figmaToggleDefault from '../assets/figma/toggle-default.png';
import figmaToggleGroupJoined from '../assets/figma/toggle-group-joined.png';
import figmaToggleGroupSpaced from '../assets/figma/toggle-group-spaced.png';
import figmaToggleOutline from '../assets/figma/toggle-outline.png';
import { ParityGridHeader, ParityRow, withDesignScale } from './Parity';

// Figma parity for the buttons & toggles family. See Parity.tsx for the
// conventions.

const meta: Meta = {
  title: 'Sense Comparison/Figma Parity/Buttons & toggles',
  parameters: { layout: 'fullscreen' },
  decorators: [withDesignScale],
};

export default meta;

type Story = StoryObj;

export const ButtonsToggles: Story = {
  name: 'Buttons & toggles',
  render: () => (
    <div className="flex flex-col gap-10 p-8">
      <ParityGridHeader />

      <ParityRow label="Button" img={figmaButtonDefault} imgWidth={80}>
        <Button>Button</Button>
      </ParityRow>

      <ParityRow label="Secondary" img={figmaButtonSecondary} imgWidth={80}>
        <Button variant="secondary">Button</Button>
      </ParityRow>

      <ParityRow label="Outline" img={figmaButtonOutline} imgWidth={80}>
        <Button variant="outline">Button</Button>
      </ParityRow>

      <ParityRow label="Ghost" img={figmaButtonGhost} imgWidth={80}>
        <Button variant="ghost">Button</Button>
      </ParityRow>

      <ParityRow label="Destructive" img={figmaButtonDestructive} imgWidth={80}>
        <Button variant="destructive">Button</Button>
      </ParityRow>

      <ParityRow label="Link" img={figmaButtonLink} imgWidth={80}>
        <Button variant="link">Button</Button>
      </ParityRow>

      <ParityRow
        label="Button group"
        img={figmaButtonGroupOutline}
        imgWidth={444}
      >
        <ButtonGroup>
          <Button variant="outline">Button</Button>
          <Button variant="outline">Button</Button>
          <Button variant="outline">Button</Button>
          <Button variant="outline">Button</Button>
          <Button variant="outline">Button</Button>
          <Button variant="outline" size="icon" aria-label="Back">
            <LuCircleArrowLeft />
          </Button>
        </ButtonGroup>
      </ParityRow>

      <ParityRow
        label="Group, primary"
        img={figmaButtonGroupPrimary}
        imgWidth={449}
      >
        <ButtonGroup>
          <Button>Button</Button>
          <Button>Button</Button>
          <Button>Button</Button>
          <Button>Button</Button>
          <Button>Button</Button>
          <Button size="icon" aria-label="Back">
            <LuCircleArrowLeft />
          </Button>
        </ButtonGroup>
      </ParityRow>

      <ParityRow label="Toggle" img={figmaToggleDefault} imgWidth={83}>
        <Toggle>
          <LuBold />
          Text
        </Toggle>
      </ParityRow>

      <ParityRow label="Toggle outline" img={figmaToggleOutline} imgWidth={83}>
        <Toggle variant="outline">
          <LuBold />
          Text
        </Toggle>
      </ParityRow>

      <ParityRow
        label="Toggle group"
        img={figmaToggleGroupJoined}
        imgWidth={144}
      >
        <ToggleGroup spacing={0} variant="outline" defaultValue={['a']}>
          <ToggleGroupItem value="a" aria-label="Bold">
            <LuBold />
          </ToggleGroupItem>
          <ToggleGroupItem value="b" aria-label="Bold">
            <LuBold />
          </ToggleGroupItem>
          <ToggleGroupItem value="c" aria-label="Bold">
            <LuBold />
          </ToggleGroupItem>
        </ToggleGroup>
      </ParityRow>

      <ParityRow
        label="Group, spaced"
        img={figmaToggleGroupSpaced}
        imgWidth={160}
      >
        <ToggleGroup variant="outline" defaultValue={['a']}>
          <ToggleGroupItem value="a" aria-label="Bold">
            <LuBold />
          </ToggleGroupItem>
          <ToggleGroupItem value="b" aria-label="Bold">
            <LuBold />
          </ToggleGroupItem>
          <ToggleGroupItem value="c" aria-label="Bold">
            <LuBold />
          </ToggleGroupItem>
        </ToggleGroup>
      </ParityRow>
    </div>
  ),
};
