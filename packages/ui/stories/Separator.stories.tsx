import { Separator } from '../src/components/Separator';

export default {
  title: 'Separator',
  component: Separator,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
    },
    className: {
      control: 'text',
    },
  },
  args: {
    orientation: 'horizontal',
  },
};

export const Example = () => (
  <div className="w-full max-w-md space-y-8">
    <div className="space-y-4">
      <h3 className="font-medium">Horizontal Separators</h3>
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">Content above separator</p>
        <Separator />
        <p className="text-sm text-neutral-600">Content below separator</p>
      </div>
    </div>

    <div className="space-y-4">
      <h3 className="font-medium">Vertical Separators</h3>
      <div className="flex h-20 items-center gap-4">
        <div className="text-sm text-neutral-600">Left content</div>
        <Separator orientation="vertical" />
        <div className="text-sm text-neutral-600">Right content</div>
      </div>
    </div>

    <div className="space-y-4">
      <h3 className="font-medium">In Navigation</h3>
      <div className="flex items-center gap-4">
        <a href="#" className="text-sm text-teal">
          Home
        </a>
        <Separator orientation="vertical" className="h-4" />
        <a href="#" className="text-sm text-teal">
          About
        </a>
        <Separator orientation="vertical" className="h-4" />
        <a href="#" className="text-sm text-teal">
          Contact
        </a>
      </div>
    </div>

    <div className="space-y-4">
      <h3 className="font-medium">In Content Layout</h3>
      <div className="rounded-lg border border-neutral-gray3 p-6">
        <h4 className="font-medium">Section Title</h4>
        <p className="mt-2 text-sm text-neutral-600">
          This is the first section with some content.
        </p>
        <Separator className="my-4" />
        <h4 className="font-medium">Another Section</h4>
        <p className="mt-2 text-sm text-neutral-600">
          This is the second section, separated from the first.
        </p>
        <Separator className="my-4" />
        <h4 className="font-medium">Final Section</h4>
        <p className="mt-2 text-sm text-neutral-600">
          This is the last section in the content layout.
        </p>
      </div>
    </div>
  </div>
);

export const Horizontal = {
  args: {
    orientation: 'horizontal',
  },
};

export const Vertical = {
  args: {
    orientation: 'vertical',
    className: 'h-8',
  },
};

export const InList = () => (
  <div className="w-full max-w-md rounded-lg border border-neutral-gray3">
    <div className="p-4">
      <h4 className="font-medium">First Item</h4>
      <p className="text-sm text-neutral-600">Description for first item</p>
    </div>
    <Separator />
    <div className="p-4">
      <h4 className="font-medium">Second Item</h4>
      <p className="text-sm text-neutral-600">Description for second item</p>
    </div>
    <Separator />
    <div className="p-4">
      <h4 className="font-medium">Third Item</h4>
      <p className="text-sm text-neutral-600">Description for third item</p>
    </div>
  </div>
);

export const InBreadcrumb = () => (
  <div className="flex items-center gap-2 text-sm">
    <a href="#" className="text-teal">
      Home
    </a>
    <Separator orientation="vertical" className="h-4" />
    <a href="#" className="text-teal">
      Category
    </a>
    <Separator orientation="vertical" className="h-4" />
    <a href="#" className="text-teal">
      Subcategory
    </a>
    <Separator orientation="vertical" className="h-4" />
    <span className="text-neutral-600">Current Page</span>
  </div>
);

export const InToolbar = () => (
  <div className="flex items-center gap-2 rounded-lg border border-neutral-gray3 p-2">
    <button className="rounded bg-neutral-gray1 px-3 py-1 text-sm">Bold</button>
    <button className="rounded bg-neutral-gray1 px-3 py-1 text-sm">
      Italic
    </button>
    <button className="rounded bg-neutral-gray1 px-3 py-1 text-sm">
      Underline
    </button>
    <Separator orientation="vertical" className="h-6" />
    <button className="rounded bg-neutral-gray1 px-3 py-1 text-sm">Left</button>
    <button className="rounded bg-neutral-gray1 px-3 py-1 text-sm">
      Center
    </button>
    <button className="rounded bg-neutral-gray1 px-3 py-1 text-sm">
      Right
    </button>
    <Separator orientation="vertical" className="h-6" />
    <button className="rounded bg-neutral-gray1 px-3 py-1 text-sm">Link</button>
  </div>
);

export const InSidebar = () => (
  <div className="w-64 rounded-lg border border-neutral-gray3 p-4">
    <h4 className="mb-3 font-medium">Navigation</h4>
    <div className="space-y-2">
      <a href="#" className="block py-1 text-sm text-teal">
        Dashboard
      </a>
      <a href="#" className="block py-1 text-sm text-teal">
        Projects
      </a>
      <a href="#" className="block py-1 text-sm text-teal">
        Tasks
      </a>
    </div>
    <Separator className="my-4" />
    <h4 className="mb-3 font-medium">Settings</h4>
    <div className="space-y-2">
      <a href="#" className="block py-1 text-sm text-teal">
        Profile
      </a>
      <a href="#" className="block py-1 text-sm text-teal">
        Preferences
      </a>
      <a href="#" className="block py-1 text-sm text-teal">
        Security
      </a>
    </div>
  </div>
);
