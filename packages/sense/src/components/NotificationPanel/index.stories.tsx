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
 * How the app calls it: `w-full sm:w-auto` on every action, so the buttons fill
 * the row when NotificationPanelItem stacks and shrink to their labels once it
 * turns into a row. Narrow the browser below `sm` (640px) — the two buttons
 * stack instead of running off the card.
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
            <NotificationPanelActions>
              <Button className="w-full sm:w-auto">Revise proposal</Button>
              <Button variant="outline" className="w-full sm:w-auto">
                Ignore
              </Button>
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
