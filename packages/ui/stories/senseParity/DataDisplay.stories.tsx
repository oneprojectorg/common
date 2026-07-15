import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@op/sense/Accordion';
import { Avatar, AvatarFallback, AvatarGroup } from '@op/sense/Avatar';
import { Badge } from '@op/sense/Badge';
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
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@op/sense/Carousel';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Field, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@op/sense/Item';
import { Kbd, KbdGroup } from '@op/sense/Kbd';
import { ScrollArea } from '@op/sense/ScrollArea';
import { Separator } from '@op/sense/Separator';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@op/sense/Table';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { LuArrowUpRight, LuFolder, LuTriangleAlert } from 'react-icons/lu';

import figmaAccordion from '../assets/figma/accordion.png';
import figmaAvatarGroup from '../assets/figma/avatar-group.png';
import figmaAvatar from '../assets/figma/avatar.png';
import figmaBadgeDestructive from '../assets/figma/badge-destructive.png';
import figmaBadgeNumber from '../assets/figma/badge-number.png';
import figmaBadge from '../assets/figma/badge.png';
import figmaCard from '../assets/figma/card.png';
import figmaCarousel from '../assets/figma/carousel.png';
import figmaChart from '../assets/figma/chart.png';
import figmaEmpty from '../assets/figma/empty.png';
import figmaItem from '../assets/figma/item.png';
import figmaKbd from '../assets/figma/kbd.png';
import figmaScrollArea from '../assets/figma/scroll-area.png';
import figmaSeparator from '../assets/figma/separator.png';
import figmaTable from '../assets/figma/table.png';
import { ParityGridHeader, ParityRow, withDesignScale } from './Parity';

// Figma parity for the data display family. See Parity.tsx for the
// conventions. Mocks come from each Figma page's Playground frame (first
// example, Light theme) and the live column mirrors that example's content.

const meta: Meta = {
  title: 'Sense Comparison/Figma Parity/Data display',
  parameters: { layout: 'fullscreen' },
  decorators: [withDesignScale],
};

export default meta;

type Story = StoryObj;

export const DataDisplay: Story = {
  name: 'Data display',
  render: () => (
    <div className="flex flex-col gap-10 p-8">
      <ParityGridHeader />

      <ParityRow label="Table" img={figmaTable} imgWidth={845}>
        <Table>
          <TableCaption>A list of your recent invoices.</TableCaption>
          <TableHeader>
            <TableRow>
              {[1, 2, 3, 4].map((n) => (
                <TableHead key={n}>Head Text</TableHead>
              ))}
              <TableHead className="text-right">Head Text</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3].map((row) => (
              <TableRow key={row}>
                {[1, 2, 3, 4].map((n) => (
                  <TableCell key={n}>Table Cell Text</TableCell>
                ))}
                <TableCell className="text-right">Table Cell Text</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4}>Total</TableCell>
              <TableCell className="text-right">$1,110.00</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </ParityRow>

      <ParityRow label="Card" img={figmaCard} imgWidth={388}>
        <Card className="w-[388px]">
          <CardHeader>
            <CardTitle>Login to your account</CardTitle>
            <CardDescription>
              Enter your email below to login to your account.
            </CardDescription>
            <CardAction>
              <Button variant="link">Sign up</Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              <Field>
                <FieldLabel htmlFor="parity-card-email">Email</FieldLabel>
                <Input
                  id="parity-card-email"
                  type="email"
                  placeholder="m@example.com"
                />
              </Field>
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="parity-card-password">
                    Password
                  </FieldLabel>
                  <a
                    href="#"
                    className="text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input
                  id="parity-card-password"
                  type="password"
                  placeholder="Placeholder"
                />
              </Field>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <Button className="w-full">Login</Button>
            <Button variant="outline" className="w-full">
              Login with Google
            </Button>
          </CardFooter>
        </Card>
      </ParityRow>

      <ParityRow label="Badge" img={figmaBadge} imgWidth={50}>
        <Badge>Badge</Badge>
      </ParityRow>

      <ParityRow
        label="Badge, destructive with icon"
        img={figmaBadgeDestructive}
        imgWidth={58}
      >
        <Badge variant="destructive">
          {/* Figma badge icons: destructive-red stroke at 1.25/12px (= 2.5 in
              the 24px viewBox) */}
          <LuTriangleAlert className="text-destructive" strokeWidth={2.5} />
          Alert
        </Badge>
      </ParityRow>

      <ParityRow label="Badge, count" img={figmaBadgeNumber} imgWidth={20}>
        <Badge className="min-w-5 rounded-full px-1">8</Badge>
      </ParityRow>

      <ParityRow label="Avatar" img={figmaAvatar} imgWidth={32}>
        <Avatar>
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
      </ParityRow>

      <ParityRow label="Avatar group" img={figmaAvatarGroup} imgWidth={80}>
        <AvatarGroup>
          {['MW', 'SD', 'CN'].map((initials) => (
            <Avatar key={initials}>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          ))}
        </AvatarGroup>
      </ParityRow>

      <ParityRow label="Accordion" img={figmaAccordion} imgWidth={480}>
        <Accordion defaultValue={['item-1']}>
          <AccordionItem value="item-1">
            <AccordionTrigger>How do I reset my password?</AccordionTrigger>
            <AccordionContent>
              Click on &lsquo;Forgot Password&rsquo; on the login page, enter
              your email address, and we&rsquo;ll send you a link to reset your
              password. The link will expire in 24 hours.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>
              Can I change my subscription plan?
            </AccordionTrigger>
            <AccordionContent>
              Yes, you can change your plan at any time from your account
              settings.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>
              What payment methods do you accept?
            </AccordionTrigger>
            <AccordionContent>
              We accept all major credit cards and PayPal.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </ParityRow>

      <ParityRow label="Item" img={figmaItem} imgWidth={480}>
        <Item variant="outline">
          <ItemMedia variant="icon">
            <LuFolder />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Item title</ItemTitle>
            <ItemDescription>Item description goes here</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="outline">Action</Button>
          </ItemActions>
        </Item>
      </ParityRow>

      <ParityRow label="Empty" img={figmaEmpty} imgWidth={308}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LuFolder />
            </EmptyMedia>
            <EmptyTitle>No Projects Yet</EmptyTitle>
            <EmptyDescription>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit interdum
              hendrerit ex vitae sodales.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex gap-2">
              <Button>Create Project</Button>
              <Button variant="outline">Import Project</Button>
            </div>
            <Button variant="link">
              Learn More <LuArrowUpRight />
            </Button>
          </EmptyContent>
        </Empty>
      </ParityRow>

      <ParityRow label="Kbd" img={figmaKbd} imgWidth={63}>
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <span className="text-xs text-muted-foreground">+</span>
          <Kbd>B</Kbd>
        </KbdGroup>
      </ParityRow>

      <ParityRow label="Separator" img={figmaSeparator} imgWidth={320}>
        <div className="flex w-80 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-strong">shadcn/ui</p>
            <p className="text-sm text-muted-foreground">
              The Foundation for your Design System
            </p>
          </div>
          <Separator />
          <p className="text-sm">
            A set of beautifully designed components that you can customize,
            extend, and build on.
          </p>
        </div>
      </ParityRow>

      <ParityRow label="Carousel" img={figmaCarousel} imgWidth={408}>
        <CarouselWithCounter />
      </ParityRow>

      <ParityRow label="Scroll area" img={figmaScrollArea} imgWidth={192}>
        <ScrollArea className="h-72 w-48 rounded-lg border border-border bg-background">
          <div className="p-4">
            <p className="pb-4 text-sm font-strong">Tags</p>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i}>
                <p className="text-sm">v1.2.0-beta.{50 - i}</p>
                {i < 11 && <Separator className="my-2" />}
              </div>
            ))}
          </div>
        </ScrollArea>
      </ParityRow>

      {/* Last: the mock is a very tall reference sheet. */}
      <ParityRow label="Chart" img={figmaChart} imgWidth={512}>
        <p className="text-sm text-muted-foreground">
          Mock-only reference — a live chart needs recharts data scaffolding;
          see the chart.tsx tooltip/grid restyle for the code-side changes.
        </p>
      </ParityRow>
    </div>
  ),
};

function CarouselWithCounter() {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(1);

  useEffect(() => {
    if (!api) {
      return;
    }
    const onSelect = () => setCurrent(api.selectedScrollSnap() + 1);
    onSelect();
    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api]);

  return (
    <div className="mx-12 w-80">
      <Carousel setApi={setApi}>
        <CarouselContent>
          {[1, 2, 3, 4, 5].map((n) => (
            <CarouselItem key={n}>
              <div className="flex aspect-square items-center justify-center rounded-xl border border-border bg-muted text-title">
                {n}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
      <p className="pt-3 text-center text-sm text-muted-foreground">
        Slide {current} of 5
      </p>
    </div>
  );
}
