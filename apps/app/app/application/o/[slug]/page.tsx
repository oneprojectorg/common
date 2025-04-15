import { Header } from '@/components/Header';
import { Button } from '@op/ui/Button';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';

const ImageHeader = () => {
  return (
    <div className="relative w-full pb-14">
      <div className="relative aspect-[4.6] w-full bg-red"></div>
      <div className="absolute bottom-0 left-4 size-28 rounded-full bg-teal" />
    </div>
  );
};

const OrganizationSummary = () => {
  return (
    <div className="flex flex-col gap-4 py-2">
      <Header>Grove Hall United</Header>
      <div>Boston, MA</div>
      <div></div>
      248 relationships
    </div>
  );
};

const OrganizationDetails = () => {
  return (
    <div className="flex w-full flex-col gap-3">
      <OrganizationSummary />
      <div>
        A community-led organization building economic democracy and collective
        ownership in Grove Hall, Boston.
      </div>
      <div className="flex gap-4">
        <Button>Contribute</Button>
        <Button color="secondary" variant="icon">
          Add relationship
        </Button>
      </div>
    </div>
  );
};

const OrganizationFeed = () => {
  return (
    <Tabs>
      <TabList>
        <Tab id="updates">Updates</Tab>
        <Tab id="about">About</Tab>
      </TabList>
      <TabPanel id="updates">
        Arma virumque cano, Troiae qui primus ab oris.
      </TabPanel>
      <TabPanel id="about">ABout content goes here!</TabPanel>
    </Tabs>
  );
};

const OrganizationPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  return (
    <div className="flex w-full flex-col gap-3">
      <ImageHeader />
      <OrganizationDetails />
      <OrganizationFeed />
    </div>
  );
};

export default OrganizationPage;
