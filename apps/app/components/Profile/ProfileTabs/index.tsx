import { Header3 } from '@/components/Header';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { LuGlobe, LuMail } from 'react-icons/lu';

export const ProfileTabs = () => {
  return (
    <Tabs className="pb-8">
      <TabList>
        <Tab id="updates">Updates</Tab>
        <Tab id="about">About</Tab>
      </TabList>
      <TabPanel id="updates">
        <ProfileFeed />
      </TabPanel>
      <TabPanel id="about">
        <ProfileAbout />
      </TabPanel>
    </Tabs>
  );
};

const ProfileFeed = () => {
  return Array.from({ length: 5 }).map((_, i) => (
    <div key={i}>Feed item {i}</div>
  ));
};

const ProfileAbout = () => {
  return (
    <div className="flex flex-col gap-8">
      <section className="gap flex flex-col gap-6">
        <Header3>Contact</Header3>
        <div className="flex flex-col gap-4 text-teal">
          <ContactLink>
            <LuGlobe />
            <span>solidarityseeds.org</span>
          </ContactLink>
          <ContactLink>
            <LuMail />
            <span>info@solidarityseeds.org</span>
          </ContactLink>
        </div>
      </section>
      <section className="gap flex flex-col gap-6">
        <Header3>Mission Statement</Header3>
        <p>
          At Solidarity Seeds, we nurture the ecosystem of economic justice
          through community-rooted organizing and regenerative food systems. We
          believe that transformative change grows from the ground up,
          connecting labor rights with environmental stewardship. Read more…
        </p>
      </section>
    </div>
  );
};

const ContactLink = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex items-center gap-1">{children}</div>;
};
