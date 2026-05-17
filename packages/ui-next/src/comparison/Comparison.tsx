// 3-way migration comparison surface. Renders, for each component pair, the
// legacy RAC component from @op/ui, the @op/ui-next wrapper, and the raw
// shadcn primitive — side by side. Shared between the ui-next Storybook and
// the dev-only route in apps/app so the content stays in sync.
//
// Styling parity across columns is NOT a goal; this view is for behavior +
// API coverage during the migration. Each row is one `<Pair>`.

'use client';

// ---- OLD (@op/ui, RAC) ----
import { AlertBanner as OldAlertBanner } from '@op/ui/AlertBanner';
import { Avatar as OldAvatar } from '@op/ui/Avatar';
import {
  Breadcrumb as OldBreadcrumb,
  Breadcrumbs as OldBreadcrumbs,
} from '@op/ui/Breadcrumbs';
import { Button as OldButton } from '@op/ui/Button';
import { Checkbox as OldCheckbox } from '@op/ui/Checkbox';
import { Chip as OldChip } from '@op/ui/Chip';
import { EmptyState as OldEmptyState } from '@op/ui/EmptyState';
import {
  FooterBar as OldFooterBar,
  FooterBarCenter as OldFooterBarCenter,
  FooterBarEnd as OldFooterBarEnd,
  FooterBarStart as OldFooterBarStart,
} from '@op/ui/FooterBar';
import { Header1 as OldHeader1, Header2 as OldHeader2 } from '@op/ui/Header';
import { IconButton as OldIconButton } from '@op/ui/IconButton';
import { Link as OldLink } from '@op/ui/Link';
import { DropdownItem as OldDropdownItem } from '@op/ui/ListBox';
import { LoadingSpinner as OldLoadingSpinner } from '@op/ui/LoadingSpinner';
import {
  Menu as OldMenu,
  MenuItem as OldMenuItem,
  MenuTrigger as OldMenuTrigger,
} from '@op/ui/Menu';
import {
  Modal as OldModal,
  ModalBody as OldModalBody,
  ModalFooter as OldModalFooter,
  ModalHeader as OldModalHeader,
} from '@op/ui/Modal';
import { MultiSelectComboBox as OldMultiSelectComboBox } from '@op/ui/MultiSelectComboBox';
import { NumberField as OldNumberField } from '@op/ui/NumberField';
import { OptionMenu as OldOptionMenu } from '@op/ui/OptionMenu';
import { Pagination as OldPagination } from '@op/ui/Pagination';
import { Popover as OldPopover } from '@op/ui/Popover';
import {
  Radio as OldRadio,
  RadioGroup as OldRadioGroup,
} from '@op/ui/RadioGroup';
import { SearchField as OldSearchField } from '@op/ui/SearchField';
import { Select as OldSelect } from '@op/ui/Select';
import {
  Sheet as OldSheet,
  SheetBody as OldSheetBody,
  SheetHeader as OldSheetHeader,
} from '@op/ui/Sheet';
import { Skeleton as OldSkeleton } from '@op/ui/Skeleton';
import { StatusDot as OldStatusDot } from '@op/ui/StatusDot';
import { Surface as OldSurface } from '@op/ui/Surface';
import {
  Tab as OldTab,
  TabList as OldTabList,
  TabPanel as OldTabPanel,
  Tabs as OldTabs,
} from '@op/ui/Tabs';
import { Tag as OldTag, TagGroup as OldTagGroup } from '@op/ui/TagGroup';
import { TextField as OldTextField } from '@op/ui/TextField';
import { Toast as OldToast, toast as oldToast } from '@op/ui/Toast';
import { ToggleButton as OldToggleButton } from '@op/ui/ToggleButton';
import {
  Tooltip as OldTooltip,
  TooltipTrigger as OldTooltipTrigger,
} from '@op/ui/Tooltip';
import { useId, useState, type ReactNode } from 'react';
import { LuEllipsis, LuSearch } from 'react-icons/lu';
import { toast as rawToast, Toaster as RawToaster } from 'sonner';

// ---- WRAPPER (@op/ui-next compat / re-exports) ----
import { AlertBanner as WrapAlertBanner } from '../components/AlertBanner';
import { Avatar as WrapAvatar } from '../components/Avatar';
import {
  Breadcrumb as WrapBreadcrumb,
  Breadcrumbs as WrapBreadcrumbs,
} from '../components/Breadcrumbs';
import { Button as WrapButton } from '../components/Button';
import { Checkbox as WrapCheckbox } from '../components/Checkbox';
import { Chip as WrapChip } from '../components/Chip';
import { EmptyState as WrapEmptyState } from '../components/EmptyState';
import {
  FooterBar as WrapFooterBar,
  FooterBarCenter as WrapFooterBarCenter,
  FooterBarEnd as WrapFooterBarEnd,
  FooterBarStart as WrapFooterBarStart,
} from '../components/FooterBar';
import {
  Header1 as WrapHeader1,
  Header2 as WrapHeader2,
} from '../components/Header';
import { IconButton as WrapIconButton } from '../components/IconButton';
import { Input as WrapInput } from '../components/Input';
import { Link as WrapLink } from '../components/Link';
import { LoadingSpinner as WrapLoadingSpinner } from '../components/LoadingSpinner';
import {
  DropdownMenu as WrapDropdownMenu,
  DropdownMenuContent as WrapDropdownMenuContent,
  DropdownMenuItem as WrapDropdownMenuItem,
  DropdownMenuTrigger as WrapDropdownMenuTrigger,
} from '../components/Menu';
import {
  Modal as WrapModal,
  ModalBody as WrapModalBody,
  ModalFooter as WrapModalFooter,
  ModalHeader as WrapModalHeader,
} from '../components/Modal';
import { MultiSelectComboBox as WrapMultiSelectComboBox } from '../components/MultiSelectComboBox';
import { NumberField as WrapNumberField } from '../components/NumberField';
import { OptionMenu as WrapOptionMenu } from '../components/OptionMenu';
import { Pagination as WrapPagination } from '../components/Pagination';
import {
  RadioGroup as WrapRadioGroup,
  RadioGroupItem as WrapRadioGroupItem,
} from '../components/RadioGroup';
import { SearchField as WrapSearchField } from '../components/SearchField';
import { Select as WrapSelect } from '../components/Select';
import {
  Sheet as WrapSheet,
  SheetBody as WrapSheetBody,
  SheetHeader as WrapSheetHeader,
  SheetTrigger as WrapSheetTrigger,
} from '../components/Sheet';
import { Skeleton as WrapSkeleton } from '../components/Skeleton';
import { StatusDot as WrapStatusDot } from '../components/StatusDot';
import { Surface as WrapSurface } from '../components/Surface';
import { Tabs as WrapTabs } from '../components/Tabs';
import {
  Tag as WrapTag,
  TagGroup as WrapTagGroup,
} from '../components/TagGroup';
import { Toast as WrapToast, toast as wrapToast } from '../components/Toast';
import { ToggleButton as WrapToggleButton } from '../components/ToggleButton';
import {
  Tooltip as WrapTooltip,
  TooltipTrigger as WrapTooltipTrigger,
} from '../components/Tooltip';
// ---- RAW (vanilla shadcn primitives) ----
import {
  Alert as RawAlert,
  AlertTitle as RawAlertTitle,
} from '../components/ui/alert';
import {
  Avatar as RawAvatar,
  AvatarFallback as RawAvatarFallback,
} from '../components/ui/avatar';
import { Badge as RawBadge } from '../components/ui/badge';
import {
  Breadcrumb as RawBreadcrumb,
  BreadcrumbItem as RawBreadcrumbItem,
  BreadcrumbLink as RawBreadcrumbLink,
  BreadcrumbList as RawBreadcrumbList,
  BreadcrumbPage as RawBreadcrumbPage,
  BreadcrumbSeparator as RawBreadcrumbSeparator,
} from '../components/ui/breadcrumb';
import { Button as RawButton } from '../components/ui/button';
import {
  Card as RawCard,
  CardContent as RawCardContent,
  CardHeader as RawCardHeader,
  CardTitle as RawCardTitle,
} from '../components/ui/card';
import { Checkbox as RawCheckbox } from '../components/ui/checkbox';
import {
  Combobox as RawCombobox,
  ComboboxChip as RawComboboxChip,
  ComboboxChips as RawComboboxChips,
  ComboboxChipsInput as RawComboboxChipsInput,
  ComboboxContent as RawComboboxContent,
  ComboboxEmpty as RawComboboxEmpty,
  ComboboxItem as RawComboboxItem,
  ComboboxList as RawComboboxList,
} from '../components/ui/combobox';
import {
  Dialog as RawDialog,
  DialogContent as RawDialogContent,
  DialogFooter as RawDialogFooter,
  DialogHeader as RawDialogHeader,
  DialogTitle as RawDialogTitle,
  DialogTrigger as RawDialogTrigger,
} from '../components/ui/dialog';
import {
  DropdownMenu as RawDropdownMenu,
  DropdownMenuContent as RawDropdownMenuContent,
  DropdownMenuItem as RawDropdownMenuItem,
  DropdownMenuTrigger as RawDropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Input as RawInput } from '../components/ui/input';
import {
  InputGroup as RawInputGroup,
  InputGroupAddon as RawInputGroupAddon,
  InputGroupInput as RawInputGroupInput,
} from '../components/ui/input-group';
import {
  Pagination as RawPagination,
  PaginationContent as RawPaginationContent,
  PaginationItem as RawPaginationItem,
  PaginationNext as RawPaginationNext,
  PaginationPrevious as RawPaginationPrevious,
} from '../components/ui/pagination';
import {
  RadioGroup as RawRadioGroup,
  RadioGroupItem as RawRadioGroupItem,
} from '../components/ui/radio-group';
import {
  Select as RawSelect,
  SelectContent as RawSelectContent,
  SelectItem as RawSelectItem,
  SelectTrigger as RawSelectTrigger,
  SelectValue as RawSelectValue,
} from '../components/ui/select';
import {
  Sheet as RawSheet,
  SheetContent as RawSheetContent,
  SheetHeader as RawSheetHeader,
  SheetTitle as RawSheetTitle,
  SheetTrigger as RawSheetTrigger,
} from '../components/ui/sheet';
import { Skeleton as RawSkeleton } from '../components/ui/skeleton';
import { Spinner as RawSpinner } from '../components/ui/spinner';
import { Switch as RawSwitch } from '../components/ui/switch';
import {
  Tabs as RawTabs,
  TabsContent as RawTabsContent,
  TabsList as RawTabsList,
  TabsTrigger as RawTabsTrigger,
} from '../components/ui/tabs';
import {
  Tooltip as RawTooltip,
  TooltipContent as RawTooltipContent,
  TooltipProvider as RawTooltipProvider,
  TooltipTrigger as RawTooltipTrigger,
} from '../components/ui/tooltip';

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
        label="Toggle"
        old={<OldToggleSample />}
        wrapped={<WrapToggleSample />}
        raw={<RawToggleSample />}
      />
    </Section>
  );
}

export function Inline() {
  return (
    <Section title="Inline">
      <Pair
        label="Link"
        old={<OldLink href="#">Read more</OldLink>}
        wrapped={<WrapLink href="#">Read more</WrapLink>}
        raw={
          <a href="#" className="text-primary hover:underline">
            Read more
          </a>
        }
      />
      <Pair
        label="IconButton"
        old={
          <OldIconButton aria-label="Search">
            <LuSearch className="size-4" />
          </OldIconButton>
        }
        wrapped={
          <WrapIconButton aria-label="Search">
            <LuSearch className="size-4" />
          </WrapIconButton>
        }
        raw={
          <RawButton variant="ghost" size="icon" aria-label="Search">
            <LuSearch />
          </RawButton>
        }
      />
      <Pair
        label="LoadingSpinner"
        old={<OldLoadingSpinner />}
        wrapped={<WrapLoadingSpinner />}
        raw={<RawSpinner className="size-6 text-primary" />}
      />
      <Pair
        label="StatusDot"
        old={<OldStatusDot intent="success">Online</OldStatusDot>}
        wrapped={<WrapStatusDot intent="success">Online</WrapStatusDot>}
        raw={
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
            Online
          </span>
        }
      />
    </Section>
  );
}

export function Forms() {
  return (
    <Section title="Forms">
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
        label="Text (error)"
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
        label="RadioGroup"
        old={<OldRadioSample />}
        wrapped={<WrapRadioSample />}
        raw={<RawRadioSample />}
      />
      <Pair
        label="Select"
        old={<OldSelectSample />}
        wrapped={<WrapSelectSample />}
        raw={<RawSelectSample />}
      />
      <Pair
        label="NumberField"
        old={<OldNumberField label="Amount" defaultValue={42} />}
        wrapped={<WrapNumberField label="Amount" defaultValue={42} />}
        raw={<RawInput type="number" defaultValue={42} />}
      />
      <Pair
        label="SearchField"
        old={<OldSearchField placeholder="Search" />}
        wrapped={<WrapSearchField placeholder="Search" />}
        raw={<RawSearchSample />}
      />
      <Pair
        label="MultiSelect"
        old={<OldMultiSample />}
        wrapped={<WrapMultiSample />}
        raw={<RawMultiSample />}
      />
      <Pair
        label="Chip / Badge"
        old={<OldChip>Tag</OldChip>}
        wrapped={<WrapChip>Tag</WrapChip>}
        raw={<RawBadge variant="secondary">Tag</RawBadge>}
      />
      <Pair
        label="TagGroup"
        old={<OldTagSample />}
        wrapped={<WrapTagSample />}
        raw={<RawTagSample />}
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
        label="Avatar"
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

export function Structure() {
  return (
    <Section title="Structure">
      <Pair
        label="Surface / Card"
        old={<OldSurface className="p-3 text-sm">A simple surface</OldSurface>}
        wrapped={
          <WrapSurface className="p-3 text-sm">A simple surface</WrapSurface>
        }
        raw={
          <RawCard>
            <RawCardHeader>
              <RawCardTitle>Card</RawCardTitle>
            </RawCardHeader>
            <RawCardContent>A simple surface</RawCardContent>
          </RawCard>
        }
      />
      <Pair
        label="Headers"
        old={
          <div className="flex flex-col gap-1">
            <OldHeader1>Header1</OldHeader1>
            <OldHeader2>Header2</OldHeader2>
          </div>
        }
        wrapped={
          <div className="flex flex-col gap-1">
            <WrapHeader1>Header1</WrapHeader1>
            <WrapHeader2>Header2</WrapHeader2>
          </div>
        }
        raw={
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">Header1</h1>
            <h2 className="text-xl font-semibold">Header2</h2>
          </div>
        }
      />
      <Pair
        label="FooterBar"
        old={
          <OldFooterBar position="static" className="w-full">
            <OldFooterBarStart>start</OldFooterBarStart>
            <OldFooterBarCenter>center</OldFooterBarCenter>
            <OldFooterBarEnd>end</OldFooterBarEnd>
          </OldFooterBar>
        }
        wrapped={
          <WrapFooterBar position="static" className="w-full">
            <WrapFooterBarStart>start</WrapFooterBarStart>
            <WrapFooterBarCenter>center</WrapFooterBarCenter>
            <WrapFooterBarEnd>end</WrapFooterBarEnd>
          </WrapFooterBar>
        }
        raw={
          <div className="flex w-full items-center gap-4 border-t bg-white px-4 py-2 text-sm">
            <span className="flex-1">start</span>
            <span className="flex-1 text-center">center</span>
            <span className="flex-1 text-right">end</span>
          </div>
        }
      />
      <Pair
        label="EmptyState"
        old={<OldEmptyState>Nothing here</OldEmptyState>}
        wrapped={<WrapEmptyState>Nothing here</WrapEmptyState>}
        raw={
          <div className="text-muted-foreground flex min-h-40 w-full flex-col items-center justify-center gap-2 py-6">
            <span className="size-10 rounded-full bg-muted" />
            Nothing here
          </div>
        }
      />
      <Pair
        label="Breadcrumbs"
        old={
          <OldBreadcrumbs>
            <OldBreadcrumb href="#">Home</OldBreadcrumb>
            <OldBreadcrumb href="#">Library</OldBreadcrumb>
            <OldBreadcrumb>Data</OldBreadcrumb>
          </OldBreadcrumbs>
        }
        wrapped={
          <WrapBreadcrumbs>
            <WrapBreadcrumb href="#">Home</WrapBreadcrumb>
            <WrapBreadcrumb href="#">Library</WrapBreadcrumb>
            <WrapBreadcrumb>Data</WrapBreadcrumb>
          </WrapBreadcrumbs>
        }
        raw={
          <RawBreadcrumb>
            <RawBreadcrumbList>
              <RawBreadcrumbItem>
                <RawBreadcrumbLink href="#">Home</RawBreadcrumbLink>
              </RawBreadcrumbItem>
              <RawBreadcrumbSeparator />
              <RawBreadcrumbItem>
                <RawBreadcrumbLink href="#">Library</RawBreadcrumbLink>
              </RawBreadcrumbItem>
              <RawBreadcrumbSeparator />
              <RawBreadcrumbItem>
                <RawBreadcrumbPage>Data</RawBreadcrumbPage>
              </RawBreadcrumbItem>
            </RawBreadcrumbList>
          </RawBreadcrumb>
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
      <Pair
        label="Pagination"
        old={<OldPaginationSample />}
        wrapped={<WrapPaginationSample />}
        raw={<RawPaginationSample />}
      />
    </Section>
  );
}

export function Overlays() {
  return (
    <Section title="Overlays">
      <Pair
        label="Modal"
        old={<OldModalSample />}
        wrapped={<WrapModalSample />}
        raw={<RawModalSample />}
      />
      <Pair
        label="Sheet"
        old={<OldSheetSample />}
        wrapped={<WrapSheetSample />}
        raw={<RawSheetSample />}
      />
      <Pair
        label="Menu"
        old={<OldMenuSample />}
        wrapped={<WrapMenuSample />}
        raw={<RawMenuSample />}
      />
      <Pair
        label="OptionMenu"
        old={<OldOptionMenuSample />}
        wrapped={<WrapOptionMenuSample />}
        raw={<RawOptionMenuSample />}
      />
      <Pair
        label="Tooltip"
        old={<OldTooltipSample />}
        wrapped={<WrapTooltipSample />}
        raw={<RawTooltipSample />}
      />
      <Pair
        label="Toast"
        old={
          <OldButton
            color="secondary"
            onPress={() => oldToast.success({ title: 'Saved' })}
          >
            Fire toast
          </OldButton>
        }
        wrapped={
          <WrapButton
            color="secondary"
            onPress={() => wrapToast.success({ title: 'Saved' })}
          >
            Fire toast
          </WrapButton>
        }
        raw={
          <RawButton
            variant="outline"
            onClick={() => rawToast.success('Saved')}
          >
            Fire toast
          </RawButton>
        }
      />
      <ToastMounts />
    </Section>
  );
}

export function ComparisonGrid() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <Buttons />
      <Inline />
      <Forms />
      <Feedback />
      <Media />
      <Structure />
      <Navigation />
      <Overlays />
    </div>
  );
}

// ---------- interactive samples ----------

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

function OldRadioSample() {
  return (
    <OldRadioGroup label="Plan" defaultValue="pro">
      <OldRadio value="free">Free</OldRadio>
      <OldRadio value="pro">Pro</OldRadio>
    </OldRadioGroup>
  );
}

function WrapRadioSample() {
  const idA = useId();
  const idB = useId();
  return (
    <WrapRadioGroup defaultValue="pro" className="flex flex-col gap-1">
      <label htmlFor={idA} className="flex items-center gap-2 text-sm">
        <WrapRadioGroupItem id={idA} value="free" />
        Free
      </label>
      <label htmlFor={idB} className="flex items-center gap-2 text-sm">
        <WrapRadioGroupItem id={idB} value="pro" />
        Pro
      </label>
    </WrapRadioGroup>
  );
}

function RawRadioSample() {
  const idA = useId();
  const idB = useId();
  return (
    <RawRadioGroup defaultValue="pro" className="flex flex-col gap-1">
      <label htmlFor={idA} className="flex items-center gap-2 text-sm">
        <RawRadioGroupItem id={idA} value="free" />
        Free
      </label>
      <label htmlFor={idB} className="flex items-center gap-2 text-sm">
        <RawRadioGroupItem id={idB} value="pro" />
        Pro
      </label>
    </RawRadioGroup>
  );
}

const SELECT_ITEMS = [
  { id: 'free', label: 'Free' },
  { id: 'pro', label: 'Pro' },
  { id: 'enterprise', label: 'Enterprise' },
];

function OldSelectSample() {
  return (
    <OldSelect label="Plan" items={SELECT_ITEMS} placeholder="Pick one">
      {(item) => <OldDropdownItem id={item.id}>{item.label}</OldDropdownItem>}
    </OldSelect>
  );
}

function WrapSelectSample() {
  return (
    <WrapSelect label="Plan" placeholder="Pick one">
      {SELECT_ITEMS.map((item) => (
        <RawSelectItem key={item.id} value={item.id}>
          {item.label}
        </RawSelectItem>
      ))}
    </WrapSelect>
  );
}

function RawSelectSample() {
  return (
    <RawSelect>
      <RawSelectTrigger className="w-40">
        <RawSelectValue placeholder="Pick one" />
      </RawSelectTrigger>
      <RawSelectContent>
        {SELECT_ITEMS.map((item) => (
          <RawSelectItem key={item.id} value={item.id}>
            {item.label}
          </RawSelectItem>
        ))}
      </RawSelectContent>
    </RawSelect>
  );
}

function RawSearchSample() {
  return (
    <RawInputGroup>
      <RawInputGroupAddon>
        <LuSearch />
      </RawInputGroupAddon>
      <RawInputGroupInput placeholder="Search" />
    </RawInputGroup>
  );
}

const MULTI_OPTIONS = [
  { id: 'apple', label: 'Apple' },
  { id: 'banana', label: 'Banana' },
  { id: 'cherry', label: 'Cherry' },
];

function OldMultiSample() {
  const [value, setValue] = useState<typeof MULTI_OPTIONS>([]);
  return (
    <OldMultiSelectComboBox
      label="Fruits"
      items={MULTI_OPTIONS}
      value={value}
      onChange={setValue}
    />
  );
}

function WrapMultiSample() {
  const [value, setValue] = useState<typeof MULTI_OPTIONS>([]);
  return (
    <WrapMultiSelectComboBox
      label="Fruits"
      items={MULTI_OPTIONS}
      value={value}
      onChange={setValue}
    />
  );
}

function RawMultiSample() {
  const [value, setValue] = useState<typeof MULTI_OPTIONS>([]);
  return (
    <RawCombobox
      items={MULTI_OPTIONS}
      multiple
      value={value}
      onValueChange={(v: unknown) => setValue(v as typeof MULTI_OPTIONS)}
    >
      <RawComboboxChips className="w-40">
        {value.map((opt) => (
          <RawComboboxChip key={opt.id}>{opt.label}</RawComboboxChip>
        ))}
        <RawComboboxChipsInput placeholder="Pick" />
      </RawComboboxChips>
      <RawComboboxContent>
        <RawComboboxList>
          {MULTI_OPTIONS.map((opt) => (
            <RawComboboxItem key={opt.id} value={opt}>
              {opt.label}
            </RawComboboxItem>
          ))}
          <RawComboboxEmpty>No results</RawComboboxEmpty>
        </RawComboboxList>
      </RawComboboxContent>
    </RawCombobox>
  );
}

function OldTagSample() {
  return (
    <OldTagGroup label="Labels">
      <OldTag>Bug</OldTag>
      <OldTag>Feature</OldTag>
    </OldTagGroup>
  );
}

function WrapTagSample() {
  return (
    <WrapTagGroup>
      <WrapTag>Bug</WrapTag>
      <WrapTag>Feature</WrapTag>
    </WrapTagGroup>
  );
}

function RawTagSample() {
  return (
    <div className="flex gap-1">
      <RawBadge variant="secondary">Bug</RawBadge>
      <RawBadge variant="secondary">Feature</RawBadge>
    </div>
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

function OldPaginationSample() {
  const [page, setPage] = useState(2);
  return (
    <OldPagination
      previous={() => setPage((p) => Math.max(1, p - 1))}
      next={() => setPage((p) => p + 1)}
      range={{ totalItems: 60, itemsPerPage: 10, page }}
    />
  );
}

function WrapPaginationSample() {
  const [page, setPage] = useState(2);
  return (
    <WrapPagination
      previous={() => setPage((p) => Math.max(1, p - 1))}
      next={() => setPage((p) => p + 1)}
      range={{ totalItems: 60, itemsPerPage: 10, page }}
    />
  );
}

function RawPaginationSample() {
  return (
    <RawPagination>
      <RawPaginationContent>
        <RawPaginationItem>
          <RawPaginationPrevious href="#" />
        </RawPaginationItem>
        <RawPaginationItem>
          <RawPaginationNext href="#" />
        </RawPaginationItem>
      </RawPaginationContent>
    </RawPagination>
  );
}

function OldModalSample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <OldButton onPress={() => setOpen(true)}>Open modal</OldButton>
      <OldModal isOpen={open} onOpenChange={setOpen} isDismissable>
        <OldModalHeader>Modal title</OldModalHeader>
        <OldModalBody>Modal body</OldModalBody>
        <OldModalFooter>
          <OldButton onPress={() => setOpen(false)}>Close</OldButton>
        </OldModalFooter>
      </OldModal>
    </>
  );
}

function WrapModalSample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <WrapButton onPress={() => setOpen(true)}>Open modal</WrapButton>
      <WrapModal isOpen={open} onOpenChange={setOpen} isDismissable>
        <WrapModalHeader>Modal title</WrapModalHeader>
        <WrapModalBody>Modal body</WrapModalBody>
        <WrapModalFooter>
          <WrapButton onPress={() => setOpen(false)}>Close</WrapButton>
        </WrapModalFooter>
      </WrapModal>
    </>
  );
}

function RawModalSample() {
  return (
    <RawDialog>
      <RawDialogTrigger render={<RawButton>Open modal</RawButton>} />
      <RawDialogContent>
        <RawDialogHeader>
          <RawDialogTitle>Modal title</RawDialogTitle>
        </RawDialogHeader>
        <div className="text-sm">Modal body</div>
        <RawDialogFooter>
          <RawButton>Close</RawButton>
        </RawDialogFooter>
      </RawDialogContent>
    </RawDialog>
  );
}

function OldSheetSample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <OldButton onPress={() => setOpen(true)}>Open sheet</OldButton>
      <OldSheet isOpen={open} onOpenChange={setOpen} side="right">
        <OldSheetHeader onClose={() => setOpen(false)}>Sheet</OldSheetHeader>
        <OldSheetBody>Sheet body</OldSheetBody>
      </OldSheet>
    </>
  );
}

function WrapSheetSample() {
  return (
    <WrapSheet side="right">
      <WrapSheetTrigger render={<WrapButton>Open sheet</WrapButton>} />
      <WrapSheetHeader>Sheet</WrapSheetHeader>
      <WrapSheetBody>Sheet body</WrapSheetBody>
    </WrapSheet>
  );
}

function RawSheetSample() {
  return (
    <RawSheet>
      <RawSheetTrigger render={<RawButton>Open sheet</RawButton>} />
      <RawSheetContent side="right">
        <RawSheetHeader>
          <RawSheetTitle>Sheet</RawSheetTitle>
        </RawSheetHeader>
        <div className="p-4 text-sm">Sheet body</div>
      </RawSheetContent>
    </RawSheet>
  );
}

function OldMenuSample() {
  return (
    <OldMenuTrigger>
      <OldButton color="secondary">Open menu</OldButton>
      <OldPopover>
        <OldMenu>
          <OldMenuItem>Action one</OldMenuItem>
          <OldMenuItem>Action two</OldMenuItem>
        </OldMenu>
      </OldPopover>
    </OldMenuTrigger>
  );
}

function WrapMenuSample() {
  return (
    <WrapDropdownMenu>
      <WrapDropdownMenuTrigger
        render={<WrapButton color="secondary">Open menu</WrapButton>}
      />
      <WrapDropdownMenuContent>
        <WrapDropdownMenuItem>Action one</WrapDropdownMenuItem>
        <WrapDropdownMenuItem>Action two</WrapDropdownMenuItem>
      </WrapDropdownMenuContent>
    </WrapDropdownMenu>
  );
}

function RawMenuSample() {
  return (
    <RawDropdownMenu>
      <RawDropdownMenuTrigger
        render={<RawButton variant="outline">Open menu</RawButton>}
      />
      <RawDropdownMenuContent>
        <RawDropdownMenuItem>Action one</RawDropdownMenuItem>
        <RawDropdownMenuItem>Action two</RawDropdownMenuItem>
      </RawDropdownMenuContent>
    </RawDropdownMenu>
  );
}

function OldOptionMenuSample() {
  return (
    <OldOptionMenu aria-label="Row actions">
      <OldMenu>
        <OldMenuItem>Edit</OldMenuItem>
        <OldMenuItem>Delete</OldMenuItem>
      </OldMenu>
    </OldOptionMenu>
  );
}

function WrapOptionMenuSample() {
  return (
    <WrapOptionMenu aria-label="Row actions">
      <WrapDropdownMenuItem>Edit</WrapDropdownMenuItem>
      <WrapDropdownMenuItem>Delete</WrapDropdownMenuItem>
    </WrapOptionMenu>
  );
}

function RawOptionMenuSample() {
  return (
    <RawDropdownMenu>
      <RawDropdownMenuTrigger
        render={
          <RawButton variant="ghost" size="icon" aria-label="Row actions">
            <LuEllipsis />
          </RawButton>
        }
      />
      <RawDropdownMenuContent align="end">
        <RawDropdownMenuItem>Edit</RawDropdownMenuItem>
        <RawDropdownMenuItem>Delete</RawDropdownMenuItem>
      </RawDropdownMenuContent>
    </RawDropdownMenu>
  );
}

function OldTooltipSample() {
  return (
    <OldTooltipTrigger>
      <OldButton color="secondary">Hover me</OldButton>
      <OldTooltip>Tooltip text</OldTooltip>
    </OldTooltipTrigger>
  );
}

function WrapTooltipSample() {
  return (
    <WrapTooltipTrigger>
      <WrapButton color="secondary">Hover me</WrapButton>
      <WrapTooltip>Tooltip text</WrapTooltip>
    </WrapTooltipTrigger>
  );
}

function RawTooltipSample() {
  return (
    <RawTooltipProvider>
      <RawTooltip>
        <RawTooltipTrigger
          render={<RawButton variant="outline">Hover me</RawButton>}
        />
        <RawTooltipContent>Tooltip text</RawTooltipContent>
      </RawTooltip>
    </RawTooltipProvider>
  );
}

function ToastMounts() {
  // All three columns share the same sonner singleton; mount one Toaster.
  return (
    <div className="hidden">
      <OldToast />
      <WrapToast />
      <RawToaster />
    </div>
  );
}
