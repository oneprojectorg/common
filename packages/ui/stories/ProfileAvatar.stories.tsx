import { Avatar } from '../src/components/Avatar';
import { Button } from '../src/components/Button';
import { ProfileAvatar } from '../src/components/ProfileAvatar';

export default {
  title: 'ProfileAvatar',
  component: ProfileAvatar,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
    },
    description: {
      control: 'text',
    },
    className: {
      control: 'text',
    },
  },
  args: {
    title: 'Tech Innovation Hub',
  },
};

export const Example = () => (
  <div className="flex flex-col gap-8">
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Organizations</h3>
      <div className="space-y-4">
        <ProfileAvatar
          avatar={<Avatar placeholder="Tech Innovation Hub" />}
          title="Tech Innovation Hub"
          description="Building the future of decentralized technology"
        />
        <ProfileAvatar
          avatar={<Avatar placeholder="Green Earth Foundation" />}
          title="Green Earth Foundation"
          description="Environmental conservation and sustainability initiatives"
        />
        <ProfileAvatar
          avatar={<Avatar placeholder="OpenSource Collective" />}
          title="OpenSource Collective"
          description="Supporting open source projects and communities"
        >
          <div className="mt-3 flex gap-2">
            <Button size="small">Join</Button>
            <Button size="small" color="secondary">
              Learn More
            </Button>
          </div>
        </ProfileAvatar>
      </div>
    </div>

    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Users</h3>
      <div className="space-y-4">
        <ProfileAvatar
          avatar={<Avatar placeholder="Sarah Chen" />}
          title="Sarah Chen"
          description="Product Designer specializing in accessible interfaces"
        />
        <ProfileAvatar
          avatar={<Avatar placeholder="Marcus Rodriguez" />}
          title="Marcus Rodriguez"
          description="Full-stack developer and open source contributor"
        >
          <div className="mt-3 flex gap-2">
            <Button size="small">Follow</Button>
            <Button size="small" color="secondary">
              Message
            </Button>
          </div>
        </ProfileAvatar>
        <ProfileAvatar
          avatar={<Avatar placeholder="Aisha Patel" className="size-12" />}
          title="Aisha Patel"
          description="Community organizer and blockchain advocate"
        />
      </div>
    </div>

    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Proposals</h3>
      <div className="space-y-4">
        <ProfileAvatar
          avatar={<Avatar placeholder="Community Garden Initiative" />}
          title="Community Garden Initiative"
          description="Proposal to establish urban gardens in underserved neighborhoods"
        >
          <div className="mt-3 text-sm text-neutral-charcoal">
            Funding Goal: $50,000 • Status: Active
          </div>
        </ProfileAvatar>
        <ProfileAvatar
          avatar={
            <Avatar placeholder="Youth Education Program" className="size-16" />
          }
          title="Youth Education Program"
          description="Comprehensive STEM education program for students ages 12-18"
        >
          <div className="mt-3 space-y-2">
            <div className="text-sm text-neutral-charcoal">
              <strong>Category:</strong> Education
            </div>
            <div className="text-sm text-neutral-charcoal">
              <strong>Timeline:</strong> 12 months
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="small">Support</Button>
              <Button size="small" color="secondary">
                View Details
              </Button>
            </div>
          </div>
        </ProfileAvatar>
      </div>
    </div>
  </div>
);

export const OrganizationWithActions = {
  args: {
    avatar: <Avatar placeholder="Green Earth Foundation" />,
    title: 'Green Earth Foundation',
    description: 'Environmental conservation and sustainability initiatives',
    children: (
      <div className="mt-3 flex gap-2">
        <Button size="small">Join</Button>
        <Button size="small" color="secondary">
          Learn More
        </Button>
      </div>
    ),
  },
};

export const UserProfile = {
  args: {
    avatar: <Avatar placeholder="Sarah Chen" />,
    title: 'Sarah Chen',
    description: 'Product Designer specializing in accessible interfaces',
  },
};

export const ProposalWithDetails = {
  args: {
    avatar: (
      <Avatar placeholder="Youth Education Program" className="size-16" />
    ),
    title: 'Youth Education Program',
    description: 'Comprehensive STEM education program for students ages 12-18',
    children: (
      <div className="mt-3 space-y-2">
        <div className="text-sm text-neutral-charcoal">
          <strong>Category:</strong> Education
        </div>
        <div className="text-sm text-neutral-charcoal">
          <strong>Timeline:</strong> 12 months
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="small">Support</Button>
          <Button size="small" color="secondary">
            View Details
          </Button>
        </div>
      </div>
    ),
  },
};
