import { Calendar } from '@op/sense/Calendar';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@op/sense/Resizable';
import type { Meta, StoryObj } from '@storybook/react-vite';

import figmaCalendar from '../assets/figma/calendar.png';
import figmaResizable from '../assets/figma/resizable.png';
import { ParityGridHeader, ParityRow, withDesignScale } from './Parity';

// Figma parity for the date & layout family. See Parity.tsx for the
// conventions.
//
// Direction has no row: its Figma page is doc-only (an RTL FAQ frame) and
// direction.tsx is a pure re-export of Base UI's DirectionProvider — there is
// nothing visual to compare.

const meta: Meta = {
  title: 'Sense Comparison/Figma Parity/Date & layout',
  parameters: { layout: 'fullscreen' },
  decorators: [withDesignScale],
};

export default meta;

type Story = StoryObj;

export const DateLayout: Story = {
  name: 'Date & layout',
  render: () => (
    <div className="flex flex-col gap-10 p-8">
      <ParityGridHeader />

      <ParityRow label="Calendar" img={figmaCalendar} imgWidth={424}>
        <Calendar
          mode="range"
          numberOfMonths={2}
          defaultMonth={new Date(2025, 5)}
          selected={{ from: new Date(2025, 5, 9), to: new Date(2025, 5, 17) }}
        />
      </ParityRow>

      <ParityRow label="Resizable" img={figmaResizable} imgWidth={480}>
        <div className="h-60 w-120">
          <ResizablePanelGroup className="rounded-lg border">
            <ResizablePanel defaultSize={50}>
              <div className="flex h-full items-center justify-center">One</div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50}>
              <div className="flex h-full items-center justify-center">Two</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </ParityRow>
    </div>
  ),
};
