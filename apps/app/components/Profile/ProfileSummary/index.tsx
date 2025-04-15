import { Header } from '@/components/Header';

export const ProfileSummary = () => {
  return (
    <div className="flex flex-col gap-4 py-2">
      <Header>Grove Hall United</Header>
      <div className="text-sm text-darkGray">Boston, MA</div>
      <div className="text-sm text-darkGray">
        <span className="font-semibold">248</span> relationships
      </div>
    </div>
  );
};
