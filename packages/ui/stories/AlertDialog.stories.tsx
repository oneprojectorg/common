import { DialogTrigger } from 'react-aria-components';

import { AlertDialog } from '../src/components/AlertDialog';
import { Button } from '../src/components/Button';
import { Modal } from '../src/components/Modal';

import type { Meta } from '@storybook/react';

const meta: Meta<typeof AlertDialog> = {
  component: AlertDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

export const Example = (args: any) => (
  <DialogTrigger>
    <Button>Delete…</Button>
    <Modal>
      <AlertDialog {...args} />
    </Modal>
  </DialogTrigger>
);

Example.args = {
  title: 'Delete folder',
  children:
    'Are you sure you want to delete "Documents"? All contents will be permanently destroyed.',
  variant: 'destructive',
  actionLabel: 'Delete',
};
