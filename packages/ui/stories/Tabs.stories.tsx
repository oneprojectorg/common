import type { Meta } from '@storybook/react';

import { Tab, TabList, TabPanel, Tabs } from '../src/components/Tabs';

const meta: Meta<typeof Tabs> = {
  component: Tabs,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

export const Example = (args: any) => (
  <Tabs>
    <TabList aria-label="History">
      <Tab id="photos">Photos</Tab>
      <Tab id="videos">Videos</Tab>
      <Tab id="music">Music</Tab>
    </TabList>
    <TabPanel id="photos">Photos panel</TabPanel>
    <TabPanel id="videos">Videos panel</TabPanel>
    <TabPanel id="music">Music panel</TabPanel>
  </Tabs>
);
