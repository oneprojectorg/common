import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@op/sense/Accordion';
import { Avatar, AvatarBadge, AvatarFallback } from '@op/sense/Avatar';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@op/sense/Card';
import {
  Carousel,
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
import {
  Item,
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@op/sense/Table';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuFolder } from 'react-icons/lu';

import figmaAccordion from '../assets/figma/accordion.png';
import figmaAvatar from '../assets/figma/avatar.png';
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
// conventions.

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
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Alex Thompson</TableCell>
              <TableCell>Designer</TableCell>
              <TableCell>Active</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Sarah Chen</TableCell>
              <TableCell>Engineer</TableCell>
              <TableCell>Active</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </ParityRow>

      <ParityRow label="Card" img={figmaCard} imgWidth={468}>
        <Card>
          <CardHeader>
            <CardTitle>Card title</CardTitle>
            <CardDescription>Card description</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-24 items-center justify-center rounded-md border border-border bg-muted text-sm text-muted-foreground">
              Content
            </div>
          </CardContent>
        </Card>
      </ParityRow>

      <ParityRow label="Badge" img={figmaBadge} imgWidth={297}>
        <div className="flex flex-wrap gap-2">
          <Badge>Badge</Badge>
          <Badge variant="secondary">Badge</Badge>
          <Badge variant="outline">Badge</Badge>
          <Badge variant="ghost">Badge</Badge>
          <Badge variant="destructive">Badge</Badge>
          <Badge variant="warning">Badge</Badge>
          <Badge variant="accent">Badge</Badge>
        </div>
      </ParityRow>

      <ParityRow label="Avatar" img={figmaAvatar} imgWidth={240}>
        <Avatar>
          <AvatarFallback>CN</AvatarFallback>
          <AvatarBadge />
        </Avatar>
      </ParityRow>

      <ParityRow label="Accordion" img={figmaAccordion} imgWidth={415}>
        <Accordion defaultValue={['item-1']}>
          <AccordionItem value="item-1">
            <AccordionTrigger>Is it accessible?</AccordionTrigger>
            <AccordionContent>
              Yes. It adheres to the WAI-ARIA design pattern.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Is it styled?</AccordionTrigger>
            <AccordionContent>
              Yes. It comes with default styles.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </ParityRow>

      <ParityRow label="Item" img={figmaItem} imgWidth={1524}>
        <Item variant="outline">
          <ItemMedia variant="icon">
            <LuFolder />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Item title</ItemTitle>
            <ItemDescription>Item description</ItemDescription>
          </ItemContent>
        </Item>
      </ParityRow>

      <ParityRow label="Empty" img={figmaEmpty} imgWidth={308}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LuFolder />
            </EmptyMedia>
            <EmptyTitle>No projects yet</EmptyTitle>
            <EmptyDescription>
              Get started by creating your first project.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button>Create project</Button>
          </EmptyContent>
        </Empty>
      </ParityRow>

      <ParityRow label="Kbd" img={figmaKbd} imgWidth={202}>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>⇧</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </ParityRow>

      <ParityRow label="Chart" img={figmaChart} imgWidth={512}>
        <p className="text-sm text-muted-foreground">
          Mock-only reference — a live chart needs recharts data scaffolding;
          see the chart.tsx tooltip/grid restyle for the code-side changes.
        </p>
      </ParityRow>

      <ParityRow label="Separator" img={figmaSeparator} imgWidth={387}>
        <div className="flex flex-col gap-4">
          <p className="text-sm">Above the separator</p>
          <Separator />
          <p className="text-sm">Below the separator</p>
        </div>
      </ParityRow>

      <ParityRow label="Carousel" img={figmaCarousel} imgWidth={504}>
        <Carousel className="mx-12">
          <CarouselContent>
            {[1, 2, 3].map((n) => (
              <CarouselItem key={n}>
                <div className="flex h-40 items-center justify-center rounded-xl border border-border text-title">
                  {n}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </ParityRow>

      <ParityRow label="Scroll area" img={figmaScrollArea} imgWidth={192}>
        <ScrollArea className="h-48 w-48 rounded-lg border border-border bg-background p-4">
          <div className="flex flex-col gap-2 text-sm">
            {Array.from({ length: 12 }, (_, i) => (
              <p key={i}>Scrollable row {i + 1}</p>
            ))}
          </div>
        </ScrollArea>
      </ParityRow>
    </div>
  ),
};
