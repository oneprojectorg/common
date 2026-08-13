import { Button } from '@op/sense/Button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuArrowUpRight, LuFolder } from 'react-icons/lu';

const meta: Meta<typeof Empty> = {
  title: 'Primitives/Empty',
  component: Empty,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Empty>;

export const Default: Story = {
  render: () => (
    <div className="max-w-md">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LuFolder />
          </EmptyMedia>
          <EmptyTitle>No Projects Yet</EmptyTitle>
          <EmptyDescription>
            You haven't created any projects yet. Get started by creating your
            first project.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-2">
            <Button>Create Project</Button>
            <Button variant="outline">Import Project</Button>
          </div>
          <Button variant="link">
            Learn More <LuArrowUpRight />
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  ),
};

export const Outlined: Story = {
  render: () => (
    <div className="max-w-md">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LuFolder />
          </EmptyMedia>
          <EmptyTitle>No results</EmptyTitle>
          <EmptyDescription>
            Try adjusting your search or filters.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline">Clear filters</Button>
        </EmptyContent>
      </Empty>
    </div>
  ),
};
