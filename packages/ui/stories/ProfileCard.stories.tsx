import { Chip } from '../src/components/Chip';
import { ProfileCard } from '../src/components/ProfileCard';
import { cn, getGradientForString } from '../src/lib/utils';

export default {
  title: 'ProfileCard',
  component: ProfileCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export const WithImages = () => (
  <div className="flex gap-4">
    <ProfileCard
      headerImage={
        <img
          src="https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=400&h=200&fit=crop"
          alt=""
          className="h-full w-full object-cover"
        />
      }
      avatarImage={
        <img
          src="https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=100&h=100&fit=crop"
          alt=""
          className="h-full w-full object-cover"
        />
      }
      title="Solidarity Seeds"
      subtitle="Portland, Oregon • International"
      badge={
        <Chip size="sm" color="teal" className="bg-primary-teal text-white">
          Active
        </Chip>
      }
      href="/org/solidarity-seeds"
    />
  </div>
);

export const WithGradients = () => {
  const gradientBg = getGradientForString('Common Network');
  const gradientBgHeader = getGradientForString('Common Network C');

  return (
    <div className="flex gap-4">
      <ProfileCard
        headerImage={<div className={cn('h-full w-full', gradientBgHeader)} />}
        avatarImage={<div className={cn('h-full w-full', gradientBg)} />}
        title="Common Network"
        subtitle="Global • Network"
        href="/org/common-network"
      />
    </div>
  );
};

export const NoBadge = () => (
  <ProfileCard
    headerImage={
      <img
        src="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400&h=200&fit=crop"
        alt=""
        className="h-full w-full object-cover"
      />
    }
    avatarImage={
      <img
        src="https://images.unsplash.com/photo-1531747056595-07f6cbbe10ad?w=100&h=100&fit=crop"
        alt=""
        className="h-full w-full object-cover"
      />
    }
    title="Green Future Foundation"
    subtitle="San Francisco, CA • Local"
    href="/org/green-future"
  />
);

export const WithOnClick = () => (
  <ProfileCard
    headerImage={
      <img
        src="https://images.unsplash.com/photo-1511765224389-37f0e77cf0eb?w=400&h=200&fit=crop"
        alt=""
        className="h-full w-full object-cover"
      />
    }
    avatarImage={
      <img
        src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=100&h=100&fit=crop"
        alt=""
        className="h-full w-full object-cover"
      />
    }
    title="Tech for Good"
    subtitle="New York, NY • International"
    onClick={() => alert('Card clicked!')}
  />
);

export const Gallery = () => {
  const cards = [
    {
      name: 'Climate Action Now',
      location: 'Seattle, WA • Regional',
      active: true,
    },
    {
      name: 'Food Justice Collective',
      location: 'Chicago, IL • Local',
      active: false,
    },
    {
      name: 'Housing Rights Alliance',
      location: 'Los Angeles, CA • State',
      active: true,
    },
    {
      name: 'Clean Water Initiative',
      location: 'Denver, CO • National',
      active: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card, i) => {
        const gradientBg = getGradientForString(card.name);
        const gradientBgHeader = getGradientForString(card.name + 'C');

        return (
          <ProfileCard
            key={i}
            headerImage={
              <div className={cn('h-full w-full', gradientBgHeader)} />
            }
            avatarImage={<div className={cn('h-full w-full', gradientBg)} />}
            title={card.name}
            subtitle={card.location}
            badge={
              card.active ? (
                <Chip
                  size="sm"
                  color="teal"
                  className="bg-primary-teal text-white"
                >
                  Active
                </Chip>
              ) : null
            }
            href={`/org/${card.name.toLowerCase().replace(/\s+/g, '-')}`}
          />
        );
      })}
    </div>
  );
};

export const Default = {
  args: {
    headerImage: (
      <img
        src="https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=400&h=200&fit=crop"
        alt=""
        className="h-full w-full object-cover"
      />
    ),
    avatarImage: (
      <img
        src="https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=100&h=100&fit=crop"
        alt=""
        className="h-full w-full object-cover"
      />
    ),
    title: 'Solidarity Seeds',
    subtitle: 'Portland, Oregon • International',
    badge: (
      <Chip size="sm" color="teal" className="bg-primary-teal text-white">
        Active
      </Chip>
    ),
    href: '/org/solidarity-seeds',
  },
};
