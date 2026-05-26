// Migration before/after surface. Two columns per row: the legacy RAC
// component from @op/ui (BEFORE) and the vanilla shadcn primitive from
// @op/sense (AFTER). Shared between the @op/ui Storybook and the dev-only
// route in apps/app so the content stays in sync.
//
// Styling parity across columns is NOT a goal; this view is for behavior +
// API coverage during the phase-2 consumer migration. Each row is one
// `<Pair>`.

'use client';

// New sense composites + primitives used by additional Pair / Gain rows.
import { AutoSizeInput as RawAutoSizeInput } from '@op/sense/AutoSizeInput';
import { Avatar as RawSenseAvatar } from '@op/sense/Avatar';
import { AvatarUploader as RawAvatarUploader } from '@op/sense/AvatarUploader';
import { BannerUploader as RawBannerUploader } from '@op/sense/BannerUploader';
import { CollapsibleConfigCard as RawCollapsibleConfigCard } from '@op/sense/CollapsibleConfigCard';
import { CommentButton as RawCommentButton } from '@op/sense/CommentButton';
import { DatePicker as RawDatePicker } from '@op/sense/DatePicker';
import { FacePile as RawFacePile } from '@op/sense/FacePile';
import { FileDropZone as RawFileDropZone } from '@op/sense/FileDropZone';
import { Form as RawForm } from '@op/sense/Form';
import { Header1 as RawHeader1, Header2 as RawHeader2 } from '@op/sense/Header';
import { HorizontalList as RawHorizontalList } from '@op/sense/HorizontalList';
import { LogoLoop as RawLogoLoop } from '@op/sense/LogoLoop';
import { MediaDisplay as RawMediaDisplay } from '@op/sense/MediaDisplay';
import {
  NotificationPanel as RawNotificationPanel,
  NotificationPanelActions as RawNotificationPanelActions,
  NotificationPanelHeader as RawNotificationPanelHeader,
  NotificationPanelItem as RawNotificationPanelItem,
  NotificationPanelList as RawNotificationPanelList,
} from '@op/sense/NotificationPanel';
import {
  PhaseStepper as RawPhaseStepper,
  type Phase as RawPhase,
} from '@op/sense/PhaseStepper';
import { ProfileItem as RawProfileItem } from '@op/sense/ProfileItem';
import { ReactionsButton as RawReactionsButton } from '@op/sense/ReactionsButton';
import { RichTextEditor as RawRichTextEditor } from '@op/sense/RichTextEditor';
import {
  Sidebar as RawSidebar,
  SidebarContent as RawSidebarContent,
  SidebarFooter as RawSidebarFooter,
  SidebarGroup as RawSidebarGroup,
  SidebarGroupContent as RawSidebarGroupContent,
  SidebarGroupLabel as RawSidebarGroupLabel,
  SidebarHeader as RawSidebarHeader,
  SidebarInset as RawSidebarInset,
  SidebarMenu as RawSidebarMenu,
  SidebarMenuButton as RawSidebarMenuButton,
  SidebarMenuItem as RawSidebarMenuItem,
  SidebarProvider as RawSidebarProvider,
  SidebarTrigger as RawSidebarTrigger,
} from '@op/sense/Sidebar';
import { SocialLinks as RawSocialLinks } from '@op/sense/SocialLinks';
import { Sortable as RawSortable } from '@op/sense/Sortable';
import { SplitPane as RawSplitPane } from '@op/sense/SplitPane';
import {
  StepItem as RawStepItem,
  StepperProgressIndicator as RawStepperProgressIndicator,
} from '@op/sense/Stepper';
import {
  Table as RawTable,
  TableBody as RawTableBody,
  TableCell as RawTableCell,
  TableHead as RawTableHead,
  TableHeader as RawTableHeader,
  TableRow as RawTableRow,
} from '@op/sense/Table';
import { Textarea as RawTextarea } from '@op/sense/Textarea';
// Sonner singleton mount used by Toast pair — the comparison row uses
// sense's <Toast /> so toast.* calls render through op-themed Toaster.
import { Toast as WrapToast } from '@op/sense/Toast';
import { TranslateBanner as RawTranslateBanner } from '@op/sense/TranslateBanner';
// ---- RAW (vanilla shadcn primitives) ----
import {
  Accordion as RawAccordion,
  AccordionContent as RawAccordionContent,
  AccordionItem as RawAccordionItem,
  AccordionTrigger as RawAccordionTrigger,
} from '@op/sense/ui/accordion';
import {
  Alert as RawAlert,
  AlertTitle as RawAlertTitle,
} from '@op/sense/ui/alert';
import {
  AlertDialog as RawAlertDialog,
  AlertDialogAction as RawAlertDialogAction,
  AlertDialogCancel as RawAlertDialogCancel,
  AlertDialogContent as RawAlertDialogContent,
  AlertDialogDescription as RawAlertDialogDescription,
  AlertDialogFooter as RawAlertDialogFooter,
  AlertDialogHeader as RawAlertDialogHeader,
  AlertDialogTitle as RawAlertDialogTitle,
  AlertDialogTrigger as RawAlertDialogTrigger,
} from '@op/sense/ui/alert-dialog';
import { AspectRatio as RawAspectRatio } from '@op/sense/ui/aspect-ratio';
import {
  AvatarGroup as RawAvatarGroup,
  AvatarGroupCount as RawAvatarGroupCount,
} from '@op/sense/ui/avatar';
import { Badge as RawBadge } from '@op/sense/ui/badge';
import {
  Breadcrumb as RawBreadcrumb,
  BreadcrumbItem as RawBreadcrumbItem,
  BreadcrumbLink as RawBreadcrumbLink,
  BreadcrumbList as RawBreadcrumbList,
  BreadcrumbPage as RawBreadcrumbPage,
  BreadcrumbSeparator as RawBreadcrumbSeparator,
} from '@op/sense/ui/breadcrumb';
import { Button as RawButton } from '@op/sense/ui/button';
import { ButtonGroup as RawButtonGroup } from '@op/sense/ui/button-group';
import {
  Card as RawCard,
  CardContent as RawCardContent,
  CardHeader as RawCardHeader,
  CardTitle as RawCardTitle,
} from '@op/sense/ui/card';
import { Checkbox as RawCheckbox } from '@op/sense/ui/checkbox';
import {
  Combobox as RawCombobox,
  ComboboxChip as RawComboboxChip,
  ComboboxChips as RawComboboxChips,
  ComboboxChipsInput as RawComboboxChipsInput,
  ComboboxContent as RawComboboxContent,
  ComboboxEmpty as RawComboboxEmpty,
  ComboboxItem as RawComboboxItem,
  ComboboxList as RawComboboxList,
} from '@op/sense/ui/combobox';
import {
  ContextMenu as RawContextMenu,
  ContextMenuContent as RawContextMenuContent,
  ContextMenuItem as RawContextMenuItem,
  ContextMenuSeparator as RawContextMenuSeparator,
  ContextMenuTrigger as RawContextMenuTrigger,
} from '@op/sense/ui/context-menu';
import {
  Dialog as RawDialog,
  DialogContent as RawDialogContent,
  DialogFooter as RawDialogFooter,
  DialogHeader as RawDialogHeader,
  DialogTitle as RawDialogTitle,
  DialogTrigger as RawDialogTrigger,
} from '@op/sense/ui/dialog';
import {
  DropdownMenu as RawDropdownMenu,
  DropdownMenuContent as RawDropdownMenuContent,
  DropdownMenuItem as RawDropdownMenuItem,
  DropdownMenuTrigger as RawDropdownMenuTrigger,
} from '@op/sense/ui/dropdown-menu';
import {
  HoverCard as RawHoverCard,
  HoverCardContent as RawHoverCardContent,
  HoverCardTrigger as RawHoverCardTrigger,
} from '@op/sense/ui/hover-card';
import { Input as RawInput } from '@op/sense/ui/input';
import {
  InputGroup as RawInputGroup,
  InputGroupAddon as RawInputGroupAddon,
  InputGroupInput as RawInputGroupInput,
} from '@op/sense/ui/input-group';
import { Kbd as RawKbd } from '@op/sense/ui/kbd';
import {
  Menubar as RawMenubar,
  MenubarContent as RawMenubarContent,
  MenubarItem as RawMenubarItem,
  MenubarMenu as RawMenubarMenu,
  MenubarSeparator as RawMenubarSeparator,
  MenubarTrigger as RawMenubarTrigger,
} from '@op/sense/ui/menubar';
import { NativeSelect as RawNativeSelect } from '@op/sense/ui/native-select';
import {
  NavigationMenu as RawNavigationMenu,
  NavigationMenuContent as RawNavigationMenuContent,
  NavigationMenuItem as RawNavigationMenuItem,
  NavigationMenuLink as RawNavigationMenuLink,
  NavigationMenuList as RawNavigationMenuList,
  NavigationMenuTrigger as RawNavigationMenuTrigger,
} from '@op/sense/ui/navigation-menu';
import {
  Pagination as RawPagination,
  PaginationContent as RawPaginationContent,
  PaginationItem as RawPaginationItem,
  PaginationNext as RawPaginationNext,
  PaginationPrevious as RawPaginationPrevious,
} from '@op/sense/ui/pagination';
import {
  Popover as RawPopover,
  PopoverContent as RawPopoverContent,
  PopoverTrigger as RawPopoverTrigger,
} from '@op/sense/ui/popover';
import { Progress as RawProgress } from '@op/sense/ui/progress';
import {
  RadioGroup as RawRadioGroup,
  RadioGroupItem as RawRadioGroupItem,
} from '@op/sense/ui/radio-group';
import { ScrollArea as RawScrollArea } from '@op/sense/ui/scroll-area';
import {
  Select as RawSelect,
  SelectContent as RawSelectContent,
  SelectItem as RawSelectItem,
  SelectTrigger as RawSelectTrigger,
  SelectValue as RawSelectValue,
} from '@op/sense/ui/select';
import { Separator as RawSeparator } from '@op/sense/ui/separator';
import {
  Sheet as RawSheet,
  SheetContent as RawSheetContent,
  SheetHeader as RawSheetHeader,
  SheetTitle as RawSheetTitle,
  SheetTrigger as RawSheetTrigger,
} from '@op/sense/ui/sheet';
import { Skeleton as RawSkeleton } from '@op/sense/ui/skeleton';
import { Slider as RawSlider } from '@op/sense/ui/slider';
import { Spinner as RawSpinner } from '@op/sense/ui/spinner';
import { Switch as RawSwitch } from '@op/sense/ui/switch';
import {
  Tabs as RawTabs,
  TabsContent as RawTabsContent,
  TabsList as RawTabsList,
  TabsTrigger as RawTabsTrigger,
} from '@op/sense/ui/tabs';
import { Toggle as RawToggle } from '@op/sense/ui/toggle';
import {
  ToggleGroup as RawToggleGroup,
  ToggleGroupItem as RawToggleGroupItem,
} from '@op/sense/ui/toggle-group';
import {
  Tooltip as RawTooltip,
  TooltipContent as RawTooltipContent,
  TooltipProvider as RawTooltipProvider,
  TooltipTrigger as RawTooltipTrigger,
} from '@op/sense/ui/tooltip';
import * as React from 'react';
import { useId, useState, type ReactNode } from 'react';
import {
  LuBold,
  LuCalendar,
  LuChevronDown,
  LuEllipsis,
  LuHouse,
  LuInbox,
  LuItalic,
  LuSearch,
  LuSettings,
  LuUnderline,
} from 'react-icons/lu';
import { toast as rawToast } from 'sonner';

import { AlertBanner as OldAlertBanner } from '../components/AlertBanner';
import { AutoSizeInput as OldAutoSizeInput } from '../components/AutoSizeInput';
import { Avatar as OldAvatar } from '../components/Avatar';
import { AvatarUploader as OldAvatarUploader } from '../components/AvatarUploader';
import { BannerUploader as OldBannerUploader } from '../components/BannerUploader';
import {
  Breadcrumb as OldBreadcrumb,
  Breadcrumbs as OldBreadcrumbs,
} from '../components/Breadcrumbs';
import { Button as OldButton } from '../components/Button';
import { ButtonGroup as OldButtonGroup } from '../components/ButtonGroup';
import { Checkbox as OldCheckbox } from '../components/Checkbox';
import { Chip as OldChip } from '../components/Chip';
import { CollapsibleConfigCard as OldCollapsibleConfigCard } from '../components/CollapsibleConfigCard';
import { CommentButton as OldCommentButton } from '../components/CommentButton';
import { DatePicker as OldDatePicker } from '../components/DatePicker';
import { Dialog as OldDialog } from '../components/Dialog';
import { DropDownButton as OldDropDownButton } from '../components/DropDownButton';
import { EmptyState as OldEmptyState } from '../components/EmptyState';
import { FacePile as OldFacePile } from '../components/FacePile';
import { FileDropZone as OldFileDropZone } from '../components/FileDropZone';
import {
  FooterBar as OldFooterBar,
  FooterBarCenter as OldFooterBarCenter,
  FooterBarEnd as OldFooterBarEnd,
  FooterBarStart as OldFooterBarStart,
} from '../components/FooterBar';
import { Form as OldForm } from '../components/Form';
import {
  Header1 as OldHeader1,
  Header2 as OldHeader2,
} from '../components/Header';
import { HorizontalList as OldHorizontalList } from '../components/HorizontalList';
import { IconButton as OldIconButton } from '../components/IconButton';
import { Link as OldLink } from '../components/Link';
import { DropdownItem as OldDropdownItem } from '../components/ListBox';
import { LoadingSpinner as OldLoadingSpinner } from '../components/LoadingSpinner';
import { LogoLoop as OldLogoLoop } from '../components/LogoLoop';
import { MediaDisplay as OldMediaDisplay } from '../components/MediaDisplay';
import {
  Menu as OldMenu,
  MenuItem as OldMenuItem,
  MenuTrigger as OldMenuTrigger,
} from '../components/Menu';
import {
  Modal as OldModal,
  ModalBody as OldModalBody,
  ModalFooter as OldModalFooter,
  ModalHeader as OldModalHeader,
} from '../components/Modal';
import { MultiSelectComboBox as OldMultiSelectComboBox } from '../components/MultiSelectComboBox';
import {
  NotificationPanel as OldNotificationPanel,
  NotificationPanelActions as OldNotificationPanelActions,
  NotificationPanelHeader as OldNotificationPanelHeader,
  NotificationPanelItem as OldNotificationPanelItem,
  NotificationPanelList as OldNotificationPanelList,
} from '../components/NotificationPanel';
import { NumberField as OldNumberField } from '../components/NumberField';
import { OptionMenu as OldOptionMenu } from '../components/OptionMenu';
import { Pagination as OldPagination } from '../components/Pagination';
import {
  PhaseStepper as OldPhaseStepper,
  type Phase as OldPhase,
} from '../components/PhaseStepper';
import { Popover as OldPopover } from '../components/Popover';
import { ProfileItem as OldProfileItem } from '../components/ProfileItem';
import {
  Radio as OldRadio,
  RadioGroup as OldRadioGroup,
} from '../components/RadioGroup';
import { ReactionsButton as OldReactionsButton } from '../components/ReactionsButton';
import { RichTextEditor as OldRichTextEditor } from '../components/RichTextEditor';
import { SearchField as OldSearchField } from '../components/SearchField';
import { Select as OldSelect } from '../components/Select';
import {
  Sheet as OldSheet,
  SheetBody as OldSheetBody,
  SheetHeader as OldSheetHeader,
} from '../components/Sheet';
import {
  Sidebar as OldSidebar,
  SidebarLayout as OldSidebarLayout,
  SidebarProvider as OldSidebarProvider,
  SidebarTrigger as OldSidebarTrigger,
} from '../components/Sidebar';
import { Skeleton as OldSkeleton } from '../components/Skeleton';
import { SocialLinks as OldSocialLinks } from '../components/SocialLinks';
import { Sortable as OldSortable } from '../components/Sortable';
import { SplitPane as OldSplitPane } from '../components/SplitPane';
import { StatusDot as OldStatusDot } from '../components/StatusDot';
import {
  StepItem as OldStepItem,
  StepperProgressIndicator as OldStepperProgressIndicator,
} from '../components/Stepper';
import { Surface as OldSurface } from '../components/Surface';
import {
  Tab as OldTab,
  TabList as OldTabList,
  TabPanel as OldTabPanel,
  Tabs as OldTabs,
} from '../components/Tabs';
import { Tag as OldTag, TagGroup as OldTagGroup } from '../components/TagGroup';
import { TextField as OldTextField } from '../components/TextField';
import { toast as oldToast } from '../components/Toast';
import { ToggleButton as OldToggleButton } from '../components/ToggleButton';
import {
  Tooltip as OldTooltip,
  TooltipTrigger as OldTooltipTrigger,
} from '../components/Tooltip';
import { TranslateBanner as OldTranslateBanner } from '../components/TranslateBanner';
// ---- OLD (@op/ui, RAC) ----
import {
  Accordion as OldAccordion,
  AccordionContent as OldAccordionContent,
  AccordionHeader as OldAccordionHeader,
  AccordionItem as OldAccordionItem,
  AccordionTrigger as OldAccordionTrigger,
} from '../components/ui/accordion';
import {
  Table as OldTable,
  TableBody as OldTableBody,
  TableCell as OldTableCell,
  TableColumn as OldTableColumn,
  TableHeader as OldTableHeader,
  TableRow as OldTableRow,
} from '../components/ui/table';

// ---- layout primitives ----

const COLUMN_LABELS = ['@op/ui (before)', '@op/sense (after)'] as const;

export function Pair({
  label,
  old,
  raw,
}: {
  label: string;
  old: ReactNode;
  raw: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr_1fr] items-start gap-4 border-b border-neutral-200 py-4 last:border-b-0">
      <div className="pt-1 text-sm font-medium text-neutral-700">{label}</div>
      {[old, raw].map((node, i) => (
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

// One-column row used by NewInSense — same grid layout as Pair, but the
// "before" cell shows "no equivalent" because @op/ui doesn't ship the
// primitive.
export function Gain({ label, raw }: { label: string; raw: ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr_1fr] items-start gap-4 border-b border-neutral-200 py-4 last:border-b-0">
      <div className="pt-1 text-sm font-medium text-neutral-700">{label}</div>
      <div className="min-w-0">
        <div className="mb-2 text-[10px] tracking-wide text-neutral-500 uppercase">
          @op/ui (before)
        </div>
        <div className="text-sm text-neutral-400 italic">— no equivalent —</div>
      </div>
      <div className="min-w-0">
        <div className="mb-2 text-[10px] tracking-wide text-neutral-500 uppercase">
          @op/sense (new)
        </div>
        <div className="flex flex-wrap items-center gap-3">{raw}</div>
      </div>
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
        raw={<RawButton>Save</RawButton>}
      />
      <Pair
        label="Secondary"
        old={<OldButton color="secondary">Cancel</OldButton>}
        raw={<RawButton variant="outline">Cancel</RawButton>}
      />
      <Pair
        label="Destructive"
        old={<OldButton color="destructive">Delete</OldButton>}
        raw={<RawButton variant="destructive">Delete</RawButton>}
      />
      <Pair
        label="Disabled"
        old={<OldButton isDisabled>Disabled</OldButton>}
        raw={<RawButton disabled>Disabled</RawButton>}
      />
      <Pair
        label="Loading"
        old={<OldButton isLoading>Loading</OldButton>}
        raw={<RawButton disabled>Loading…</RawButton>}
      />
      <Pair
        label="Small"
        old={<OldButton size="small">Small</OldButton>}
        raw={<RawButton size="sm">Small</RawButton>}
      />
      <Pair
        label="Toggle"
        old={<OldToggleSample />}
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
        raw={
          <RawButton variant="ghost" size="icon" aria-label="Search">
            <LuSearch />
          </RawButton>
        }
      />
      <Pair
        label="LoadingSpinner"
        old={<OldLoadingSpinner />}
        raw={<RawSpinner className="size-6 text-primary" />}
      />
      <Pair
        label="StatusDot"
        old={<OldStatusDot intent="success">Online</OldStatusDot>}
        raw={
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
            Online
          </span>
        }
      />
      <Pair
        label="CommentButton"
        old={<OldCommentButton count={3} />}
        raw={<RawCommentButton count={3} />}
      />
      <Pair
        label="ReactionsButton"
        old={<OldReactionsSample />}
        raw={<RawReactionsSample />}
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
        raw={<RawInput placeholder="you@example.com" aria-invalid />}
      />
      <Pair
        label="Checkbox"
        old={<OldCheckboxSample />}
        raw={<RawCheckboxSample />}
      />
      <Pair
        label="RadioGroup"
        old={<OldRadioSample />}
        raw={<RawRadioSample />}
      />
      <Pair
        label="Select"
        old={<OldSelectSample />}
        raw={<RawSelectSample />}
      />
      <Pair
        label="NumberField"
        old={<OldNumberField label="Amount" defaultValue={42} />}
        raw={<RawInput type="number" defaultValue={42} />}
      />
      <Pair
        label="SearchField"
        old={<OldSearchField placeholder="Search" />}
        raw={<RawSearchSample />}
      />
      <Pair
        label="MultiSelect"
        old={<OldMultiSample />}
        raw={<RawMultiSample />}
      />
      <Pair
        label="Chip / Badge"
        old={<OldChip>Tag</OldChip>}
        raw={<RawBadge variant="secondary">Tag</RawBadge>}
      />
      <Pair label="TagGroup" old={<OldTagSample />} raw={<RawTagSample />} />
      <Pair
        label="Textarea"
        old={
          <OldTextField
            label="Notes"
            useTextArea
            textareaProps={{ placeholder: 'Write…', rows: 3 }}
          />
        }
        raw={<RawTextarea placeholder="Write…" rows={3} />}
      />
      <Pair
        label="AutoSizeInput"
        old={<OldAutoSizeSample />}
        raw={<RawAutoSizeSample />}
      />
      <Pair
        label="DatePicker"
        old={<OldDatePickerSample />}
        raw={<RawDatePickerSample />}
      />
      <Pair
        label="FileDropZone"
        old={
          <OldFileDropZone
            onSelectFiles={() => {}}
            label="Drop files here"
            className="w-72"
          />
        }
        raw={
          <RawFileDropZone
            onSelectFiles={() => {}}
            label="Drop files here"
            className="w-72"
          />
        }
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
        raw={
          <RawAlert variant="destructive">
            <RawAlertTitle>Something broke.</RawAlertTitle>
          </RawAlert>
        }
      />
      <Pair
        label="Skeleton"
        old={<OldSkeleton className="h-6 w-40" />}
        raw={<RawSkeleton className="h-6 w-40" />}
      />
      <Pair
        label="TranslateBanner"
        old={
          <OldTranslateBanner
            label="Translate to English"
            onTranslate={() => {}}
            onDismiss={() => {}}
          />
        }
        raw={
          <RawTranslateBanner
            label="Translate to English"
            onTranslate={() => {}}
            onDismiss={() => {}}
          />
        }
      />
      <Pair
        label="NotificationPanel"
        old={<OldNotificationPanelSample />}
        raw={<RawNotificationPanelSample />}
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
        raw={<RawSenseAvatar placeholder="Nour Malaeb" />}
      />
      <Pair
        label="Avatar (large)"
        old={<OldAvatar placeholder="Nour Malaeb" size="lg" />}
        raw={<RawSenseAvatar placeholder="Nour Malaeb" size="lg" />}
      />
      <Pair
        label="AvatarGroup"
        old={
          <OldFacePile
            items={GROUP_NAMES.map((name) => (
              <OldAvatar key={name} placeholder={name} />
            ))}
          />
        }
        raw={<RawAvatarGroupSample />}
      />
      <Pair
        label="FacePile (overflow)"
        old={
          <OldFacePile
            items={GROUP_NAMES.map((name) => (
              <OldAvatar key={name} placeholder={name} />
            ))}
          />
        }
        raw={
          <RawFacePile
            maxItems={3}
            items={GROUP_NAMES.map((name) => (
              <RawSenseAvatar key={name} placeholder={name} />
            ))}
          />
        }
      />
      <Pair
        label="AvatarUploader"
        old={<OldAvatarUploader label="Avatar" />}
        raw={<RawAvatarUploader label="Avatar" />}
      />
      <Pair
        label="BannerUploader"
        old={<OldBannerUploader label="Banner" />}
        raw={<RawBannerUploader label="Banner" />}
      />
      <Pair
        label="MediaDisplay"
        old={
          <OldMediaDisplay
            title="The unreasonable effectiveness of typed forms"
            description="A long-read on form invariants."
            url="https://example.com/article"
            site="example.com"
          />
        }
        raw={
          <RawMediaDisplay
            title="The unreasonable effectiveness of typed forms"
            description="A long-read on form invariants."
            url="https://example.com/article"
          />
        }
      />
      <Pair
        label="LogoLoop"
        old={<OldLogoLoopSample />}
        raw={<RawLogoLoopSample />}
      />
    </Section>
  );
}

const GROUP_NAMES = [
  'Nour Malaeb',
  'Ada Lovelace',
  'Grace Hopper',
  'Linus Torvalds',
  'Alan Turing',
];

function RawAvatarGroupSample() {
  return (
    <RawAvatarGroup>
      {GROUP_NAMES.slice(0, 3).map((name) => (
        <RawSenseAvatar key={name} placeholder={name} />
      ))}
      <RawAvatarGroupCount>+{GROUP_NAMES.length - 3}</RawAvatarGroupCount>
    </RawAvatarGroup>
  );
}

export function Structure() {
  return (
    <Section title="Structure">
      <Pair
        label="Surface / Card"
        old={<OldSurface className="p-3 text-sm">A simple surface</OldSurface>}
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
        raw={
          <div className="flex flex-col gap-1">
            <RawHeader1>Header1</RawHeader1>
            <RawHeader2>Header2</RawHeader2>
          </div>
        }
      />
      <Pair
        label="Accordion"
        old={<OldAccordionSample />}
        raw={<RawAccordionSample />}
      />
      <Pair
        label="ButtonGroup"
        old={
          <OldButtonGroup>
            <OldButton size="small">One</OldButton>
            <OldButton size="small">Two</OldButton>
            <OldButton size="small">Three</OldButton>
          </OldButtonGroup>
        }
        raw={
          <RawButtonGroup>
            <RawButton variant="outline">One</RawButton>
            <RawButton variant="outline">Two</RawButton>
            <RawButton variant="outline">Three</RawButton>
          </RawButtonGroup>
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
        raw={
          <div className="flex min-h-40 w-full flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
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
      <Pair
        label="Form (layout)"
        old={
          <OldForm className="w-60">
            <OldTextField
              label="Email"
              inputProps={{ placeholder: 'you@example.com' }}
            />
            <OldButton>Submit</OldButton>
          </OldForm>
        }
        raw={
          <RawForm className="w-60">
            <RawInput placeholder="you@example.com" />
            <RawButton>Submit</RawButton>
          </RawForm>
        }
      />
      <Pair
        label="CollapsibleConfigCard"
        old={
          <OldCollapsibleConfigCard label="Settings" defaultExpanded>
            <div className="text-sm text-neutral-600">A panel of options.</div>
          </OldCollapsibleConfigCard>
        }
        raw={
          <RawCollapsibleConfigCard label="Settings">
            <div className="text-sm text-muted-foreground">
              A panel of options.
            </div>
          </RawCollapsibleConfigCard>
        }
      />
      <Pair
        label="HorizontalList"
        old={<OldHorizontalListSample />}
        raw={<RawHorizontalListSample />}
      />
      <Pair
        label="ProfileItem"
        old={
          <OldProfileItem
            avatar={<OldAvatar placeholder="Nour Malaeb" />}
            title="Nour Malaeb"
            description="Software engineer"
          />
        }
        raw={
          <RawProfileItem
            avatar={<RawSenseAvatar placeholder="Nour Malaeb" />}
            title="Nour Malaeb"
            description="Software engineer"
          />
        }
      />
      <Pair
        label="SocialLinks"
        old={<OldSocialLinks />}
        raw={<RawSocialLinks />}
      />
    </Section>
  );
}

export function Navigation() {
  return (
    <Section title="Navigation">
      <Pair label="Tabs" old={<OldTabsSample />} raw={<RawTabsSample />} />
      <Pair
        label="Pagination"
        old={<OldPaginationSample />}
        raw={<RawPaginationSample />}
      />
      <Pair
        label="PhaseStepper"
        old={<OldPhaseStepperSample />}
        raw={<RawPhaseStepperSample />}
      />
      <Pair
        label="Stepper"
        old={<OldStepperSample />}
        raw={<RawStepperSample />}
      />
    </Section>
  );
}

export function Overlays() {
  return (
    <Section title="Overlays">
      <Pair label="Modal" old={<OldModalSample />} raw={<RawModalSample />} />
      <Pair
        label="Confetti modal"
        old={<OldConfettiModalSample />}
        raw={
          <span className="text-xs text-muted-foreground">
            n/a — no shadcn primitive
          </span>
        }
      />
      <Pair label="Sheet" old={<OldSheetSample />} raw={<RawSheetSample />} />
      <Pair label="Menu" old={<OldMenuSample />} raw={<RawMenuSample />} />
      <Pair
        label="OptionMenu"
        old={<OldOptionMenuSample />}
        raw={<RawOptionMenuSample />}
      />
      <Pair
        label="Tooltip"
        old={<OldTooltipSample />}
        raw={<RawTooltipSample />}
      />
      <Pair
        label="Popover (standalone)"
        old={<OldPopoverSample />}
        raw={<RawPopoverSample />}
      />
      <Pair
        label="Dialog (non-modal)"
        old={<OldDialogSample />}
        raw={<RawDialogStandaloneSample />}
      />
      <Pair
        label="DropDownButton"
        old={<OldDropDownButtonSample />}
        raw={<RawDropDownButtonSample />}
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

export function Heavy() {
  return (
    <Section title="Heavy composites">
      <Pair label="Table" old={<OldTableSample />} raw={<RawTableSample />} />
      <Pair
        label="RichTextEditor"
        old={<OldRichTextSample />}
        raw={<RawRichTextSample />}
      />
      <Pair
        label="Sidebar"
        old={<OldSidebarSample />}
        raw={<RawSidebarSample />}
      />
      <Pair
        label="Sortable"
        old={<OldSortableSample />}
        raw={<RawSortableSample />}
      />
      <Pair
        label="SplitPane"
        old={<OldSplitPaneSample />}
        raw={<RawSplitPaneSample />}
      />
    </Section>
  );
}

export function NewInSense() {
  return (
    <Section title="New in @op/sense (no @op/ui equivalent)">
      <Gain label="AlertDialog" raw={<AlertDialogSample />} />
      <Gain label="AspectRatio" raw={<AspectRatioSample />} />
      <Gain label="ContextMenu" raw={<ContextMenuSample />} />
      <Gain label="HoverCard" raw={<HoverCardSample />} />
      <Gain
        label="Kbd"
        raw={
          <span className="flex items-center gap-1 text-sm">
            Save with <RawKbd>⌘</RawKbd>
            <RawKbd>S</RawKbd>
          </span>
        }
      />
      <Gain label="NativeSelect" raw={<NativeSelectSample />} />
      <Gain
        label="Progress"
        raw={<RawProgress value={62} className="w-48" />}
      />
      <Gain label="ScrollArea" raw={<ScrollAreaSample />} />
      <Gain label="Slider" raw={<SliderSample />} />
      <Gain label="Toggle" raw={<ToggleSample />} />
      <Gain label="ToggleGroup" raw={<ToggleGroupSample />} />
      <Gain label="Menubar" raw={<MenubarSample />} />
      <Gain label="NavigationMenu" raw={<NavigationMenuSample />} />
      <Gain
        label="Separator"
        raw={
          <div className="flex w-48 flex-col gap-2 text-sm">
            <span>Above</span>
            <RawSeparator />
            <span>Below</span>
          </div>
        }
      />
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
      <Heavy />
      <NewInSense />
    </div>
  );
}

// ---------- new-in-sense samples ----------

function AlertDialogSample() {
  return (
    <RawAlertDialog>
      <RawAlertDialogTrigger
        render={<RawButton variant="destructive">Delete account</RawButton>}
      />
      <RawAlertDialogContent>
        <RawAlertDialogHeader>
          <RawAlertDialogTitle>Are you absolutely sure?</RawAlertDialogTitle>
          <RawAlertDialogDescription>
            This action cannot be undone.
          </RawAlertDialogDescription>
        </RawAlertDialogHeader>
        <RawAlertDialogFooter>
          <RawAlertDialogCancel>Cancel</RawAlertDialogCancel>
          <RawAlertDialogAction>Delete</RawAlertDialogAction>
        </RawAlertDialogFooter>
      </RawAlertDialogContent>
    </RawAlertDialog>
  );
}

function AspectRatioSample() {
  return (
    <RawAspectRatio ratio={16 / 9} className="w-48 overflow-hidden rounded-md">
      <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/30 to-primary/10 text-xs text-neutral-700">
        16:9
      </div>
    </RawAspectRatio>
  );
}

function ContextMenuSample() {
  return (
    <RawContextMenu>
      <RawContextMenuTrigger
        render={
          <div className="flex h-16 w-48 items-center justify-center rounded-md border border-dashed text-xs text-neutral-500">
            right-click here
          </div>
        }
      />
      <RawContextMenuContent>
        <RawContextMenuItem>Back</RawContextMenuItem>
        <RawContextMenuItem>Forward</RawContextMenuItem>
        <RawContextMenuSeparator />
        <RawContextMenuItem>Reload</RawContextMenuItem>
      </RawContextMenuContent>
    </RawContextMenu>
  );
}

function HoverCardSample() {
  return (
    <RawHoverCard>
      <RawHoverCardTrigger
        render={<RawButton variant="link">@vercel</RawButton>}
      />
      <RawHoverCardContent>
        <div className="text-sm">The web platform — frontend cloud.</div>
      </RawHoverCardContent>
    </RawHoverCard>
  );
}

function NativeSelectSample() {
  return (
    <RawNativeSelect className="w-40">
      <option>Apple</option>
      <option>Banana</option>
      <option>Cherry</option>
    </RawNativeSelect>
  );
}

function ScrollAreaSample() {
  return (
    <RawScrollArea className="h-24 w-48 rounded-md border p-2 text-sm">
      {Array.from({ length: 30 }, (_, i) => (
        <div key={i}>Row {i + 1}</div>
      ))}
    </RawScrollArea>
  );
}

function SliderSample() {
  const [value, setValue] = useState<number[]>([50]);
  return (
    <RawSlider
      value={value}
      onValueChange={(v) => setValue(Array.isArray(v) ? [...v] : [v])}
      max={100}
      step={1}
      className="w-48"
    />
  );
}

function ToggleSample() {
  return (
    <RawToggle aria-label="Bold">
      <LuBold className="size-4" />
    </RawToggle>
  );
}

function OldAccordionSample() {
  return (
    <OldAccordion className="w-72">
      <OldAccordionItem id="a">
        <OldAccordionHeader>
          <OldAccordionTrigger>What is @op/ui?</OldAccordionTrigger>
        </OldAccordionHeader>
        <OldAccordionContent>RAC-based design system.</OldAccordionContent>
      </OldAccordionItem>
      <OldAccordionItem id="b">
        <OldAccordionHeader>
          <OldAccordionTrigger>Themable?</OldAccordionTrigger>
        </OldAccordionHeader>
        <OldAccordionContent>Via intent-ui-theme.css.</OldAccordionContent>
      </OldAccordionItem>
    </OldAccordion>
  );
}

function RawAccordionSample() {
  return (
    <RawAccordion className="w-72">
      <RawAccordionItem value="a">
        <RawAccordionTrigger>What is @op/sense?</RawAccordionTrigger>
        <RawAccordionContent>
          Op's shadcn-base-nova design system.
        </RawAccordionContent>
      </RawAccordionItem>
      <RawAccordionItem value="b">
        <RawAccordionTrigger>Themable?</RawAccordionTrigger>
        <RawAccordionContent>
          Via @op/styles shadcn-theme.css.
        </RawAccordionContent>
      </RawAccordionItem>
    </RawAccordion>
  );
}

function ToggleGroupSample() {
  return (
    <RawToggleGroup>
      <RawToggleGroupItem value="bold" aria-label="Bold">
        <LuBold className="size-4" />
      </RawToggleGroupItem>
      <RawToggleGroupItem value="italic" aria-label="Italic">
        <LuItalic className="size-4" />
      </RawToggleGroupItem>
      <RawToggleGroupItem value="underline" aria-label="Underline">
        <LuUnderline className="size-4" />
      </RawToggleGroupItem>
    </RawToggleGroup>
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

function OldConfettiModalSample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <OldButton onPress={() => setOpen(true)}>Celebrate</OldButton>
      <OldModal isOpen={open} onOpenChange={setOpen} isDismissable confetti>
        <OldModalHeader>Nice!</OldModalHeader>
        <OldModalBody>You did the thing.</OldModalBody>
        <OldModalFooter>
          <OldButton onPress={() => setOpen(false)}>Close</OldButton>
        </OldModalFooter>
      </OldModal>
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
  // Sonner is a singleton; one Toaster renders all three columns' calls.
  // Use sense's Toaster (carries `toastOptions.classNames.toast` with bg);
  // a bare <RawToaster /> would render unstyled containers for `toast.custom`.
  return <WrapToast />;
}

// ---------- additional sample helpers (Pair / Heavy) ----------

const REACTIONS = [
  { emoji: '👍', count: 4, isActive: true },
  { emoji: '🎉', count: 2 },
];

function OldReactionsSample() {
  return <OldReactionsButton reactions={REACTIONS} />;
}

function RawReactionsSample() {
  return <RawReactionsButton reactions={REACTIONS} />;
}

function OldAutoSizeSample() {
  const [value, setValue] = useState('Type to grow');
  return (
    <OldAutoSizeInput
      value={value}
      onChange={setValue}
      aria-label="Auto-size demo"
    />
  );
}

function RawAutoSizeSample() {
  const [value, setValue] = useState('Type to grow');
  return (
    <RawAutoSizeInput
      value={value}
      onChange={setValue}
      aria-label="Auto-size demo"
    />
  );
}

function OldDatePickerSample() {
  return <OldDatePicker label="Pick a date" />;
}

function RawDatePickerSample() {
  return <RawDatePicker label="Pick a date" />;
}

function OldNotificationPanelSample() {
  return (
    <OldNotificationPanel>
      <OldNotificationPanelHeader title="Notifications" count={2} />
      <OldNotificationPanelList>
        <OldNotificationPanelItem>
          <span>New comment on your post</span>
          <OldNotificationPanelActions>
            <OldButton size="small">View</OldButton>
          </OldNotificationPanelActions>
        </OldNotificationPanelItem>
        <OldNotificationPanelItem>
          <span>Build finished</span>
          <OldNotificationPanelActions>
            <OldButton size="small" color="secondary">
              Dismiss
            </OldButton>
          </OldNotificationPanelActions>
        </OldNotificationPanelItem>
      </OldNotificationPanelList>
    </OldNotificationPanel>
  );
}

function RawNotificationPanelSample() {
  return (
    <RawNotificationPanel>
      <RawNotificationPanelHeader title="Notifications" count={2} />
      <RawNotificationPanelList>
        <RawNotificationPanelItem>
          <span>New comment on your post</span>
          <RawNotificationPanelActions>
            <RawButton size="sm">View</RawButton>
          </RawNotificationPanelActions>
        </RawNotificationPanelItem>
        <RawNotificationPanelItem>
          <span>Build finished</span>
          <RawNotificationPanelActions>
            <RawButton size="sm" variant="outline">
              Dismiss
            </RawButton>
          </RawNotificationPanelActions>
        </RawNotificationPanelItem>
      </RawNotificationPanelList>
    </RawNotificationPanel>
  );
}

const LOGO_ITEMS = [
  { src: 'https://placehold.co/80x40/png', alt: 'Acme' },
  { src: 'https://placehold.co/80x40/png?text=Foo', alt: 'Foo' },
  { src: 'https://placehold.co/80x40/png?text=Bar', alt: 'Bar' },
];

function OldLogoLoopSample() {
  return <OldLogoLoop logos={LOGO_ITEMS} width={240} gap={24} />;
}

function RawLogoLoopSample() {
  return <RawLogoLoop logos={LOGO_ITEMS} width={240} gap={24} />;
}

const HORIZONTAL_ITEMS = [
  'Apple',
  'Banana',
  'Cherry',
  'Durian',
  'Elderberry',
  'Fig',
];

function OldHorizontalListSample() {
  return (
    <OldHorizontalList className="w-72">
      {HORIZONTAL_ITEMS.map((label) => (
        <li
          key={label}
          className="shrink-0 snap-start rounded-md border px-3 py-1 text-sm"
        >
          {label}
        </li>
      ))}
    </OldHorizontalList>
  );
}

function RawHorizontalListSample() {
  return (
    <RawHorizontalList className="w-72">
      {HORIZONTAL_ITEMS.map((label) => (
        <li
          key={label}
          className="shrink-0 snap-start rounded-md border px-3 py-1 text-sm"
        >
          {label}
        </li>
      ))}
    </RawHorizontalList>
  );
}

const PHASES_OLD: OldPhase[] = [
  { id: 'plan', name: 'Plan' },
  { id: 'build', name: 'Build' },
  { id: 'ship', name: 'Ship' },
];

const PHASES_RAW: RawPhase[] = [
  { id: 'plan', name: 'Plan' },
  { id: 'build', name: 'Build' },
  { id: 'ship', name: 'Ship' },
];

function OldPhaseStepperSample() {
  return <OldPhaseStepper phases={PHASES_OLD} currentPhaseId="build" />;
}

function RawPhaseStepperSample() {
  return <RawPhaseStepper phases={PHASES_RAW} currentPhaseId="build" />;
}

function OldStepperSample() {
  const [step, setStep] = useState(1);
  return (
    <div className="flex w-72 flex-col gap-3">
      <OldStepperProgressIndicator numItems={3} currentStep={step} />
      <OldStepItem currentStep={step} itemIndex={0}>
        Step one
      </OldStepItem>
      <OldStepItem currentStep={step} itemIndex={1}>
        Step two
      </OldStepItem>
      <OldStepItem currentStep={step} itemIndex={2}>
        Step three
      </OldStepItem>
      <div className="flex gap-2">
        <OldButton
          size="small"
          color="secondary"
          onPress={() => setStep((s) => Math.max(0, s - 1))}
        >
          Prev
        </OldButton>
        <OldButton
          size="small"
          onPress={() => setStep((s) => Math.min(2, s + 1))}
        >
          Next
        </OldButton>
      </div>
    </div>
  );
}

function RawStepperSample() {
  const [step, setStep] = useState(1);
  return (
    <div className="flex w-72 flex-col gap-3">
      <RawStepperProgressIndicator numItems={3} currentStep={step} />
      <RawStepItem currentStep={step} itemIndex={0}>
        Step one
      </RawStepItem>
      <RawStepItem currentStep={step} itemIndex={1}>
        Step two
      </RawStepItem>
      <RawStepItem currentStep={step} itemIndex={2}>
        Step three
      </RawStepItem>
      <div className="flex gap-2">
        <RawButton
          size="sm"
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Prev
        </RawButton>
        <RawButton size="sm" onClick={() => setStep((s) => Math.min(2, s + 1))}>
          Next
        </RawButton>
      </div>
    </div>
  );
}

function OldPopoverSample() {
  return (
    <OldMenuTrigger>
      <OldButton color="secondary">Open popover</OldButton>
      <OldPopover>
        <div className="p-3 text-sm">Popover body</div>
      </OldPopover>
    </OldMenuTrigger>
  );
}

function RawPopoverSample() {
  return (
    <RawPopover>
      <RawPopoverTrigger render={<RawButton variant="outline" />}>
        Open popover
      </RawPopoverTrigger>
      <RawPopoverContent>
        <div className="text-sm">Popover body</div>
      </RawPopoverContent>
    </RawPopover>
  );
}

function OldDialogSample() {
  return (
    <OldDialog>
      <div className="rounded-md border p-3 text-sm">
        Inline dialog content (RAC primitive, non-modal)
      </div>
    </OldDialog>
  );
}

function RawDialogStandaloneSample() {
  return (
    <RawPopover>
      <RawPopoverTrigger render={<RawButton variant="outline" />}>
        Show
      </RawPopoverTrigger>
      <RawPopoverContent>
        <div className="text-sm">Inline content via Popover</div>
      </RawPopoverContent>
    </RawPopover>
  );
}

const DROPDOWN_ITEMS = [
  { id: 'edit', label: 'Edit', onAction: () => {} },
  { id: 'duplicate', label: 'Duplicate', onAction: () => {} },
  { id: 'delete', label: 'Delete', onAction: () => {} },
];

function OldDropDownButtonSample() {
  return (
    <OldDropDownButton
      label="Actions"
      items={DROPDOWN_ITEMS}
      chevronIcon={<LuChevronDown className="size-4" />}
    />
  );
}

function RawDropDownButtonSample() {
  return (
    <RawDropdownMenu>
      <RawDropdownMenuTrigger
        render={
          <RawButton variant="outline">
            Actions
            <LuChevronDown className="size-4" />
          </RawButton>
        }
      />
      <RawDropdownMenuContent>
        {DROPDOWN_ITEMS.map((item) => (
          <RawDropdownMenuItem key={item.id}>{item.label}</RawDropdownMenuItem>
        ))}
      </RawDropdownMenuContent>
    </RawDropdownMenu>
  );
}

// ---------- heavy composite samples ----------

const TABLE_ROWS = [
  { id: 1, name: 'Ada Lovelace', role: 'Mathematician' },
  { id: 2, name: 'Grace Hopper', role: 'Compiler pioneer' },
  { id: 3, name: 'Alan Turing', role: 'CS founder' },
];

function OldTableSample() {
  return (
    <OldTable aria-label="People" className="w-80">
      <OldTableHeader>
        <OldTableColumn isRowHeader>Name</OldTableColumn>
        <OldTableColumn>Role</OldTableColumn>
      </OldTableHeader>
      <OldTableBody>
        {TABLE_ROWS.map((row) => (
          <OldTableRow key={row.id}>
            <OldTableCell>{row.name}</OldTableCell>
            <OldTableCell>{row.role}</OldTableCell>
          </OldTableRow>
        ))}
      </OldTableBody>
    </OldTable>
  );
}

function RawTableSample() {
  return (
    <RawTable className="w-80">
      <RawTableHeader>
        <RawTableRow>
          <RawTableHead>Name</RawTableHead>
          <RawTableHead>Role</RawTableHead>
        </RawTableRow>
      </RawTableHeader>
      <RawTableBody>
        {TABLE_ROWS.map((row) => (
          <RawTableRow key={row.id}>
            <RawTableCell>{row.name}</RawTableCell>
            <RawTableCell>{row.role}</RawTableCell>
          </RawTableRow>
        ))}
      </RawTableBody>
    </RawTable>
  );
}

function OldRichTextSample() {
  return (
    <div className="w-80">
      <OldRichTextEditor content="<p>Edit me…</p>" placeholder="Write here…" />
    </div>
  );
}

function RawRichTextSample() {
  return (
    <div className="w-80">
      <RawRichTextEditor content="<p>Edit me…</p>" placeholder="Write here…" />
    </div>
  );
}

function OldSidebarSample() {
  return (
    <OldSidebarProvider defaultOpen>
      <OldSidebarLayout className="h-40 w-80 overflow-hidden rounded-md border">
        <OldSidebar>
          <div className="flex flex-col gap-1 p-2 text-sm">
            <span className="font-medium">Workspace</span>
            <a className="rounded px-2 py-1 hover:bg-muted">Home</a>
            <a className="rounded px-2 py-1 hover:bg-muted">Inbox</a>
          </div>
        </OldSidebar>
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-2 border-b p-2 text-sm">
            <OldSidebarTrigger aria-label="Toggle sidebar" />
            <span>Main</span>
          </div>
          <div className="p-3 text-sm">Body</div>
        </div>
      </OldSidebarLayout>
    </OldSidebarProvider>
  );
}

const SIDEBAR_NAV_ITEMS = [
  { title: 'Home', icon: LuHouse },
  { title: 'Inbox', icon: LuInbox },
  { title: 'Calendar', icon: LuCalendar },
  { title: 'Search', icon: LuSearch },
  { title: 'Settings', icon: LuSettings },
] as const;

function RawSidebarSample() {
  return (
    // The shadcn Sidebar uses `position: fixed` for the desktop panel
    // (`md:flex fixed inset-y-0 …`). Fixed children anchor to the nearest
    // ancestor that establishes a containing block — `transform` does it
    // (CSS spec), so the panel stays inside this comparison cell instead
    // of escaping to the viewport edge.
    <div
      className="h-72 w-full max-w-2xl overflow-hidden rounded-lg border"
      style={{ transform: 'translateZ(0)' }}
    >
      <RawSidebarProvider
        className="h-full min-h-0"
        style={
          {
            '--sidebar-width': '12rem',
            '--sidebar-width-mobile': '12rem',
          } as React.CSSProperties
        }
      >
        <RawSidebar collapsible="icon">
          <RawSidebarHeader>
            <div className="px-2 py-1 text-sm font-semibold">Acme Inc.</div>
          </RawSidebarHeader>
          <RawSidebarContent>
            <RawSidebarGroup>
              <RawSidebarGroupLabel>Application</RawSidebarGroupLabel>
              <RawSidebarGroupContent>
                <RawSidebarMenu>
                  {SIDEBAR_NAV_ITEMS.map((item) => (
                    <RawSidebarMenuItem key={item.title}>
                      <RawSidebarMenuButton render={<a href="#" />}>
                        <item.icon />
                        <span>{item.title}</span>
                      </RawSidebarMenuButton>
                    </RawSidebarMenuItem>
                  ))}
                </RawSidebarMenu>
              </RawSidebarGroupContent>
            </RawSidebarGroup>
          </RawSidebarContent>
          <RawSidebarFooter>
            <div className="px-2 py-1 text-xs text-muted-foreground">v0.1</div>
          </RawSidebarFooter>
        </RawSidebar>
        <RawSidebarInset>
          <header className="flex h-10 items-center gap-2 border-b px-3">
            <RawSidebarTrigger />
            <span className="text-sm font-medium">Dashboard</span>
          </header>
          <div className="p-3 text-sm">Main content</div>
        </RawSidebarInset>
      </RawSidebarProvider>
    </div>
  );
}

const SORTABLE_INITIAL = [
  { id: '1', label: 'First' },
  { id: '2', label: 'Second' },
  { id: '3', label: 'Third' },
];

function OldSortableSample() {
  const [items, setItems] = useState(SORTABLE_INITIAL);
  return (
    <div className="w-72">
      <OldSortable
        items={items}
        onChange={setItems}
        dragTrigger="item"
        aria-label="Sortable list"
      >
        {(item) => (
          <div className="rounded-md border bg-white px-3 py-2 text-sm">
            {item.label}
          </div>
        )}
      </OldSortable>
    </div>
  );
}

function RawSortableSample() {
  const [items, setItems] = useState(SORTABLE_INITIAL);
  return (
    <div className="w-72">
      <RawSortable
        items={items}
        onChange={setItems}
        dragTrigger="item"
        aria-label="Sortable list"
      >
        {(item) => (
          <div className="rounded-md border bg-white px-3 py-2 text-sm">
            {item.label}
          </div>
        )}
      </RawSortable>
    </div>
  );
}

function OldSplitPaneSample() {
  return (
    <OldSplitPane className="h-40 w-96 overflow-hidden rounded-md border">
      <OldSplitPane.Pane id="a" label="Left">
        <div className="text-sm">Left content</div>
      </OldSplitPane.Pane>
      <OldSplitPane.Pane id="b" label="Right">
        <div className="text-sm">Right content</div>
      </OldSplitPane.Pane>
    </OldSplitPane>
  );
}

function RawSplitPaneSample() {
  return (
    <RawSplitPane className="h-40 w-96 overflow-hidden rounded-md border">
      <RawSplitPane.Pane id="a" label="Left">
        <div className="text-sm">Left content</div>
      </RawSplitPane.Pane>
      <RawSplitPane.Pane id="b" label="Right">
        <div className="text-sm">Right content</div>
      </RawSplitPane.Pane>
    </RawSplitPane>
  );
}

// ---------- new gain samples ----------

function MenubarSample() {
  return (
    <RawMenubar>
      <RawMenubarMenu>
        <RawMenubarTrigger>File</RawMenubarTrigger>
        <RawMenubarContent>
          <RawMenubarItem>New</RawMenubarItem>
          <RawMenubarItem>Open</RawMenubarItem>
          <RawMenubarSeparator />
          <RawMenubarItem>Quit</RawMenubarItem>
        </RawMenubarContent>
      </RawMenubarMenu>
      <RawMenubarMenu>
        <RawMenubarTrigger>Edit</RawMenubarTrigger>
        <RawMenubarContent>
          <RawMenubarItem>Undo</RawMenubarItem>
          <RawMenubarItem>Redo</RawMenubarItem>
        </RawMenubarContent>
      </RawMenubarMenu>
    </RawMenubar>
  );
}

function NavigationMenuSample() {
  return (
    <RawNavigationMenu>
      <RawNavigationMenuList>
        <RawNavigationMenuItem>
          <RawNavigationMenuTrigger>Products</RawNavigationMenuTrigger>
          <RawNavigationMenuContent>
            <div className="grid w-64 gap-2 p-3 text-sm">
              <RawNavigationMenuLink href="#">Platform</RawNavigationMenuLink>
              <RawNavigationMenuLink href="#">
                Integrations
              </RawNavigationMenuLink>
            </div>
          </RawNavigationMenuContent>
        </RawNavigationMenuItem>
        <RawNavigationMenuItem>
          <RawNavigationMenuLink href="#">Pricing</RawNavigationMenuLink>
        </RawNavigationMenuItem>
      </RawNavigationMenuList>
    </RawNavigationMenu>
  );
}
