import { CookieBanner } from '@op/sense/CookieBanner';
import { CookieBannerLink } from '@op/sense/CookieBannerLink';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof CookieBanner> = {
  title: 'Composites/CookieBanner',
  component: CookieBanner,
  tags: ['autodocs'],
  parameters: {
    // It positions itself against the viewport, so a centred canvas would show
    // it in the wrong place.
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof CookieBanner>;

const description = (
  <>
    We use essential cookies to make Common work, and analytics cookies to
    understand how the platform is used. Read our{' '}
    <CookieBannerLink render={<a href="#privacy" />}>
      Privacy Policy
    </CookieBannerLink>{' '}
    and{' '}
    <CookieBannerLink render={<a href="#terms" />}>
      Terms of Use
    </CookieBannerLink>{' '}
    to learn more.
  </>
);

export const Default: Story = {
  render: () => (
    <div className="h-96">
      <CookieBanner
        title="Your Privacy"
        description={description}
        rejectLabel="Reject"
        acceptLabel="Accept"
        onReject={() => {}}
        onAccept={() => {}}
      />
    </div>
  ),
};

/** The app ships Arabic; the banner moves to the inline-start corner. */
export const RightToLeft: Story = {
  render: () => (
    <div className="h-96" dir="rtl">
      <CookieBanner
        title="خصوصيتك"
        description="نستخدم ملفات تعريف الارتباط الأساسية لتشغيل Common، وملفات تعريف ارتباط التحليلات لفهم كيفية استخدام المنصة."
        rejectLabel="رفض"
        acceptLabel="قبول"
        onReject={() => {}}
        onAccept={() => {}}
      />
    </div>
  ),
};
