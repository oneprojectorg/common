import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof Tabs> = {
  title: 'Sense/Primitives/Tabs',
  component: Tabs,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Tabs>;

const tabPanels = [
  {
    tab: 'Overview',
    body: 'View your key metrics and recent project activity. Track progress across all your active projects.',
    footer: 'You have 12 active projects and 3 pending tasks.',
  },
  {
    tab: 'Analytics',
    body: 'Dive into detailed analytics across sessions, conversion, and retention.',
    footer: 'Sessions are up 8% week over week.',
  },
  {
    tab: 'Reports',
    body: 'Generate and download reports to share with your team.',
    footer: '4 reports were shared this month.',
  },
  {
    tab: 'Settings',
    body: 'Manage your workspace preferences, members, and integrations.',
    footer: '2 integrations need attention.',
  },
];

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="Overview" className="w-96">
      <TabsList>
        {tabPanels.map(({ tab }) => (
          <TabsTrigger key={tab} value={tab}>
            {tab}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabPanels.map(({ tab, body, footer }) => (
        <TabsContent
          key={tab}
          value={tab}
          className="flex flex-col gap-4 rounded-lg border p-4"
        >
          <div className="flex flex-col gap-1">
            <p className="font-strong text-foreground">{tab}</p>
            <p className="text-sm text-muted-foreground">{body}</p>
          </div>
          <p className="text-sm text-muted-foreground">{footer}</p>
        </TabsContent>
      ))}
    </Tabs>
  ),
};

export const Line: Story = {
  render: () => (
    <Tabs defaultValue="Overview" className="w-96">
      <TabsList variant="line">
        {['Overview', 'Analytics', 'Reports'].map((tab) => (
          <TabsTrigger key={tab} value={tab}>
            {tab}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabPanels.slice(0, 3).map(({ tab, body }) => (
        <TabsContent key={tab} value={tab}>
          <p className="text-sm text-muted-foreground">{body}</p>
        </TabsContent>
      ))}
    </Tabs>
  ),
};

export const Vertical: Story = {
  render: () => (
    <Tabs defaultValue="Overview" orientation="vertical" className="w-[480px]">
      <TabsList>
        {tabPanels.slice(0, 3).map(({ tab }) => (
          <TabsTrigger key={tab} value={tab}>
            {tab}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabPanels.slice(0, 3).map(({ tab, body }) => (
        <TabsContent key={tab} value={tab} className="p-2">
          <p className="text-sm text-muted-foreground">{body}</p>
        </TabsContent>
      ))}
    </Tabs>
  ),
};

export const DisabledTab: Story = {
  render: () => (
    <Tabs defaultValue="Overview" className="w-96">
      <TabsList>
        <TabsTrigger value="Overview">Overview</TabsTrigger>
        <TabsTrigger value="Analytics">Analytics</TabsTrigger>
        <TabsTrigger value="Reports" disabled>
          Reports
        </TabsTrigger>
      </TabsList>
    </Tabs>
  ),
};
