import { Header } from '@/components/Header';

export const ProfileSummary = () => {
  return (
    <div className="flex flex-col gap-4 py-2">
      <Header>Grove Hall United</Header>
      <div>Boston, MA</div>
      <div>248 relationships</div>
    </div>
  );
};
