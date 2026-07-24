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

import { Pair, Section } from '../../src/comparison/Comparison';
import { Avatar as OldAvatar } from '../../src/components/Avatar';
import { Button as OldButton } from '../../src/components/Button';
import {
  NotificationPanel as OldNotificationPanel,
  NotificationPanelActions as OldNotificationPanelActions,
  NotificationPanelHeader as OldNotificationPanelHeader,
  NotificationPanelItem as OldNotificationPanelItem,
  NotificationPanelList as OldNotificationPanelList,
} from '../../src/components/NotificationPanel';
import { ProfileItem as OldProfileItem } from '../../src/components/ProfileItem';

const meta: Meta = {
  title: 'Sense Comparison/Composites/NotificationPanel',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

const oldPanel = (
  <OldNotificationPanel>
    <OldNotificationPanelHeader title="Requests" count={1} />
    <OldNotificationPanelList>
      <OldNotificationPanelItem>
        <OldProfileItem
          avatar={<OldAvatar placeholder="Frida Kahlo" />}
          title="Frida Kahlo"
          description="Wants to join Climate Assembly"
        />
        <OldNotificationPanelActions>
          <OldButton size="small" color="secondary">
            Decline
          </OldButton>
          <OldButton size="small">Approve</OldButton>
        </OldNotificationPanelActions>
      </OldNotificationPanelItem>
    </OldNotificationPanelList>
  </OldNotificationPanel>
);

const newPanel = (
  <NotificationPanel>
    <NotificationPanelHeader title="Requests" count={1} />
    <NotificationPanelList>
      <NotificationPanelItem>
        <ProfileItem
          avatar={
            <Avatar>
              <AvatarFallback name="Frida Kahlo">FK</AvatarFallback>
            </Avatar>
          }
          title="Frida Kahlo"
          description="Wants to join Climate Assembly"
        />
        <NotificationPanelActions>
          <Button variant="outline" size="sm">
            Decline
          </Button>
          <Button size="sm">Approve</Button>
        </NotificationPanelActions>
      </NotificationPanelItem>
    </NotificationPanelList>
  </NotificationPanel>
);

export const NotificationPanelComparison: Story = {
  name: 'NotificationPanel',
  render: () => (
    <div className="p-8">
      <Section title="NotificationPanel">
        <Pair
          label="Requests panel"
          old={<div className="w-[32rem]">{oldPanel}</div>}
          raw={<div className="w-[32rem]">{newPanel}</div>}
        />
      </Section>
    </div>
  ),
};
