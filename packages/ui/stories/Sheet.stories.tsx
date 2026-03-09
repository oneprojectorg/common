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

export const BottomSheet = () => (
  <SheetTrigger>
    <Button>Open Bottom Sheet</Button>
    <Sheet side="bottom">
      <SheetHeader>Navigation</SheetHeader>
      <SheetBody>
        <nav className="flex flex-col gap-1 px-4 py-2">
          {['Overview', 'Phases', 'Participants', 'Rubric', 'Summary'].map(
            (item) => (
              <button
                key={item}
                type="button"
                className="flex h-10 items-center rounded-md px-4 text-sm hover:bg-neutral-gray1"
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

export const RightSheet = () => (
  <SheetTrigger>
    <Button>Open Right Sheet</Button>
    <Sheet side="right">
      <SheetHeader>Filters</SheetHeader>
      <SheetBody className="p-4">
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-medium">Status</p>
            <div className="flex flex-col gap-2">
              {['Draft', 'Active', 'Completed'].map((status) => (
                <label key={status} className="flex items-center gap-2 text-sm">
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

export const LeftSheet = () => (
  <SheetTrigger>
    <Button>Open Left Sheet</Button>
    <Sheet side="left">
      <SheetHeader>Menu</SheetHeader>
      <SheetBody>
        <nav className="flex flex-col gap-1 px-4 py-2">
          {['Home', 'Dashboard', 'Projects', 'Settings', 'Help'].map((item) => (
            <button
              key={item}
              type="button"
              className="flex h-10 items-center rounded-md px-4 text-sm hover:bg-neutral-gray1"
            >
              {item}
            </button>
          ))}
        </nav>
      </SheetBody>
    </Sheet>
  </SheetTrigger>
);

export const AllSides = () => (
  <div className="flex flex-wrap gap-3">
    <SheetTrigger>
      <Button color="secondary">Bottom</Button>
      <Sheet side="bottom">
        <SheetHeader>Bottom Sheet</SheetHeader>
        <SheetBody className="p-4">
          <p className="text-sm text-neutral-gray4">
            Slides up from the bottom. Useful for mobile navigation menus.
          </p>
        </SheetBody>
      </Sheet>
    </SheetTrigger>

    <SheetTrigger>
      <Button color="secondary">Right</Button>
      <Sheet side="right">
        <SheetHeader>Right Sheet</SheetHeader>
        <SheetBody className="p-4">
          <p className="text-sm text-neutral-gray4">
            Slides in from the right. Useful for detail panels and filters.
          </p>
        </SheetBody>
      </Sheet>
    </SheetTrigger>

    <SheetTrigger>
      <Button color="secondary">Left</Button>
      <Sheet side="left">
        <SheetHeader>Left Sheet</SheetHeader>
        <SheetBody className="p-4">
          <p className="text-sm text-neutral-gray4">
            Slides in from the left. Useful for sidebars and navigation.
          </p>
        </SheetBody>
      </Sheet>
    </SheetTrigger>
  </div>
);
