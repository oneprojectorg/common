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
  <div className="max-w-2xl space-y-8 w-full">
    <div className="space-y-4">
      <h3 className="font-medium">Basic Surface</h3>
      <Surface>
        <div className="p-6">
          <h4 className="mb-2 font-medium">Card Title</h4>
          <p className="text-neutral-600 text-sm">
            This is a basic surface component with some content inside.
          </p>
        </div>
      </Surface>
    </div>

    <div className="space-y-4">
      <h3 className="font-medium">Different Sizes</h3>
      <div className="gap-4 md:grid-cols-2 grid grid-cols-1">
        <Surface>
          <div className="p-4">
            <h4 className="mb-2 font-medium">Small Card</h4>
            <p className="text-neutral-600 text-sm">
              Compact surface with minimal padding.
            </p>
          </div>
        </Surface>

        <Surface>
          <div className="p-8">
            <h4 className="mb-2 font-medium">Large Card</h4>
            <p className="text-neutral-600 text-sm">
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
          <p className="text-neutral-600 text-sm">
            This surface has additional shadow styling applied.
          </p>
        </div>
      </Surface>
    </div>

    <div className="space-y-4">
      <h3 className="font-medium">Complex Content</h3>
      <Surface>
        <div className="p-6">
          <div className="mb-4 gap-4 flex items-center">
            <div className="size-12 font-medium flex items-center justify-center rounded-full bg-teal text-white">
              JS
            </div>
            <div>
              <h4 className="font-medium">User Profile</h4>
              <p className="text-neutral-600 text-sm">john.doe@example.com</p>
            </div>
          </div>
          <div className="mb-4 gap-4 grid grid-cols-3">
            <div className="text-center">
              <div className="font-bold text-lg">127</div>
              <div className="text-neutral-600 text-xs">Posts</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg">1.2K</div>
              <div className="text-neutral-600 text-xs">Followers</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg">342</div>
              <div className="text-neutral-600 text-xs">Following</div>
            </div>
          </div>
          <button className="px-4 py-2 font-medium w-full rounded-md bg-teal text-sm text-white">
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
        <p className="text-neutral-600 text-sm">Simple surface with content.</p>
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
          <p className="text-neutral-600 text-sm">
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
        <p className="text-neutral-600 text-sm">
          This surface has custom border and shadow styling.
        </p>
      </div>
    ),
  },
};

export const List = () => (
  <div className="max-w-md space-y-4 w-full">
    {Array.from({ length: 3 }, (_, i) => (
      <Surface key={i}>
        <div className="gap-4 p-4 flex items-center">
          <div className="size-10 flex items-center justify-center rounded-full bg-neutral-gray1">
            {i + 1}
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Item {i + 1}</h4>
            <p className="text-neutral-600 text-sm">
              Description for item {i + 1}
            </p>
          </div>
          <button className="text-sm text-teal">Edit</button>
        </div>
      </Surface>
    ))}
  </div>
);

export const Grid = () => (
  <div className="gap-4 md:grid-cols-2 lg:grid-cols-3 grid grid-cols-1">
    {Array.from({ length: 6 }, (_, i) => (
      <Surface key={i}>
        <div className="p-4">
          <div className="mb-4 flex aspect-square items-center justify-center rounded-lg bg-neutral-gray1">
            <div className="text-2xl">📊</div>
          </div>
          <h4 className="mb-2 font-medium">Chart {i + 1}</h4>
          <p className="text-neutral-600 text-sm">
            Data visualization component {i + 1}
          </p>
        </div>
      </Surface>
    ))}
  </div>
);
