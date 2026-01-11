import { Surface } from '../src/components/Surface';

export default {
  title: 'Surface',
  component: Surface,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
    },
  },
};

export const Example = () => (
  <div className="w-full max-w-2xl space-y-8">
    <div className="space-y-4">
      <h3 className="font-medium">Basic Surface</h3>
      <Surface>
        <div className="p-6">
          <h4 className="mb-2 font-medium">Card Title</h4>
          <p className="text-sm text-neutral-600">
            This is a basic surface component with some content inside.
          </p>
        </div>
      </Surface>
    </div>

    <div className="space-y-4">
      <h3 className="font-medium">Different Sizes</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Surface>
          <div className="p-4">
            <h4 className="mb-2 font-medium">Small Card</h4>
            <p className="text-sm text-neutral-600">
              Compact surface with minimal padding.
            </p>
          </div>
        </Surface>

        <Surface>
          <div className="p-8">
            <h4 className="mb-2 font-medium">Large Card</h4>
            <p className="text-sm text-neutral-600">
              Spacious surface with generous padding.
            </p>
          </div>
        </Surface>
      </div>
    </div>

    <div className="space-y-4">
      <h3 className="font-medium">With Custom Styling</h3>
      <Surface className="shadow-lg">
        <div className="p-6">
          <h4 className="mb-2 font-medium">Enhanced Surface</h4>
          <p className="text-sm text-neutral-600">
            This surface has additional shadow styling applied.
          </p>
        </div>
      </Surface>
    </div>

    <div className="space-y-4">
      <h3 className="font-medium">Complex Content</h3>
      <Surface>
        <div className="p-6">
          <div className="mb-4 flex items-center gap-4">
            <div className="bg-teal flex size-12 items-center justify-center rounded-full font-medium text-white">
              JS
            </div>
            <div>
              <h4 className="font-medium">User Profile</h4>
              <p className="text-sm text-neutral-600">john.doe@example.com</p>
            </div>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold">127</div>
              <div className="text-xs text-neutral-600">Posts</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">1.2K</div>
              <div className="text-xs text-neutral-600">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">342</div>
              <div className="text-xs text-neutral-600">Following</div>
            </div>
          </div>
          <button className="bg-teal w-full rounded-md px-4 py-2 text-sm font-medium text-white">
            Follow
          </button>
        </div>
      </Surface>
    </div>
  </div>
);

export const Basic = {
  args: {
    children: (
      <div className="p-6">
        <h4 className="mb-2 font-medium">Basic Surface</h4>
        <p className="text-sm text-neutral-600">Simple surface with content.</p>
      </div>
    ),
  },
};

export const WithImage = {
  args: {
    children: (
      <div>
        <img
          src="https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80"
          alt="Office space"
          className="aspect-video w-full object-cover"
        />
        <div className="p-6">
          <h4 className="mb-2 font-medium">Office Space</h4>
          <p className="text-sm text-neutral-600">
            A modern office environment with clean design.
          </p>
        </div>
      </div>
    ),
  },
};

export const CustomStyling = {
  args: {
    className: 'shadow-lg border-teal',
    children: (
      <div className="p-6">
        <h4 className="mb-2 font-medium">Custom Styled Surface</h4>
        <p className="text-sm text-neutral-600">
          This surface has custom border and shadow styling.
        </p>
      </div>
    ),
  },
};

export const List = () => (
  <div className="w-full max-w-md space-y-4">
    {Array.from({ length: 3 }, (_, i) => (
      <Surface key={i}>
        <div className="flex items-center gap-4 p-4">
          <div className="bg-neutral-gray1 flex size-10 items-center justify-center rounded-full">
            {i + 1}
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Item {i + 1}</h4>
            <p className="text-sm text-neutral-600">
              Description for item {i + 1}
            </p>
          </div>
          <button className="text-teal text-sm">Edit</button>
        </div>
      </Surface>
    ))}
  </div>
);

export const Grid = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 6 }, (_, i) => (
      <Surface key={i}>
        <div className="p-4">
          <div className="bg-neutral-gray1 mb-4 flex aspect-square items-center justify-center rounded-lg">
            <div className="text-2xl">📊</div>
          </div>
          <h4 className="mb-2 font-medium">Chart {i + 1}</h4>
          <p className="text-sm text-neutral-600">
            Data visualization component {i + 1}
          </p>
        </div>
      </Surface>
    ))}
  </div>
);
