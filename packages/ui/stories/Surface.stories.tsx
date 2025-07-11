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
          <h4 className="font-medium mb-2">Card Title</h4>
          <p className="text-sm text-neutral-600">
            This is a basic surface component with some content inside.
          </p>
        </div>
      </Surface>
    </div>
    
    <div className="space-y-4">
      <h3 className="font-medium">Different Sizes</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Surface>
          <div className="p-4">
            <h4 className="font-medium mb-2">Small Card</h4>
            <p className="text-sm text-neutral-600">Compact surface with minimal padding.</p>
          </div>
        </Surface>
        
        <Surface>
          <div className="p-8">
            <h4 className="font-medium mb-2">Large Card</h4>
            <p className="text-sm text-neutral-600">Spacious surface with generous padding.</p>
          </div>
        </Surface>
      </div>
    </div>
    
    <div className="space-y-4">
      <h3 className="font-medium">With Custom Styling</h3>
      <Surface className="shadow-lg">
        <div className="p-6">
          <h4 className="font-medium mb-2">Enhanced Surface</h4>
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
          <div className="flex items-center gap-4 mb-4">
            <div className="size-12 bg-teal rounded-full flex items-center justify-center text-white font-medium">
              JS
            </div>
            <div>
              <h4 className="font-medium">User Profile</h4>
              <p className="text-sm text-neutral-600">john.doe@example.com</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
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
          <button className="w-full bg-teal text-white py-2 px-4 rounded-md text-sm font-medium">
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
        <h4 className="font-medium mb-2">Basic Surface</h4>
        <p className="text-sm text-neutral-600">
          Simple surface with content.
        </p>
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
          className="w-full aspect-video object-cover"
        />
        <div className="p-6">
          <h4 className="font-medium mb-2">Office Space</h4>
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
        <h4 className="font-medium mb-2">Custom Styled Surface</h4>
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
        <div className="p-4 flex items-center gap-4">
          <div className="size-10 bg-neutral-gray1 rounded-full flex items-center justify-center">
            {i + 1}
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Item {i + 1}</h4>
            <p className="text-sm text-neutral-600">Description for item {i + 1}</p>
          </div>
          <button className="text-teal text-sm">Edit</button>
        </div>
      </Surface>
    ))}
  </div>
);

export const Grid = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: 6 }, (_, i) => (
      <Surface key={i}>
        <div className="p-4">
          <div className="aspect-square bg-neutral-gray1 rounded-lg mb-4 flex items-center justify-center">
            <div className="text-2xl">📊</div>
          </div>
          <h4 className="font-medium mb-2">Chart {i + 1}</h4>
          <p className="text-sm text-neutral-600">
            Data visualization component {i + 1}
          </p>
        </div>
      </Surface>
    ))}
  </div>
);