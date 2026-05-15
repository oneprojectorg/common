import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Tab, TabList, TabPanel, Tabs } from '@/components/Tabs';

const meta: Meta = {
  title: 'shadcn/Tabs',
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[36rem]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Tabs defaultSelectedKey="updates" aria-label="Profile sections">
      <TabList>
        <Tab id="updates">Updates</Tab>
        <Tab id="relationships">Relationships</Tab>
        <Tab id="followers">Followers</Tab>
      </TabList>
      <TabPanel id="updates">Updates panel content</TabPanel>
      <TabPanel id="relationships">Relationships panel content</TabPanel>
      <TabPanel id="followers">Followers panel content</TabPanel>
    </Tabs>
  ),
};

export const Controlled: Story = {
  render: () => {
    const [key, setKey] = useState<string | number>('a');
    return (
      <Tabs
        selectedKey={key}
        onSelectionChange={setKey}
        aria-label="Controlled tabs"
      >
        <TabList>
          <Tab id="a">A</Tab>
          <Tab id="b">B</Tab>
          <Tab id="c">C</Tab>
        </TabList>
        <TabPanel id="a">Active: {String(key)}</TabPanel>
        <TabPanel id="b">Active: {String(key)}</TabPanel>
        <TabPanel id="c">Active: {String(key)}</TabPanel>
      </Tabs>
    );
  },
};

export const Pill: Story = {
  render: () => (
    <Tabs defaultSelectedKey="all" aria-label="Pill tabs">
      <TabList variant="pill">
        <Tab id="all" variant="pill">
          All
        </Tab>
        <Tab id="partners" variant="pill">
          Partners
        </Tab>
        <Tab id="funders" variant="pill">
          Funders
        </Tab>
        <Tab id="affiliates" variant="pill">
          Affiliates
        </Tab>
      </TabList>
      <TabPanel id="all">All</TabPanel>
      <TabPanel id="partners">Partners</TabPanel>
      <TabPanel id="funders">Funders</TabPanel>
      <TabPanel id="affiliates">Affiliates</TabPanel>
    </Tabs>
  ),
};

export const Vertical: Story = {
  render: () => (
    <Tabs
      orientation="vertical"
      defaultSelectedKey="one"
      aria-label="Vertical tabs"
    >
      <TabList>
        <Tab id="one">One</Tab>
        <Tab id="two">Two</Tab>
        <Tab id="three">Three</Tab>
      </TabList>
      <TabPanel id="one">One</TabPanel>
      <TabPanel id="two">Two</TabPanel>
      <TabPanel id="three">Three</TabPanel>
    </Tabs>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Tabs defaultSelectedKey="active" aria-label="Disabled tab">
      <TabList>
        <Tab id="active">Active</Tab>
        <Tab id="inactive" isDisabled>
          Disabled
        </Tab>
      </TabList>
      <TabPanel id="active">Active panel</TabPanel>
      <TabPanel id="inactive">Inactive panel</TabPanel>
    </Tabs>
  ),
};
