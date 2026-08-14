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

const meta: Meta<typeof NotificationPanel> = {
  title: 'Composites/NotificationPanel',
  component: NotificationPanel,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof NotificationPanel>;

const people = ['Frida Kahlo', 'Mark Rothko'];

/**
 * The app's pattern: `w-full sm:w-auto` on each action, plus `flex-col-reverse`
 * so the primary leads the stack. Narrow below `sm` (640px) to see it.
 */
export const ResponsiveActions: Story = {
  render: () => (
    <div className="w-[36rem] max-w-full">
      <NotificationPanel>
        <NotificationPanelHeader title="Active Decisions" count={1} />
        <NotificationPanelList>
          <NotificationPanelItem>
            <ProfileItem
              avatar={
                <Avatar>
                  <AvatarFallback name="Community Solar" />
                </Avatar>
              }
              title="Revision Request"
              description="A reviewer has requested changes to Community Solar"
            />
            <NotificationPanelActions className="flex-col-reverse">
              <Button variant="outline" className="w-full sm:w-auto">
                Ignore
              </Button>
              <Button className="w-full sm:w-auto">Revise proposal</Button>
            </NotificationPanelActions>
          </NotificationPanelItem>
        </NotificationPanelList>
      </NotificationPanel>
    </div>
  ),
};

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
