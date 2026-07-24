import { Avatar, AvatarFallback } from '@op/sense/Avatar';
import { ProfileItem } from '@op/sense/ProfileItem';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import { Avatar as OldAvatar } from '../../src/components/Avatar';
import { ProfileItem as OldProfileItem } from '../../src/components/ProfileItem';

const meta: Meta = {
  title: 'Sense Comparison/Composites/ProfileItem',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

const newAvatar = (
  <Avatar>
    <AvatarFallback name="Frida Kahlo" />
  </Avatar>
);
const oldAvatar = <OldAvatar placeholder="Frida Kahlo" />;

export const ProfileItemComparison: Story = {
  name: 'ProfileItem',
  render: () => (
    <div className="p-8">
      <Section title="ProfileItem">
        <Pair
          label="Default"
          old={
            <div className="w-72">
              <OldProfileItem
                avatar={oldAvatar}
                title="Frida Kahlo"
                description="Painter · Coyoacán"
              />
            </div>
          }
          raw={
            <div className="w-72">
              <ProfileItem
                avatar={newAvatar}
                title="Frida Kahlo"
                description="Painter · Coyoacán"
              />
            </div>
          }
        />
        <Pair
          label="Title only"
          old={
            <div className="w-72">
              <OldProfileItem avatar={oldAvatar} title="Frida Kahlo" />
            </div>
          }
          raw={
            <div className="w-72">
              <ProfileItem avatar={newAvatar} title="Frida Kahlo" />
            </div>
          }
        />
        <Pair
          label="Small"
          old={
            <div className="w-72">
              <OldProfileItem
                avatar={oldAvatar}
                size="small"
                title="Frida Kahlo"
                description="Invited 2 days ago"
              />
            </div>
          }
          raw={
            <div className="w-72">
              <ProfileItem
                avatar={newAvatar}
                size="small"
                title="Frida Kahlo"
                description="Invited 2 days ago"
              />
            </div>
          }
        />
      </Section>
    </div>
  ),
};
