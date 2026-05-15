// 3-way migration comparison surface. Renders, for each component pair, the
// legacy RAC component from @op/ui, the @op/ui-next wrapper, and the raw
// shadcn primitive — side by side. Shared between the ui-next Storybook and
// the dev-only route in apps/app so the content stays in sync.
//
// Styling parity across columns is NOT a goal; this view is for behavior +
// API coverage during the migration. Each row is one `<Pair>`.

'use client';

import { useId, useState, type ReactNode } from 'react';

// ---- OLD (@op/ui, RAC) ----
import { AlertBanner as OldAlertBanner } from '@op/ui/AlertBanner';
import { Avatar as OldAvatar } from '@op/ui/Avatar';
import { Button as OldButton } from '@op/ui/Button';
import { Checkbox as OldCheckbox } from '@op/ui/Checkbox';
import { Chip as OldChip } from '@op/ui/Chip';
import { Skeleton as OldSkeleton } from '@op/ui/Skeleton';
import {
  Tab as OldTab,
  TabList as OldTabList,
  TabPanel as OldTabPanel,
  Tabs as OldTabs,
} from '@op/ui/Tabs';
import { TextField as OldTextField } from '@op/ui/TextField';
import { ToggleButton as OldToggleButton } from '@op/ui/ToggleButton';

// ---- WRAPPER (@op/ui-next compat / re-exports) ----
import { AlertBanner as WrapAlertBanner } from '../components/AlertBanner';
import { Avatar as WrapAvatar } from '../components/Avatar';
import { Button as WrapButton } from '../components/Button';
import { Checkbox as WrapCheckbox } from '../components/Checkbox';
import { Chip as WrapChip } from '../components/Chip';
import { Input as WrapInput } from '../components/Input';
import { Skeleton as WrapSkeleton } from '../components/Skeleton';
import { Tabs as WrapTabs } from '../components/Tabs';
import { ToggleButton as WrapToggleButton } from '../components/ToggleButton';

// ---- RAW (vanilla shadcn primitives) ----
import { Alert as RawAlert, AlertTitle as RawAlertTitle } from '../components/ui/alert';
import {
  Avatar as RawAvatar,
  AvatarFallback as RawAvatarFallback,
} from '../components/ui/avatar';
import { Badge as RawBadge } from '../components/ui/badge';
import { Button as RawButton } from '../components/ui/button';
import { Checkbox as RawCheckbox } from '../components/ui/checkbox';
import { Input as RawInput } from '../components/ui/input';
import { Skeleton as RawSkeleton } from '../components/ui/skeleton';
import { Switch as RawSwitch } from '../components/ui/switch';
import {
  Tabs as RawTabs,
  TabsContent as RawTabsContent,
  TabsList as RawTabsList,
  TabsTrigger as RawTabsTrigger,
} from '../components/ui/tabs';

// ---- layout primitives ----

const COLUMN_LABELS = ['@op/ui (RAC)', '@op/ui-next', 'raw shadcn'] as const;

export function Pair({
  label,
  old,
  wrapped,
  raw,
}: {
  label: string;
  old: ReactNode;
  wrapped: ReactNode;
  raw: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr_1fr_1fr] items-start gap-4 border-b border-neutral-200 py-4 last:border-b-0">
      <div className="pt-1 text-sm font-medium text-neutral-700">{label}</div>
      {[old, wrapped, raw].map((node, i) => (
        <div key={i} className="min-w-0">
          <div className="mb-2 text-[10px] tracking-wide text-neutral-500 uppercase">
            {COLUMN_LABELS[i]}
          </div>
          <div className="flex flex-wrap items-center gap-3">{node}</div>
        </div>
      ))}
    </div>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-base font-semibold text-neutral-900">{title}</h2>
      <div className="rounded-lg border border-neutral-200 bg-white px-4">
        {children}
      </div>
    </section>
  );
}

// ---- sections ----

export function Buttons() {
  return (
    <Section title="Buttons & toggles">
      <Pair
        label="Primary"
        old={<OldButton>Save</OldButton>}
        wrapped={<WrapButton>Save</WrapButton>}
        raw={<RawButton>Save</RawButton>}
      />
      <Pair
        label="Secondary"
        old={<OldButton color="secondary">Cancel</OldButton>}
        wrapped={<WrapButton color="secondary">Cancel</WrapButton>}
        raw={<RawButton variant="outline">Cancel</RawButton>}
      />
      <Pair
        label="Destructive"
        old={<OldButton color="destructive">Delete</OldButton>}
        wrapped={<WrapButton color="destructive">Delete</WrapButton>}
        raw={<RawButton variant="destructive">Delete</RawButton>}
      />
      <Pair
        label="Disabled"
        old={<OldButton isDisabled>Disabled</OldButton>}
        wrapped={<WrapButton isDisabled>Disabled</WrapButton>}
        raw={<RawButton disabled>Disabled</RawButton>}
      />
      <Pair
        label="Loading"
        old={<OldButton isLoading>Loading</OldButton>}
        wrapped={<WrapButton isLoading>Loading</WrapButton>}
        raw={<RawButton disabled>Loading…</RawButton>}
      />
      <Pair
        label="Small"
        old={<OldButton size="small">Small</OldButton>}
        wrapped={<WrapButton size="small">Small</WrapButton>}
        raw={<RawButton size="sm">Small</RawButton>}
      />
      <Pair
        label="Toggle (off/on)"
        old={<OldToggleSample />}
        wrapped={<WrapToggleSample />}
        raw={<RawToggleSample />}
      />
    </Section>
  );
}

export function Fields() {
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
        wrapped={<WrapInput placeholder="you@example.com" />}
        raw={<RawInput placeholder="you@example.com" />}
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
        wrapped={<WrapInput placeholder="you@example.com" color="error" />}
        raw={<RawInput placeholder="you@example.com" aria-invalid />}
      />
      <Pair
        label="Checkbox"
        old={<OldCheckboxSample />}
        wrapped={<WrapCheckboxSample />}
        raw={<RawCheckboxSample />}
      />
      <Pair
        label="Chip / Badge"
        old={<OldChip>Tag</OldChip>}
        wrapped={<WrapChip>Tag</WrapChip>}
        raw={<RawBadge variant="secondary">Tag</RawBadge>}
      />
    </Section>
  );
}

export function Feedback() {
  return (
    <Section title="Feedback">
      <Pair
        label="Alert (info)"
        old={
          <OldAlertBanner intent="info" className="w-full">
            Heads up — something to know.
          </OldAlertBanner>
        }
        wrapped={
          <WrapAlertBanner intent="info" className="w-full">
            Heads up — something to know.
          </WrapAlertBanner>
        }
        raw={
          <RawAlert>
            <RawAlertTitle>Heads up — something to know.</RawAlertTitle>
          </RawAlert>
        }
      />
      <Pair
        label="Alert (danger)"
        old={
          <OldAlertBanner intent="danger" className="w-full">
            Something broke.
          </OldAlertBanner>
        }
        wrapped={
          <WrapAlertBanner intent="danger" className="w-full">
            Something broke.
          </WrapAlertBanner>
        }
        raw={
          <RawAlert variant="destructive">
            <RawAlertTitle>Something broke.</RawAlertTitle>
          </RawAlert>
        }
      />
      <Pair
        label="Skeleton"
        old={<OldSkeleton className="h-6 w-40" />}
        wrapped={<WrapSkeleton className="h-6 w-40" />}
        raw={<RawSkeleton className="h-6 w-40" />}
      />
    </Section>
  );
}

export function Media() {
  return (
    <Section title="Media">
      <Pair
        label="Avatar (initial)"
        old={<OldAvatar placeholder="Nour Malaeb" />}
        wrapped={<WrapAvatar placeholder="Nour Malaeb" />}
        raw={
          <RawAvatar>
            <RawAvatarFallback>NM</RawAvatarFallback>
          </RawAvatar>
        }
      />
      <Pair
        label="Avatar (large)"
        old={<OldAvatar placeholder="Nour Malaeb" size="lg" />}
        wrapped={<WrapAvatar placeholder="Nour Malaeb" size="lg" />}
        raw={
          <RawAvatar size="lg">
            <RawAvatarFallback>NM</RawAvatarFallback>
          </RawAvatar>
        }
      />
    </Section>
  );
}

export function Navigation() {
  return (
    <Section title="Navigation">
      <Pair
        label="Tabs"
        old={<OldTabsSample />}
        wrapped={<WrapTabsSample />}
        raw={<RawTabsSample />}
      />
    </Section>
  );
}

export function ComparisonGrid() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <Buttons />
      <Fields />
      <Feedback />
      <Media />
      <Navigation />
    </div>
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

function WrapToggleSample() {
  const [on, setOn] = useState(false);
  return (
    <WrapToggleButton isSelected={on} onChange={setOn} aria-label="toggle" />
  );
}

function RawToggleSample() {
  const [on, setOn] = useState(false);
  return (
    <RawSwitch
      checked={on}
      onCheckedChange={(v: boolean) => setOn(v)}
      aria-label="toggle"
    />
  );
}

function OldCheckboxSample() {
  return <OldCheckbox>Accept terms</OldCheckbox>;
}

function WrapCheckboxSample() {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <WrapCheckbox id={id} />
      Accept terms
    </label>
  );
}

function RawCheckboxSample() {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <RawCheckbox id={id} />
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

function WrapTabsSample() {
  return (
    <WrapTabs defaultSelectedKey="a" className="w-full">
      <RawTabsList>
        <RawTabsTrigger value="a">Account</RawTabsTrigger>
        <RawTabsTrigger value="b">Password</RawTabsTrigger>
      </RawTabsList>
      <RawTabsContent value="a" className="pt-2 text-sm">
        Account panel
      </RawTabsContent>
      <RawTabsContent value="b" className="pt-2 text-sm">
        Password panel
      </RawTabsContent>
    </WrapTabs>
  );
}

function RawTabsSample() {
  return (
    <RawTabs defaultValue="a" className="w-full">
      <RawTabsList>
        <RawTabsTrigger value="a">Account</RawTabsTrigger>
        <RawTabsTrigger value="b">Password</RawTabsTrigger>
      </RawTabsList>
      <RawTabsContent value="a" className="pt-2 text-sm">
        Account panel
      </RawTabsContent>
      <RawTabsContent value="b" className="pt-2 text-sm">
        Password panel
      </RawTabsContent>
    </RawTabs>
  );
}
