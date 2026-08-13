import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@op/sense/Chart';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from 'recharts';

const meta: Meta<typeof ChartContainer> = {
  title: 'Primitives/Chart',
  component: ChartContainer,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof ChartContainer>;

const data = [
  { month: 'January', proposals: 186, comments: 80 },
  { month: 'February', proposals: 305, comments: 200 },
  { month: 'March', proposals: 237, comments: 120 },
  { month: 'April', proposals: 73, comments: 190 },
  { month: 'May', proposals: 209, comments: 130 },
  { month: 'June', proposals: 214, comments: 140 },
];

// `ChartConfig` is where colour and copy live. Point `color` at a `--chart-*`
// token rather than a literal — those resolve through @op/styles and follow the
// active theme, so a chart is not a hole in the design system.
const config = {
  proposals: { label: 'Proposals', color: 'var(--chart-1)' },
  comments: { label: 'Comments', color: 'var(--chart-2)' },
} satisfies ChartConfig;

export const Bars: Story = {
  render: () => (
    <ChartContainer config={config} className="h-64 w-full max-w-2xl">
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tickFormatter={(value: string) => value.slice(0, 3)}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="proposals" fill="var(--color-proposals)" radius={4} />
        <Bar dataKey="comments" fill="var(--color-comments)" radius={4} />
      </BarChart>
    </ChartContainer>
  ),
};

export const Lines: Story = {
  render: () => (
    <ChartContainer config={config} className="h-64 w-full max-w-2xl">
      <LineChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tickFormatter={(value: string) => value.slice(0, 3)}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="proposals"
          stroke="var(--color-proposals)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          dataKey="comments"
          stroke="var(--color-comments)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  ),
};

// Recharts renders an SVG a screen reader cannot read. `accessibilityLayer`
// adds keyboard navigation over the series, but it does not describe the data —
// always pair a chart with the same numbers in text or a table.
export const WithTextAlternative: Story = {
  render: () => (
    <figure className="w-full max-w-2xl">
      <ChartContainer config={config} className="h-64 w-full">
        <BarChart accessibilityLayer data={data}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="proposals" fill="var(--color-proposals)" radius={4} />
        </BarChart>
      </ChartContainer>
      <figcaption className="mt-2 text-sm text-muted-foreground">
        Proposals submitted per month, January–June: 186, 305, 237, 73, 209,
        214.
      </figcaption>
    </figure>
  ),
};
