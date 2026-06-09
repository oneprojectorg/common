import { UserProvider } from '@/utils/UserProvider';
import { getUser } from '@/utils/getUser';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const Layout = async ({ children }: { children: React.ReactNode }) => {
  const user = await getUser();

  // Public (no-session) and anonymous visitors have no account — they reach
  // this layout on public routes (e.g. public decision pages). Don't force the
  // onboarding flow on them; only a real, not-yet-onboarded account goes to
  // /start.
  if (user && !user.onboardedAt) {
    redirect('/en/start');
  }

  return <UserProvider initialUser={user}>{children}</UserProvider>;
};

export default Layout;
