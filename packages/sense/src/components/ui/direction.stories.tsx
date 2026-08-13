import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@op/sense/Breadcrumb';
import { Button } from '@op/sense/Button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@op/sense/Card';
import { DirectionProvider } from '@op/sense/Direction';
import { Label } from '@op/sense/Label';
import { Progress, ProgressLabel, ProgressValue } from '@op/sense/Progress';
import { Slider } from '@op/sense/Slider';
import { Switch } from '@op/sense/Switch';
import { Tabs, TabsList, TabsTrigger } from '@op/sense/Tabs';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof DirectionProvider> = {
  title: 'Primitives/Direction',
  component: DirectionProvider,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof DirectionProvider>;

// DirectionProvider renders nothing itself — it tells Base UI components
// which direction to lay out in, while the `dir` attribute on the wrapper
// flips the CSS.
export const Default: Story = {
  render: () => (
    <DirectionPair
      render={(dir) => (
        <div className="w-80">
          <Progress value={66}>
            <ProgressLabel>
              {dir === 'ltr' ? 'Uploading files' : 'جارٍ رفع الملفات'}
            </ProgressLabel>
            <ProgressValue />
          </Progress>
        </div>
      )}
    />
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

// Full composition: the header action slot sits at the inline end, text
// aligns to the inline start, and the footer buttons mirror.
export const WithCard: Story = {
  render: () => (
    <DirectionPair
      render={(dir) => (
        <Card className="w-96">
          <CardHeader>
            <CardTitle>
              {dir === 'ltr' ? 'Community garden fund' : 'صندوق حديقة الحي'}
            </CardTitle>
            <CardDescription>
              {dir === 'ltr'
                ? 'Proposed by the Greenway circle'
                : 'مقترح من دائرة غرينواي'}
            </CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm">
                {dir === 'ltr' ? 'Follow' : 'متابعة'}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {dir === 'ltr'
              ? 'Shared garden beds, a seed library, and weekend workshops for the whole neighborhood.'
              : 'أحواض زراعة مشتركة ومكتبة بذور وورش عمل في عطلة نهاية الأسبوع لجميع سكان الحي.'}
          </CardContent>
          <CardFooter className="gap-2">
            <Button size="sm">{dir === 'ltr' ? 'Vote' : 'صوّت'}</Button>
            <Button variant="outline" size="sm">
              {dir === 'ltr' ? 'Read more' : 'اقرأ المزيد'}
            </Button>
          </CardFooter>
        </Card>
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
