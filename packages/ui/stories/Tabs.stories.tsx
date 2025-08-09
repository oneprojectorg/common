import type { Meta } from '@storybook/react';

import { Tab, TabList, TabPanel, Tabs } from '../src/components/Tabs';

const meta: Meta<typeof Tabs> = {
  component: Tabs,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
    },
  },
};

export default meta;

export const Example = () => (
  <div className="w-full max-w-2xl space-y-8">
    <div className="space-y-4">
      <h3 className="font-medium">Default Tabs</h3>
      <Tabs>
        <TabList aria-label="History">
          <Tab id="photos">Photos</Tab>
          <Tab id="videos">Videos</Tab>
          <Tab id="music">Music</Tab>
        </TabList>
        <TabPanel id="photos">
          <div className="p-4">
            <h4 className="mb-2 font-medium">Photos Panel</h4>
            <p className="text-sm text-neutral-600">
              This is the photos content panel. You can display images,
              galleries, or photo-related content here.
            </p>
          </div>
        </TabPanel>
        <TabPanel id="videos">
          <div className="p-4">
            <h4 className="mb-2 font-medium">Videos Panel</h4>
            <p className="text-sm text-neutral-600">
              This is the videos content panel. You can display video players,
              playlists, or video-related content here.
            </p>
          </div>
        </TabPanel>
        <TabPanel id="music">
          <div className="p-4">
            <h4 className="mb-2 font-medium">Music Panel</h4>
            <p className="text-sm text-neutral-600">
              This is the music content panel. You can display audio players,
              playlists, or music-related content here.
            </p>
          </div>
        </TabPanel>
      </Tabs>
    </div>

    <div className="space-y-4">
      <h3 className="font-medium">Pill Variant</h3>
      <Tabs>
        <TabList aria-label="Settings" variant="pill">
          <Tab id="general" variant="pill">
            General
          </Tab>
          <Tab id="security" variant="pill">
            Security
          </Tab>
          <Tab id="notifications" variant="pill">
            Notifications
          </Tab>
          <Tab id="billing" variant="pill">
            Billing
          </Tab>
        </TabList>
        <TabPanel id="general">
          <div className="p-4">
            <h4 className="mb-2 font-medium">General Settings</h4>
            <p className="text-sm text-neutral-600">
              Configure your general application settings here.
            </p>
          </div>
        </TabPanel>
        <TabPanel id="security">
          <div className="p-4">
            <h4 className="mb-2 font-medium">Security Settings</h4>
            <p className="text-sm text-neutral-600">
              Manage your security preferences and authentication settings.
            </p>
          </div>
        </TabPanel>
        <TabPanel id="notifications">
          <div className="p-4">
            <h4 className="mb-2 font-medium">Notification Settings</h4>
            <p className="text-sm text-neutral-600">
              Configure how and when you receive notifications.
            </p>
          </div>
        </TabPanel>
        <TabPanel id="billing">
          <div className="p-4">
            <h4 className="mb-2 font-medium">Billing Settings</h4>
            <p className="text-sm text-neutral-600">
              Manage your subscription and billing information.
            </p>
          </div>
        </TabPanel>
      </Tabs>
    </div>

    <div className="space-y-4">
      <h3 className="font-medium">Vertical Orientation</h3>
      <Tabs orientation="vertical">
        <TabList aria-label="Vertical Navigation" orientation="vertical">
          <Tab id="dashboard">Dashboard</Tab>
          <Tab id="analytics">Analytics</Tab>
          <Tab id="reports">Reports</Tab>
          <Tab id="settings">Settings</Tab>
        </TabList>
        <TabPanel id="dashboard">
          <div className="p-4">
            <h4 className="mb-2 font-medium">Dashboard</h4>
            <p className="text-sm text-neutral-600">
              Overview of your main metrics and key performance indicators.
            </p>
          </div>
        </TabPanel>
        <TabPanel id="analytics">
          <div className="p-4">
            <h4 className="mb-2 font-medium">Analytics</h4>
            <p className="text-sm text-neutral-600">
              Detailed analytics and insights about your data.
            </p>
          </div>
        </TabPanel>
        <TabPanel id="reports">
          <div className="p-4">
            <h4 className="mb-2 font-medium">Reports</h4>
            <p className="text-sm text-neutral-600">
              Generate and view various reports and exports.
            </p>
          </div>
        </TabPanel>
        <TabPanel id="settings">
          <div className="p-4">
            <h4 className="mb-2 font-medium">Settings</h4>
            <p className="text-sm text-neutral-600">
              Configure your application preferences and options.
            </p>
          </div>
        </TabPanel>
      </Tabs>
    </div>

    <div className="space-y-4">
      <h3 className="font-medium">With Disabled Tab</h3>
      <Tabs>
        <TabList aria-label="Project Tabs">
          <Tab id="overview">Overview</Tab>
          <Tab id="files">Files</Tab>
          <Tab id="settings" isDisabled>
            Settings
          </Tab>
          <Tab id="team">Team</Tab>
        </TabList>
        <TabPanel id="overview">
          <div className="p-4">
            <h4 className="mb-2 font-medium">Project Overview</h4>
            <p className="text-sm text-neutral-600">
              Get an overview of your project status and progress.
            </p>
          </div>
        </TabPanel>
        <TabPanel id="files">
          <div className="p-4">
            <h4 className="mb-2 font-medium">Project Files</h4>
            <p className="text-sm text-neutral-600">
              View and manage all files associated with this project.
            </p>
          </div>
        </TabPanel>
        <TabPanel id="settings">
          <div className="p-4">
            <h4 className="mb-2 font-medium">Project Settings</h4>
            <p className="text-sm text-neutral-600">
              This tab is disabled and cannot be accessed.
            </p>
          </div>
        </TabPanel>
        <TabPanel id="team">
          <div className="p-4">
            <h4 className="mb-2 font-medium">Team Management</h4>
            <p className="text-sm text-neutral-600">
              Manage team members and their permissions.
            </p>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  </div>
);

export const DefaultTabs = () => (
  <Tabs>
    <TabList aria-label="History">
      <Tab id="photos">Photos</Tab>
      <Tab id="videos">Videos</Tab>
      <Tab id="music">Music</Tab>
    </TabList>
    <TabPanel id="photos">Photos panel content</TabPanel>
    <TabPanel id="videos">Videos panel content</TabPanel>
    <TabPanel id="music">Music panel content</TabPanel>
  </Tabs>
);

export const PillVariant = () => (
  <Tabs>
    <TabList aria-label="Settings" variant="pill">
      <Tab id="general" variant="pill">
        General
      </Tab>
      <Tab id="security" variant="pill">
        Security
      </Tab>
      <Tab id="notifications" variant="pill">
        Notifications
      </Tab>
    </TabList>
    <TabPanel id="general">
      <div className="p-4">General settings content</div>
    </TabPanel>
    <TabPanel id="security">
      <div className="p-4">Security settings content</div>
    </TabPanel>
    <TabPanel id="notifications">
      <div className="p-4">Notification settings content</div>
    </TabPanel>
  </Tabs>
);

export const VerticalOrientation = () => (
  <Tabs orientation="vertical">
    <TabList aria-label="Vertical Navigation" orientation="vertical">
      <Tab id="dashboard">Dashboard</Tab>
      <Tab id="analytics">Analytics</Tab>
      <Tab id="reports">Reports</Tab>
    </TabList>
    <TabPanel id="dashboard">
      <div className="p-4">Dashboard content</div>
    </TabPanel>
    <TabPanel id="analytics">
      <div className="p-4">Analytics content</div>
    </TabPanel>
    <TabPanel id="reports">
      <div className="p-4">Reports content</div>
    </TabPanel>
  </Tabs>
);

export const WithDisabledTab = () => (
  <Tabs>
    <TabList aria-label="Project Tabs">
      <Tab id="overview">Overview</Tab>
      <Tab id="files">Files</Tab>
      <Tab id="settings" isDisabled>
        Settings (Disabled)
      </Tab>
      <Tab id="team">Team</Tab>
    </TabList>
    <TabPanel id="overview">
      <div className="p-4">Project overview content</div>
    </TabPanel>
    <TabPanel id="files">
      <div className="p-4">Project files content</div>
    </TabPanel>
    <TabPanel id="settings">
      <div className="p-4">This tab is disabled</div>
    </TabPanel>
    <TabPanel id="team">
      <div className="p-4">Team management content</div>
    </TabPanel>
  </Tabs>
);

export const VerticalPillVariant = () => (
  <Tabs orientation="vertical">
    <TabList aria-label="Vertical Pills" orientation="vertical" variant="pill">
      <Tab id="profile" variant="pill">
        Profile
      </Tab>
      <Tab id="account" variant="pill">
        Account
      </Tab>
      <Tab id="preferences" variant="pill">
        Preferences
      </Tab>
    </TabList>
    <TabPanel id="profile">
      <div className="p-4">Profile settings content</div>
    </TabPanel>
    <TabPanel id="account">
      <div className="p-4">Account settings content</div>
    </TabPanel>
    <TabPanel id="preferences">
      <div className="p-4">Preferences content</div>
    </TabPanel>
  </Tabs>
);

export const ManyTabs = () => (
  <Tabs>
    <TabList aria-label="Many Tabs">
      <Tab id="tab1">Tab 1</Tab>
      <Tab id="tab2">Tab 2</Tab>
      <Tab id="tab3">Tab 3</Tab>
      <Tab id="tab4">Tab 4</Tab>
      <Tab id="tab5">Tab 5</Tab>
      <Tab id="tab6">Tab 6</Tab>
      <Tab id="tab7">Tab 7</Tab>
      <Tab id="tab8">Tab 8</Tab>
    </TabList>
    <TabPanel id="tab1">Content for tab 1</TabPanel>
    <TabPanel id="tab2">Content for tab 2</TabPanel>
    <TabPanel id="tab3">Content for tab 3</TabPanel>
    <TabPanel id="tab4">Content for tab 4</TabPanel>
    <TabPanel id="tab5">Content for tab 5</TabPanel>
    <TabPanel id="tab6">Content for tab 6</TabPanel>
    <TabPanel id="tab7">Content for tab 7</TabPanel>
    <TabPanel id="tab8">Content for tab 8</TabPanel>
  </Tabs>
);

export const UnstyledTabs = () => (
  <Tabs>
    <TabList aria-label="Unstyled Tabs">
      <Tab
        id="custom1"
        unstyled
        className="rounded-t-lg border-b-2 border-transparent bg-blue-100 px-4 py-2 text-blue-800 data-[selected]:border-blue-500 data-[selected]:bg-blue-200"
      >
        Custom 1
      </Tab>
      <Tab
        id="custom2"
        unstyled
        className="rounded-t-lg border-b-2 border-transparent bg-green-100 px-4 py-2 text-green-800 data-[selected]:border-green-500 data-[selected]:bg-green-200"
      >
        Custom 2
      </Tab>
      <Tab
        id="custom3"
        unstyled
        className="rounded-t-lg border-b-2 border-transparent bg-purple-100 px-4 py-2 text-purple-800 data-[selected]:border-purple-500 data-[selected]:bg-purple-200"
      >
        Custom 3
      </Tab>
    </TabList>
    <TabPanel id="custom1">
      <div className="rounded-b-lg bg-blue-50 p-4">Custom styled content 1</div>
    </TabPanel>
    <TabPanel id="custom2">
      <div className="rounded-b-lg bg-green-50 p-4">
        Custom styled content 2
      </div>
    </TabPanel>
    <TabPanel id="custom3">
      <div className="rounded-b-lg bg-purple-50 p-4">
        Custom styled content 3
      </div>
    </TabPanel>
  </Tabs>
);
