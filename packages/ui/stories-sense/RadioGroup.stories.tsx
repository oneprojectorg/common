import { Label } from '@op/sense/Label';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof RadioGroup> = {
  title: 'Sense/Primitives/RadioGroup',
  component: RadioGroup,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof RadioGroup>;

const plans = [
  ['starter', 'Starter Plan', 'Perfect for small businesses.'],
  ['pro', 'Pro Plan', 'Advanced features with more storage.'],
  ['enterprise', 'Enterprise Plan', 'For large teams.'],
];

export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="comfortable" className="max-w-sm">
      {[
        ['default', 'Default'],
        ['comfortable', 'Comfortable'],
        ['compact', 'Compact'],
      ].map(([value, label]) => (
        <div key={value} className="flex items-center gap-2">
          <RadioGroupItem value={value} id={`radio-${value}`} />
          <Label htmlFor={`radio-${value}`}>{label}</Label>
        </div>
      ))}
    </RadioGroup>
  ),
};

export const WithDescriptions: Story = {
  render: () => (
    <RadioGroup defaultValue="starter" className="max-w-sm gap-3">
      {plans.map(([value, title, description]) => (
        <div key={value} className="flex items-start gap-2">
          <RadioGroupItem value={value} id={`radio-plan-${value}`} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`radio-plan-${value}`}>{title}</Label>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      ))}
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup defaultValue="starter" disabled className="max-w-sm">
      {plans.map(([value, title]) => (
        <div key={value} className="flex items-center gap-2">
          <RadioGroupItem value={value} id={`radio-disabled-${value}`} />
          <Label htmlFor={`radio-disabled-${value}`}>{title}</Label>
        </div>
      ))}
    </RadioGroup>
  ),
};

export const Invalid: Story = {
  render: () => (
    <RadioGroup className="max-w-sm">
      {plans.map(([value, title]) => (
        <div key={value} className="flex items-center gap-2">
          <RadioGroupItem
            value={value}
            id={`radio-invalid-${value}`}
            aria-invalid="true"
          />
          <Label htmlFor={`radio-invalid-${value}`}>{title}</Label>
        </div>
      ))}
    </RadioGroup>
  ),
};
