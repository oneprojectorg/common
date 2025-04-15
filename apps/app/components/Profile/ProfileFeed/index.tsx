import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';

export const ProfileFeed = () => {
  return (
    <Tabs>
      <TabList>
        <Tab id="updates">Updates</Tab>
        <Tab id="about">About</Tab>
      </TabList>
      <TabPanel id="updates">
        Arma virumque cano, Troiae qui primus ab oris.
      </TabPanel>
      <TabPanel id="about">About content goes here!</TabPanel>
    </Tabs>
  );
};
