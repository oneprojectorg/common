import { Skeleton, SkeletonLine } from '../src/components/Skeleton';

export default {
  title: 'Skeleton',
  component: Skeleton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
    },
    lines: {
      control: 'number',
    },
    randomWidth: {
      control: 'boolean',
    },
  },
  args: {
    className: 'h-4 w-32',
  },
};

export const Example = () => (
  <div className="max-w-md space-y-8 w-full">
    <div className="space-y-4">
      <h3 className="font-medium">Basic Skeletons</h3>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>

    <div className="space-y-4">
      <h3 className="font-medium">Different Sizes</h3>
      <div className="space-y-2">
        <Skeleton className="h-2 w-32" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-32" />
      </div>
    </div>

    <div className="space-y-4">
      <h3 className="font-medium">Shapes</h3>
      <div className="gap-4 flex items-center">
        <Skeleton className="size-12 rounded-full" />
        <Skeleton className="size-12 rounded-md" />
        <Skeleton className="h-12 w-24 rounded-lg" />
      </div>
    </div>

    <div className="space-y-4">
      <h3 className="font-medium">Skeleton Lines</h3>
      <SkeletonLine lines={3} />
      <SkeletonLine lines={5} randomWidth={false} />
      <SkeletonLine lines={4} randomWidth />
    </div>
  </div>
);

export const Basic = {
  args: {
    className: 'h-4 w-32',
  },
};

export const Circle = {
  args: {
    className: 'size-12 rounded-full',
  },
};

export const Rectangle = {
  args: {
    className: 'h-24 w-48 rounded-lg',
  },
};

export const Lines = () => (
  <div className="max-w-md space-y-6 w-full">
    <div>
      <h4 className="mb-2 font-medium">3 Lines</h4>
      <SkeletonLine lines={3} />
    </div>
    <div>
      <h4 className="mb-2 font-medium">5 Lines (No Random Width)</h4>
      <SkeletonLine lines={5} randomWidth={false} />
    </div>
    <div>
      <h4 className="mb-2 font-medium">10 Lines (Default)</h4>
      <SkeletonLine />
    </div>
  </div>
);

export const ContentLayout = () => (
  <div className="max-w-md space-y-6 w-full">
    <div className="p-6 rounded-lg border border-neutral-gray3">
      <div className="mb-4 gap-4 flex items-center">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex-1">
          <Skeleton className="mb-2 h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <SkeletonLine lines={3} />
    </div>

    <div className="p-6 rounded-lg border border-neutral-gray3">
      <Skeleton className="mb-4 h-6 w-48" />
      <div className="gap-4 grid grid-cols-2">
        <div>
          <Skeleton className="mb-2 h-32 w-full rounded-md" />
          <Skeleton className="mb-1 h-4 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        <div>
          <Skeleton className="mb-2 h-32 w-full rounded-md" />
          <Skeleton className="mb-1 h-4 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    </div>

    <div className="p-6 rounded-lg border border-neutral-gray3">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="gap-3 flex items-center">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1">
              <Skeleton className="mb-1 h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-6 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  </div>
);
