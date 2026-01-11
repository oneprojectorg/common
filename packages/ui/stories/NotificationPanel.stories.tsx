import { Avatar } from '../src/components/Avatar';
import { Button } from '../src/components/Button';
import {
  NotificationPanel,
  NotificationPanelActions,
  NotificationPanelHeader,
  NotificationPanelItem,
  NotificationPanelList,
} from '../src/components/NotificationPanel';
import { ProfileItem } from '../src/components/ProfileItem';

export default {
  title: 'NotificationPanel',
  component: NotificationPanel,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export const Example = () => (
  <div className="flex flex-col gap-8">
    <NotificationPanel>
      <NotificationPanelHeader title="Active Decisions" count={3} />
      <NotificationPanelList>
        <NotificationPanelItem>
          <ProfileItem
            avatar={<Avatar placeholder="Community Budget 2024" />}
            title="Community Budget 2024"
            description="Vote on how to allocate community funds for the upcoming year"
          />
          <NotificationPanelActions>
            <Button size="small">Participate</Button>
          </NotificationPanelActions>
        </NotificationPanelItem>
        <NotificationPanelItem>
          <ProfileItem
            avatar={<Avatar placeholder="Park Renovation Project" />}
            title="Park Renovation Project"
            description="Help decide the new features for Central Park renovation"
          />
          <NotificationPanelActions>
            <Button size="small">Participate</Button>
          </NotificationPanelActions>
        </NotificationPanelItem>
        <NotificationPanelItem>
          <ProfileItem
            avatar={<Avatar placeholder="Transportation Initiative" />}
            title="Transportation Initiative"
            description="Propose and vote on local transportation improvements"
          />
          <NotificationPanelActions>
            <Button size="small">Participate</Button>
          </NotificationPanelActions>
        </NotificationPanelItem>
      </NotificationPanelList>
    </NotificationPanel>
  </div>
);

export const RelationshipRequests = () => (
  <NotificationPanel>
    <NotificationPanelHeader title="Relationship Requests" count={2} />
    <NotificationPanelList>
      <NotificationPanelItem>
        <div className="flex items-center gap-3">
          <Avatar placeholder="Green Earth Foundation" />
          <div className="flex h-full flex-col">
            <span className="font-bold">Green Earth Foundation</span>
            <span>Added you as a Partner</span>
          </div>
        </div>
        <NotificationPanelActions>
          <Button color="secondary" size="small">
            Decline
          </Button>
          <Button size="small">Accept</Button>
        </NotificationPanelActions>
      </NotificationPanelItem>
      <NotificationPanelItem>
        <div className="flex items-center gap-3">
          <Avatar placeholder="Tech Innovation Hub" />
          <div className="flex h-full flex-col">
            <span className="font-bold">Tech Innovation Hub</span>
            <span>Added you as a Funder</span>
          </div>
        </div>
        <NotificationPanelActions>
          <Button color="secondary" size="small">
            Decline
          </Button>
          <Button size="small">Accept</Button>
        </NotificationPanelActions>
      </NotificationPanelItem>
    </NotificationPanelList>
  </NotificationPanel>
);

export const AcceptedState = () => (
  <NotificationPanel>
    <NotificationPanelHeader title="Relationship Requests" count={1} />
    <NotificationPanelList>
      <NotificationPanelItem className="bg-primary-tealWhite">
        <div className="flex items-center gap-3">
          <Avatar placeholder="Green Earth Foundation" />
          <div className="flex h-full flex-col">
            <span className="font-bold">
              Green Earth Foundation
              <span className="font-normal">
                {' '}
                will now appear as a
              </span> Partner{' '}
              <span className="font-normal">on your profile.</span>
            </span>
          </div>
        </div>
        <NotificationPanelActions>
          <span className="text-neutral-charcoal text-sm">Accepted</span>
        </NotificationPanelActions>
      </NotificationPanelItem>
    </NotificationPanelList>
  </NotificationPanel>
);

export const SingleNotification = () => (
  <NotificationPanel>
    <NotificationPanelHeader title="Pending Reviews" count={1} />
    <NotificationPanelList>
      <NotificationPanelItem>
        <ProfileItem
          avatar={<Avatar placeholder="Annual Report" />}
          title="Annual Report 2024"
          description="Review and approve the annual community report"
        />
        <NotificationPanelActions>
          <Button color="secondary" size="small">
            Later
          </Button>
          <Button size="small">Review</Button>
        </NotificationPanelActions>
      </NotificationPanelItem>
    </NotificationPanelList>
  </NotificationPanel>
);
