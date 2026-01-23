import { LuFileText, LuInbox, LuSearch, LuUsers } from 'react-icons/lu';

import { Button } from '../src/components/Button';
import { EmptyState } from '../src/components/EmptyState';

export default {
  title: 'EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export const Default = () => (
  <EmptyState>
    <p>No items found</p>
  </EmptyState>
);

export const WithCustomIcon = () => (
  <EmptyState icon={<LuInbox />}>
    <p>Your inbox is empty</p>
  </EmptyState>
);

export const WithDescription = () => (
  <EmptyState icon={<LuSearch />}>
    <p className="font-medium">No results found</p>
    <p className="text-sm">Try adjusting your search or filters</p>
  </EmptyState>
);

export const WithAction = () => (
  <EmptyState icon={<LuUsers />}>
    <p className="font-medium">No team members</p>
    <p className="mb-3 text-sm">
      Get started by inviting your first team member
    </p>
    <Button size="small">Invite Member</Button>
  </EmptyState>
);

export const Examples = () => (
  <div className="grid w-full max-w-3xl grid-cols-2 gap-8">
    <div className="rounded-lg border border-neutral-gray2 p-4">
      <EmptyState>
        <p>No items found</p>
      </EmptyState>
    </div>

    <div className="rounded-lg border border-neutral-gray2 p-4">
      <EmptyState icon={<LuInbox />}>
        <p>Your inbox is empty</p>
      </EmptyState>
    </div>

    <div className="rounded-lg border border-neutral-gray2 p-4">
      <EmptyState icon={<LuSearch />}>
        <p className="font-medium">No results found</p>
        <p className="text-sm">Try adjusting your search</p>
      </EmptyState>
    </div>

    <div className="rounded-lg border border-neutral-gray2 p-4">
      <EmptyState icon={<LuFileText />}>
        <p className="font-medium">No documents</p>
        <p className="mb-3 text-sm">Upload your first document</p>
        <Button size="small">Upload</Button>
      </EmptyState>
    </div>
  </div>
);
