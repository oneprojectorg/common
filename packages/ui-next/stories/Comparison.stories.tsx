// Side-by-side comparison of @op/ui (old, RAC-based) vs @op/ui-next (new,
// shadcn-based) components. Styling parity is NOT the goal — this view is to
// eyeball API + behavioral coverage as the migration proceeds.

import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId, useState, type ReactNode } from 'react';

// ---- OLD (@op/ui, RAC) ----
import { AlertBanner as OldAlertBanner } from '@op/ui/AlertBanner';
import { Avatar as OldAvatar } from '@op/ui/Avatar';
import { Button as OldButton } from '@op/ui/Button';
import { Checkbox as OldCheckbox } from '@op/ui/Checkbox';
import { Chip as OldChip } from '@op/ui/Chip';
import { Skeleton as OldSkeleton } from '@op/ui/Skeleton';
import { Tab as OldTab, TabList as OldTabList, TabPanel as OldTabPanel, Tabs as OldTabs } from '@op/ui/Tabs';
import { TextField as OldTextField } from '@op/ui/TextField';
import { ToggleButton as OldToggleButton } from '@op/ui/ToggleButton';

// ---- NEW (@op/ui-next, shadcn) ----
import { AlertBanner as NewAlertBanner } from '@/components/AlertBanner';
import { Avatar as NewAvatar } from '@/components/Avatar';
import { Button as NewButton } from '@/components/ui/button';
import { Checkbox as NewCheckbox } from '@/components/Checkbox';
import { Chip as NewChip } from '@/components/Chip';
import { Skeleton as NewSkeleton } from '@/components/Skeleton';
import {
  Tabs as NewTabs,
  TabsContent as NewTabsContent,
  TabsList as NewTabsList,
  TabsTrigger as NewTabsTrigger,
} from '@/components/ui/tabs';
import { Input as NewInput } from '@/components/Input';
import { ToggleButton as NewToggleButton } from '@/components/ToggleButton';

const meta: Meta = {
  title: 'Comparison/Old vs New',
  parameters: { layout: 'padded' },
};

export default meta;

type Story = StoryObj;

// ---- layout primitives ----

function Pair({
  label,
  old,
  next,
}: {
  label: string;
  old: ReactNode;
  next: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr_1fr] items-start gap-4 border-b border-neutral-200 py-4 last:border-b-0">
      <div className="pt-1 text-sm font-medium text-neutral-700">{label}</div>
      <div className="min-w-0">
        <div className="mb-2 text-[10px] tracking-wide text-neutral-500 uppercase">
          @op/ui (RAC)
        </div>
        <div className="flex flex-wrap items-center gap-3">{old}</div>
      </div>
      <div className="min-w-0">
        <div className="mb-2 text-[10px] tracking-wide text-neutral-500 uppercase">
          @op/ui-next (shadcn)
        </div>
        <div className="flex flex-wrap items-center gap-3">{next}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-base font-semibold text-neutral-900">{title}</h2>
      <div className="rounded-lg border border-neutral-200 bg-white px-4">
        {children}
      </div>
    </section>
  );
}

// ---- stories ----

export const Overview: Story = {
  render: () => (
    <div className="mx-auto max-w-5xl">
      <ButtonsBlock />
      <FieldsBlock />
      <FeedbackBlock />
      <MediaBlock />
      <NavigationBlock />
    </div>
  ),
};

export const Buttons: Story = { render: () => <ButtonsBlock /> };
export const Fields: Story = { render: () => <FieldsBlock /> };
export const Feedback: Story = { render: () => <FeedbackBlock /> };
export const Media: Story = { render: () => <MediaBlock /> };
export const Navigation: Story = { render: () => <NavigationBlock /> };

// ---- section blocks ----

function ButtonsBlock() {
  return (
    <Section title="Buttons & toggles">
      <Pair
        label="Primary"
        old={<OldButton>Save</OldButton>}
        next={<NewButton>Save</NewButton>}
      />
      <Pair
        label="Secondary"
        old={<OldButton color="secondary">Cancel</OldButton>}
        next={<NewButton variant="outline">Cancel</NewButton>}
      />
      <Pair
        label="Destructive"
        old={<OldButton color="destructive">Delete</OldButton>}
        next={<NewButton variant="destructive">Delete</NewButton>}
      />
      <Pair
        label="Disabled"
        old={<OldButton isDisabled>Disabled</OldButton>}
        next={<NewButton disabled>Disabled</NewButton>}
      />
      <Pair
        label="Loading"
        old={<OldButton isLoading>Loading</OldButton>}
        next={<NewButton disabled>Loading…</NewButton>}
      />
      <Pair
        label="Small"
        old={<OldButton size="small">Small</OldButton>}
        next={<NewButton size="sm">Small</NewButton>}
      />
      <Pair
        label="Toggle (off/on)"
        old={<OldToggleSample />}
        next={<NewToggleSample />}
      />
    </Section>
  );
}

function FieldsBlock() {
  return (
    <Section title="Fields">
      <Pair
        label="Text input"
        old={
          <OldTextField
            label="Email"
            inputProps={{ placeholder: 'you@example.com' }}
          />
        }
        next={<NewInput placeholder="you@example.com" />}
      />
      <Pair
        label="Text input (error)"
        old={
          <OldTextField
            label="Email"
            errorMessage="Required"
            inputProps={{ placeholder: 'you@example.com' }}
          />
        }
        next={<NewInput placeholder="you@example.com" color="error" />}
      />
      <Pair label="Checkbox" old={<OldCheckboxSample />} next={<NewCheckboxSample />} />
      <Pair
        label="Chip / Badge"
        old={<OldChip>Tag</OldChip>}
        next={<NewChip>Tag</NewChip>}
      />
    </Section>
  );
}

function FeedbackBlock() {
  return (
    <Section title="Feedback">
      <Pair
        label="Alert (info)"
        old={
          <OldAlertBanner intent="info" className="w-full">
            Heads up — something to know.
          </OldAlertBanner>
        }
        next={
          <NewAlertBanner intent="info" className="w-full">
            Heads up — something to know.
          </NewAlertBanner>
        }
      />
      <Pair
        label="Alert (danger)"
        old={
          <OldAlertBanner intent="danger" className="w-full">
            Something broke.
          </OldAlertBanner>
        }
        next={
          <NewAlertBanner intent="danger" className="w-full">
            Something broke.
          </NewAlertBanner>
        }
      />
      <Pair
        label="Skeleton"
        old={<OldSkeleton className="h-6 w-40" />}
        next={<NewSkeleton className="h-6 w-40" />}
      />
    </Section>
  );
}

function MediaBlock() {
  return (
    <Section title="Media">
      <Pair
        label="Avatar (initial)"
        old={<OldAvatar placeholder="Nour Malaeb" />}
        next={<NewAvatar placeholder="Nour Malaeb" />}
      />
      <Pair
        label="Avatar (large)"
        old={<OldAvatar placeholder="Nour Malaeb" size="lg" />}
        next={<NewAvatar placeholder="Nour Malaeb" size="lg" />}
      />
    </Section>
  );
}

function NavigationBlock() {
  return (
    <Section title="Navigation">
      <Pair label="Tabs" old={<OldTabsSample />} next={<NewTabsSample />} />
    </Section>
  );
}

// ---- interactive samples (need state / composition) ----

function OldToggleSample() {
  const [on, setOn] = useState(false);
  return (
    <OldToggleButton isSelected={on} onChange={setOn}>
      {on ? 'On' : 'Off'}
    </OldToggleButton>
  );
}

function NewToggleSample() {
  const [on, setOn] = useState(false);
  return (
    <NewToggleButton isSelected={on} onChange={setOn} aria-label="toggle" />
  );
}

function OldCheckboxSample() {
  return <OldCheckbox>Accept terms</OldCheckbox>;
}

function NewCheckboxSample() {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <NewCheckbox id={id} />
      Accept terms
    </label>
  );
}

function OldTabsSample() {
  return (
    <OldTabs defaultSelectedKey="a" className="w-full">
      <OldTabList aria-label="Demo tabs">
        <OldTab id="a">Account</OldTab>
        <OldTab id="b">Password</OldTab>
      </OldTabList>
      <OldTabPanel id="a" className="pt-2 text-sm">
        Account panel
      </OldTabPanel>
      <OldTabPanel id="b" className="pt-2 text-sm">
        Password panel
      </OldTabPanel>
    </OldTabs>
  );
}

function NewTabsSample() {
  return (
    <NewTabs defaultValue="a" className="w-full">
      <NewTabsList>
        <NewTabsTrigger value="a">Account</NewTabsTrigger>
        <NewTabsTrigger value="b">Password</NewTabsTrigger>
      </NewTabsList>
      <NewTabsContent value="a" className="pt-2 text-sm">
        Account panel
      </NewTabsContent>
      <NewTabsContent value="b" className="pt-2 text-sm">
        Password panel
      </NewTabsContent>
    </NewTabs>
  );
}
