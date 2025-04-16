import { Header3 } from '@/components/Header';
import type { Organization } from '@op/trpc/encoders';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import Link from 'next/link';
import { LuGlobe, LuMail } from 'react-icons/lu';

const ProfileFeed = () => {
  return Array.from({ length: 5 }).map((_, i) => (
    <div key={i}>Feed item {i}</div>
  ));
};

const ContactLink = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex items-center gap-1">{children}</div>;
};

const ProfileAbout = ({ profile }: { profile: Organization }) => {
  const { mission, email, website } = profile;

  return (
    <div className="flex flex-col gap-8">
      {email || website ? (
        <section className="gap flex flex-col gap-6">
          <Header3>Contact</Header3>
          <div className="flex flex-col gap-4 text-teal">
            {website ? (
              <ContactLink>
                <LuGlobe />
                <Link href={website}>{website}</Link>
              </ContactLink>
            ) : null}
            {email ? (
              <ContactLink>
                <LuMail />
                <span>info@solidarityseeds.org</span>
              </ContactLink>
            ) : null}
          </div>
        </section>
      ) : null}
      {mission ? (
        <section className="gap flex flex-col gap-6">
          <Header3>Mission Statement</Header3>
          <p>{mission}</p>
        </section>
      ) : null}
    </div>
  );
};

export const ProfileTabs = ({ profile }: { profile: Organization }) => {
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
        <ProfileAbout profile={profile} />
      </TabPanel>
    </Tabs>
  );
};
