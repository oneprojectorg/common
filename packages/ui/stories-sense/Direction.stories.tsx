import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@op/sense/Breadcrumb';
import { DirectionProvider } from '@op/sense/Direction';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@op/sense/InputOTP';
import { Label } from '@op/sense/Label';
import { Progress, ProgressLabel, ProgressValue } from '@op/sense/Progress';
import { Slider } from '@op/sense/Slider';
import { Switch } from '@op/sense/Switch';
import { Tabs, TabsList, TabsTrigger } from '@op/sense/Tabs';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof DirectionProvider> = {
  title: 'Sense/Direction',
  component: DirectionProvider,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof DirectionProvider>;

// DirectionProvider renders nothing itself — it tells Base UI components
// which direction to lay out in, while the `dir` attribute on the wrapper
// flips the CSS.
export const Default: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <DirectionProvider direction="ltr">
        <div dir="ltr" className="w-80">
          <Progress value={66}>
            <ProgressLabel>Uploading files</ProgressLabel>
            <ProgressValue />
          </Progress>
        </div>
      </DirectionProvider>
      <DirectionProvider direction="rtl">
        <div dir="rtl" className="w-80">
          <Progress value={66}>
            <ProgressLabel>جارٍ رفع الملفات</ProgressLabel>
            <ProgressValue />
          </Progress>
        </div>
      </DirectionProvider>
    </div>
  ),
};

// Interactive controls: the slider fills (and arrow keys travel) from the
// inline start, and the switch thumb travels the mirrored way in RTL.
export const Controls: Story = {
  render: () => (
    <DirectionPair
      render={(dir) => (
        <div className="flex w-80 flex-col gap-6">
          <Slider defaultValue={[66]} />
          <div className="flex items-center gap-2">
            <Switch id={`notifications-${dir}`} defaultChecked />
            <Label htmlFor={`notifications-${dir}`}>
              {dir === 'ltr' ? 'Notifications' : 'الإشعارات'}
            </Label>
          </div>
        </div>
      )}
    />
  ),
};

// Navigation chrome: breadcrumb separators rotate, tab order and the active
// line flow from the inline start.
export const Navigation: Story = {
  render: () => (
    <DirectionPair
      render={(dir) => (
        <div className="flex flex-col gap-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#">
                  {dir === 'ltr' ? 'Home' : 'الرئيسية'}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="#">
                  {dir === 'ltr' ? 'Decisions' : 'القرارات'}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {dir === 'ltr' ? 'Budget 2027' : 'ميزانية ٢٠٢٧'}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Tabs defaultValue="overview">
            <TabsList variant="line">
              <TabsTrigger value="overview">
                {dir === 'ltr' ? 'Overview' : 'نظرة عامة'}
              </TabsTrigger>
              <TabsTrigger value="proposals">
                {dir === 'ltr' ? 'Proposals' : 'المقترحات'}
              </TabsTrigger>
              <TabsTrigger value="votes">
                {dir === 'ltr' ? 'Votes' : 'الأصوات'}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}
    />
  ),
};

// The one-time-password input keeps its rounded outer corners and single
// 1px seams on the logical start/end in both directions.
export const OneTimePassword: Story = {
  render: () => (
    <DirectionPair
      render={() => (
        <InputOTP maxLength={6} defaultValue="123456">
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <InputOTPSlot key={index} index={index} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      )}
    />
  ),
};

// Renders the same content twice, LTR then RTL, each under its own
// DirectionProvider + `dir` wrapper.
function DirectionPair({
  render,
}: {
  render: (dir: 'ltr' | 'rtl') => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      {(['ltr', 'rtl'] as const).map((dir) => (
        <div key={dir} className="flex flex-col gap-2">
          <p className="font-mono text-xs text-muted-foreground uppercase">
            {dir}
          </p>
          <DirectionProvider direction={dir}>
            <div dir={dir}>{render(dir)}</div>
          </DirectionProvider>
        </div>
      ))}
    </div>
  );
}
