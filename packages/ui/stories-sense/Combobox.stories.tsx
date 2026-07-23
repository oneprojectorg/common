import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from '@op/sense/Combobox';
import { InputGroupAddon } from '@op/sense/InputGroup';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { LuGlobe } from 'react-icons/lu';

import { withSense } from './sense';

const meta: Meta<typeof Combobox> = {
  title: 'Sense/Primitives/Combobox',
  component: Combobox,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Combobox>;

const frameworks = [
  { value: 'next', label: 'Next.js' },
  { value: 'sveltekit', label: 'SvelteKit' },
  { value: 'remix', label: 'Remix' },
  { value: 'astro', label: 'Astro' },
  { value: 'nuxt', label: 'Nuxt' },
];

// The popup renders in a portal outside the `.sense` wrapper, so
// ComboboxContent re-scopes itself with `className="sense"`.
export const Default: Story = {
  render: () => (
    <Combobox items={frameworks}>
      <ComboboxInput placeholder="Pick a framework" className="w-64" />
      <ComboboxContent className="sense">
        <ComboboxList>
          <ComboboxCollection>
            {(item: (typeof frameworks)[number]) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxCollection>
          <ComboboxEmpty>No results</ComboboxEmpty>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};

export const WithIconAndClear: Story = {
  render: () => (
    <Combobox items={frameworks}>
      <ComboboxInput placeholder="Pick a framework" showClear className="w-64">
        <InputGroupAddon>
          <LuGlobe />
        </InputGroupAddon>
      </ComboboxInput>
      <ComboboxContent className="sense">
        <ComboboxList>
          <ComboboxCollection>
            {(item: (typeof frameworks)[number]) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxCollection>
          <ComboboxEmpty>No results</ComboboxEmpty>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};

export const Multiple: Story = {
  render: () => <MultipleExample />,
};

export const Disabled: Story = {
  render: () => (
    <Combobox items={frameworks}>
      <ComboboxInput placeholder="Pick a framework" disabled className="w-64" />
      <ComboboxContent className="sense">
        <ComboboxList>
          <ComboboxCollection>
            {(item: (typeof frameworks)[number]) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxCollection>
          <ComboboxEmpty>No results</ComboboxEmpty>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};

function MultipleExample() {
  const [value, setValue] = useState<typeof frameworks>([]);
  // Anchor the popup to the chips container, not the inner input; otherwise
  // the popup follows the input as chips fill the row.
  const anchor = useComboboxAnchor();

  return (
    <Combobox
      items={frameworks}
      multiple
      value={value}
      onValueChange={(next: unknown) => setValue(next as typeof frameworks)}
    >
      <ComboboxChips ref={anchor} className="w-80">
        {value.map((item) => (
          <ComboboxChip key={item.value}>{item.label}</ComboboxChip>
        ))}
        <ComboboxChipsInput placeholder="Pick frameworks" />
      </ComboboxChips>
      <ComboboxContent anchor={anchor} className="sense">
        <ComboboxList>
          <ComboboxCollection>
            {(item: (typeof frameworks)[number]) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxCollection>
          <ComboboxEmpty>No results</ComboboxEmpty>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
