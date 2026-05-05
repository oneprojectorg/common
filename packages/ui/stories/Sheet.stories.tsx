import { useState } from 'react';

import { Button } from '../src/components/Button';
import {
  Sheet,
  SheetBody,
  SheetHeader,
  SheetTrigger,
} from '../src/components/Sheet';

export default {
  title: 'Sheet',
  component: Sheet,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export const BottomSheet = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SheetTrigger>
      <Button onPress={() => setIsOpen(true)}>Open Bottom Sheet</Button>
      <Sheet side="bottom" isOpen={isOpen} onOpenChange={setIsOpen}>
        <SheetHeader onClose={() => setIsOpen(false)}>Navigation</SheetHeader>
        <SheetBody>
          <nav className="flex flex-col gap-1 px-4 py-2">
            {['Overview', 'Phases', 'Participants', 'Rubric', 'Summary'].map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  className="flex h-10 items-center rounded-lg px-4 text-sm hover:bg-neutral-gray1"
                >
                  {item}
                </button>
              ),
            )}
          </nav>
        </SheetBody>
      </Sheet>
    </SheetTrigger>
  );
};

export const RightSheet = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SheetTrigger>
      <Button onPress={() => setIsOpen(true)}>Open Right Sheet</Button>
      <Sheet side="right" isOpen={isOpen} onOpenChange={setIsOpen}>
        <SheetHeader onClose={() => setIsOpen(false)}>Filters</SheetHeader>
        <SheetBody className="p-4">
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-sm font-medium">Status</p>
              <div className="flex flex-col gap-2">
                {['Draft', 'Active', 'Completed'].map((status) => (
                  <label
                    key={status}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input type="checkbox" className="rounded" />
                    {status}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Priority</p>
              <div className="flex flex-col gap-2">
                {['High', 'Medium', 'Low'].map((priority) => (
                  <label
                    key={priority}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input type="checkbox" className="rounded" />
                    {priority}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </SheetBody>
      </Sheet>
    </SheetTrigger>
  );
};

export const LeftSheet = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SheetTrigger>
      <Button onPress={() => setIsOpen(true)}>Open Left Sheet</Button>
      <Sheet side="left" isOpen={isOpen} onOpenChange={setIsOpen}>
        <SheetHeader onClose={() => setIsOpen(false)}>Menu</SheetHeader>
        <SheetBody>
          <nav className="flex flex-col gap-1 px-4 py-2">
            {['Home', 'Dashboard', 'Projects', 'Settings', 'Help'].map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  className="flex h-10 items-center rounded-lg px-4 text-sm hover:bg-neutral-gray1"
                >
                  {item}
                </button>
              ),
            )}
          </nav>
        </SheetBody>
      </Sheet>
    </SheetTrigger>
  );
};

const DismissableSheet = ({
  side,
  label,
  title,
  description,
}: {
  side: 'bottom' | 'right' | 'left';
  label: string;
  title: string;
  description: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SheetTrigger>
      <Button color="secondary" onPress={() => setIsOpen(true)}>
        {label}
      </Button>
      <Sheet side={side} isOpen={isOpen} onOpenChange={setIsOpen}>
        <SheetHeader onClose={() => setIsOpen(false)}>{title}</SheetHeader>
        <SheetBody className="p-4">
          <p className="text-sm text-neutral-gray4">{description}</p>
        </SheetBody>
      </Sheet>
    </SheetTrigger>
  );
};

export const AllSides = () => (
  <div className="flex flex-wrap gap-3">
    <DismissableSheet
      side="bottom"
      label="Bottom"
      title="Bottom Sheet"
      description="Slides up from the bottom. Useful for mobile navigation menus."
    />
    <DismissableSheet
      side="right"
      label="Right"
      title="Right Sheet"
      description="Slides in from the right. Useful for detail panels and filters."
    />
    <DismissableSheet
      side="left"
      label="Left"
      title="Left Sheet"
      description="Slides in from the left. Useful for sidebars and navigation."
    />
  </div>
);
