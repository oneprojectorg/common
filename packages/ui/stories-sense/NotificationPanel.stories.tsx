import { Avatar, AvatarFallback } from '@op/sense/Avatar';
import { Button } from '@op/sense/Button';
import {
  NotificationPanel,
  NotificationPanelActions,
  NotificationPanelHeader,
  NotificationPanelItem,
  NotificationPanelList,
} from '@op/sense/NotificationPanel';
import { ProfileItem } from '@op/sense/ProfileItem';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof NotificationPanel> = {
  title: 'Sense/Composites/NotificationPanel',
  component: NotificationPanel,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof NotificationPanel>;

const people = ['Frida Kahlo', 'Mark Rothko'];

export const Default: Story = {
  render: () => (
    <div className="w-[36rem]">
      <NotificationPanel>
        <NotificationPanelHeader title="Requests" count={people.length} />
        <NotificationPanelList>
          {people.map((name) => (
            <NotificationPanelItem key={name}>
              <ProfileItem
                avatar={
                  <Avatar>
                    <AvatarFallback name={name} />
                  </Avatar>
                }
                title={name}
                description="Wants to join Climate Assembly"
              />
              <NotificationPanelActions>
                <Button variant="outline" size="sm">
                  Decline
                </Button>
                <Button size="sm">Approve</Button>
              </NotificationPanelActions>
            </NotificationPanelItem>
          ))}
        </NotificationPanelList>
      </NotificationPanel>
    </div>
  ),
};
