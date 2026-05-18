import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  NotificationPanel,
  NotificationPanelHeader,
  NotificationPanelItem,
  NotificationPanelList,
} from '@/components/NotificationPanel';

const meta: Meta<typeof NotificationPanel> = {
  title: 'shadcn/NotificationPanel',
  component: NotificationPanel,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[28rem]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof NotificationPanel>;

export const Default: Story = {
  render: () => (
    <NotificationPanel>
      <NotificationPanelHeader title="Pending invites" count={3} />
      <NotificationPanelList>
        <NotificationPanelItem>Alex invited you to Acme</NotificationPanelItem>
        <NotificationPanelItem>Bea invited you to Globex</NotificationPanelItem>
        <NotificationPanelItem>Cy invited you to Initech</NotificationPanelItem>
      </NotificationPanelList>
    </NotificationPanel>
  ),
};

export const Empty: Story = {
  render: () => (
    <NotificationPanel>
      <NotificationPanelHeader title="All caught up" count={0} />
    </NotificationPanel>
  ),
};
