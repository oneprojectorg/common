import { LoadingSpinner } from '../src/components/LoadingSpinner';

export default {
  title: 'LoadingSpinner',
  component: LoadingSpinner,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: 'select',
      options: ['teal', 'gray'],
    },
    size: {
      control: 'select',
      options: ['md'],
    },
    className: {
      control: 'text',
    },
  },
  args: {
    color: 'teal',
    size: 'md',
  },
};

export const Example = () => (
  <div className="flex flex-col gap-8">
    <div className="flex items-center gap-4">
      <LoadingSpinner />
      <LoadingSpinner color="gray" />
    </div>

    <div className="flex items-center gap-4">
      <LoadingSpinner className="size-4" />
      <LoadingSpinner className="size-8" />
      <LoadingSpinner className="size-12" />
      <LoadingSpinner className="size-16" />
    </div>

    <div className="flex items-center gap-4">
      <LoadingSpinner color="gray" className="size-4" />
      <LoadingSpinner color="gray" className="size-8" />
      <LoadingSpinner color="gray" className="size-12" />
      <LoadingSpinner color="gray" className="size-16" />
    </div>
  </div>
);

export const Teal = {
  args: {
    color: 'teal',
  },
};

export const Gray = {
  args: {
    color: 'gray',
  },
};

export const Small = {
  args: {
    className: 'size-4',
  },
};

export const Large = {
  args: {
    className: 'size-12',
  },
};

export const InContext = () => (
  <div className="space-y-8">
    <div className="rounded-lg border border-neutral-gray3 p-6">
      <div className="flex items-center gap-3">
        <LoadingSpinner className="size-4" />
        <span className="text-sm">Loading...</span>
      </div>
    </div>

    <div className="rounded-lg border border-neutral-gray3 p-6">
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner className="size-8" />
        <span className="text-sm text-neutral-600">
          Please wait while we process your request
        </span>
      </div>
    </div>

    <div className="rounded-lg border border-neutral-gray3 p-6">
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="text-center">
          <LoadingSpinner className="mx-auto mb-4 size-12" />
          <h3 className="font-medium">Loading content</h3>
          <p className="text-sm text-neutral-600">
            This may take a few moments
          </p>
        </div>
      </div>
    </div>
  </div>
);
