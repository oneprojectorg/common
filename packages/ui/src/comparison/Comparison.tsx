// Side-by-side comparison of @op/sense (shadcn Base UI primitives) against
// the @op/ui (React Aria Components) equivalents. Storybook-only surface;
// see packages/ui/stories/Comparison.stories.tsx.
//
// Layout: a 3-column grid per row — [label] [@op/ui (before)] [@op/sense (after)].
// `Gain` rows show primitives that exist in @op/sense but have no @op/ui
// counterpart.
//
// Only shadcn PRIMITIVES are included here. Composites (DataTable, RichTextEditor,
// etc.) will get their own comparison surface once they land in @op/sense.

'use client';

import {
  Accordion as RawAccordion,
  AccordionContent as RawAccordionContent,
  AccordionItem as RawAccordionItem,
  AccordionTrigger as RawAccordionTrigger,
} from '@op/sense/Accordion';
import {
  Alert as RawAlert,
  AlertDescription as RawAlertDescription,
  AlertTitle as RawAlertTitle,
} from '@op/sense/Alert';
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
} from '@op/sense/AlertDialog';
import { AspectRatio as RawAspectRatio } from '@op/sense/AspectRatio';
import {
  Avatar as RawAvatar,
  AvatarFallback as RawAvatarFallback,
  AvatarImage as RawAvatarImage,
} from '@op/sense/Avatar';
import { Badge as RawBadge } from '@op/sense/Badge';
import {
  Breadcrumb as RawBreadcrumb,
  BreadcrumbItem as RawBreadcrumbItem,
  BreadcrumbLink as RawBreadcrumbLink,
  BreadcrumbList as RawBreadcrumbList,
  BreadcrumbPage as RawBreadcrumbPage,
  BreadcrumbSeparator as RawBreadcrumbSeparator,
} from '@op/sense/Breadcrumb';
import { Button as RawButton } from '@op/sense/Button';
import { ButtonGroup as RawButtonGroup } from '@op/sense/ButtonGroup';
import {
  Card as RawCard,
  CardContent as RawCardContent,
  CardHeader as RawCardHeader,
  CardTitle as RawCardTitle,
} from '@op/sense/Card';
import { Checkbox as RawCheckbox } from '@op/sense/Checkbox';
import {
  Collapsible as RawCollapsible,
  CollapsibleContent as RawCollapsibleContent,
  CollapsibleTrigger as RawCollapsibleTrigger,
} from '@op/sense/Collapsible';
import {
  Combobox as RawCombobox,
  ComboboxChip as RawComboboxChip,
  ComboboxChips as RawComboboxChips,
  ComboboxChipsInput as RawComboboxChipsInput,
  ComboboxContent as RawComboboxContent,
  ComboboxEmpty as RawComboboxEmpty,
  ComboboxCollection as RawComboboxCollection,
  ComboboxInput as RawComboboxInput,
  ComboboxItem as RawComboboxItem,
  ComboboxList as RawComboboxList,
  useComboboxAnchor as useRawComboboxAnchor,
} from '@op/sense/Combobox';
import {
  ContextMenu as RawContextMenu,
  ContextMenuContent as RawContextMenuContent,
  ContextMenuItem as RawContextMenuItem,
  ContextMenuTrigger as RawContextMenuTrigger,
} from '@op/sense/ContextMenu';
import {
  Dialog as RawDialog,
  DialogContent as RawDialogContent,
  DialogFooter as RawDialogFooter,
  DialogHeader as RawDialogHeader,
  DialogTitle as RawDialogTitle,
  DialogTrigger as RawDialogTrigger,
} from '@op/sense/Dialog';
import {
  DropdownMenu as RawDropdownMenu,
  DropdownMenuContent as RawDropdownMenuContent,
  DropdownMenuItem as RawDropdownMenuItem,
  DropdownMenuTrigger as RawDropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import {
  Empty as RawEmpty,
  EmptyContent as RawEmptyContent,
  EmptyDescription as RawEmptyDescription,
  EmptyHeader as RawEmptyHeader,
  EmptyMedia as RawEmptyMedia,
  EmptyTitle as RawEmptyTitle,
} from '@op/sense/Empty';
import {
  HoverCard as RawHoverCard,
  HoverCardContent as RawHoverCardContent,
  HoverCardTrigger as RawHoverCardTrigger,
} from '@op/sense/HoverCard';
import { Input as RawInput } from '@op/sense/Input';
import { Kbd as RawKbd } from '@op/sense/Kbd';
import { Label as RawLabel } from '@op/sense/Label';
import {
  Menubar as RawMenubar,
  MenubarContent as RawMenubarContent,
  MenubarItem as RawMenubarItem,
  MenubarMenu as RawMenubarMenu,
  MenubarTrigger as RawMenubarTrigger,
} from '@op/sense/Menubar';
import { NativeSelect as RawNativeSelect } from '@op/sense/NativeSelect';
import {
  NavigationMenu as RawNavigationMenu,
  NavigationMenuContent as RawNavigationMenuContent,
  NavigationMenuItem as RawNavigationMenuItem,
  NavigationMenuLink as RawNavigationMenuLink,
  NavigationMenuList as RawNavigationMenuList,
  NavigationMenuTrigger as RawNavigationMenuTrigger,
} from '@op/sense/NavigationMenu';
import {
  Pagination as RawPagination,
  PaginationContent as RawPaginationContent,
  PaginationItem as RawPaginationItem,
  PaginationLink as RawPaginationLink,
  PaginationNext as RawPaginationNext,
  PaginationPrevious as RawPaginationPrevious,
} from '@op/sense/Pagination';
import {
  Popover as RawPopover,
  PopoverContent as RawPopoverContent,
  PopoverTrigger as RawPopoverTrigger,
} from '@op/sense/Popover';
import { Progress as RawProgress } from '@op/sense/Progress';
import {
  RadioGroup as RawRadioGroup,
  RadioGroupItem as RawRadioGroupItem,
} from '@op/sense/RadioGroup';
import {
  ResizableHandle as RawResizableHandle,
  ResizablePanel as RawResizablePanel,
  ResizablePanelGroup as RawResizablePanelGroup,
} from '@op/sense/Resizable';
import { ScrollArea as RawScrollArea } from '@op/sense/ScrollArea';
import {
  Select as RawSelect,
  SelectContent as RawSelectContent,
  SelectGroup as RawSelectGroup,
  SelectItem as RawSelectItem,
  SelectTrigger as RawSelectTrigger,
  SelectValue as RawSelectValue,
} from '@op/sense/Select';
import { Separator as RawSeparator } from '@op/sense/Separator';
import {
  Sheet as RawSheet,
  SheetContent as RawSheetContent,
  SheetHeader as RawSheetHeader,
  SheetTitle as RawSheetTitle,
  SheetTrigger as RawSheetTrigger,
} from '@op/sense/Sheet';
import { Skeleton as RawSkeleton } from '@op/sense/Skeleton';
import { Slider as RawSlider } from '@op/sense/Slider';
import { Spinner as RawSpinner } from '@op/sense/Spinner';
import { Switch as RawSwitch } from '@op/sense/Switch';
import {
  Table as RawTable,
  TableBody as RawTableBody,
  TableCell as RawTableCell,
  TableHead as RawTableHead,
  TableHeader as RawTableHeader,
  TableRow as RawTableRow,
} from '@op/sense/Table';
import {
  Tabs as RawTabs,
  TabsContent as RawTabsContent,
  TabsList as RawTabsList,
  TabsTrigger as RawTabsTrigger,
} from '@op/sense/Tabs';
import { Textarea as RawTextarea } from '@op/sense/Textarea';
import { Toggle as RawToggle } from '@op/sense/Toggle';
import {
  ToggleGroup as RawToggleGroup,
  ToggleGroupItem as RawToggleGroupItem,
} from '@op/sense/ToggleGroup';
import {
  Tooltip as RawTooltip,
  TooltipContent as RawTooltipContent,
  TooltipProvider as RawTooltipProvider,
  TooltipTrigger as RawTooltipTrigger,
} from '@op/sense/Tooltip';
import { useId, useState, type ReactNode } from 'react';
import {
  LuArrowUpRight,
  LuBold,
  LuCircleCheck,
  LuFolderCode,
  LuItalic,
  LuSearch,
  LuUnderline,
} from 'react-icons/lu';

import { Avatar as OldAvatar } from '../components/Avatar';
import {
  Breadcrumb as OldBreadcrumb,
  Breadcrumbs as OldBreadcrumbs,
} from '../components/Breadcrumbs';
import { Button as OldButton } from '../components/Button';
import { ButtonGroup as OldButtonGroup } from '../components/ButtonGroup';
import { Checkbox as OldCheckbox } from '../components/Checkbox';
import { Chip as OldChip } from '../components/Chip';
import { ComboBox as OldComboBox } from '../components/ComboBox';
import { EmptyState as OldEmptyState } from '../components/EmptyState';
import { DropdownItem as OldDropdownItem } from '../components/ListBox';
import { LoadingSpinner as OldLoadingSpinner } from '../components/LoadingSpinner';
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
import { Pagination as OldPagination } from '../components/Pagination';
import { Popover as OldPopover } from '../components/Popover';
import {
  Radio as OldRadio,
  RadioGroup as OldRadioGroup,
} from '../components/RadioGroup';
import { Select as OldSelect } from '../components/Select';
import {
  Sheet as OldSheet,
  SheetBody as OldSheetBody,
  SheetHeader as OldSheetHeader,
} from '../components/Sheet';
import { Skeleton as OldSkeleton } from '../components/Skeleton';
import { Surface as OldSurface } from '../components/Surface';
import {
  Tab as OldTab,
  TabList as OldTabList,
  TabPanel as OldTabPanel,
  Tabs as OldTabs,
} from '../components/Tabs';
import { TextField as OldTextField } from '../components/TextField';
import { ToggleButton as OldToggleButton } from '../components/ToggleButton';
import {
  Tooltip as OldTooltip,
  TooltipTrigger as OldTooltipTrigger,
} from '../components/Tooltip';
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
import { cn } from '../lib/utils';

// ---------- layout primitives ----------

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
        // Right column gets `.sense` so the shadcn-tuned text + radius
        // scales apply only to the sense-rendered cell; the @op/ui cell
        // (i === 0) keeps OP's smaller scale.
        <div key={i} className={cn('min-w-0', i === 1 && 'sense')}>
          <div className="mb-2 text-[10px] tracking-wide text-neutral-500 uppercase">
            {COLUMN_LABELS[i]}
          </div>
          <div className="flex flex-wrap items-center gap-3">{node}</div>
        </div>
      ))}
    </div>
  );
}

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
      {/* sense-scoped cell so primitive scales resolve correctly */}
      <div className="sense min-w-0">
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

// ---------- shared sample data ----------

const SELECT_ITEMS = [
  { id: 'free', label: 'Free' },
  { id: 'pro', label: 'Pro' },
  { id: 'team', label: 'Team' },
];

// ---------- inline sample helpers (only where a row needs setup) ----------

function OldModalSample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <OldButton onPress={() => setOpen(true)}>Open</OldButton>
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

function RawDialogSample() {
  return (
    <RawDialog>
      <RawDialogTrigger render={<RawButton>Open</RawButton>} />
      <RawDialogContent className="sense">
        <RawDialogHeader>
          <RawDialogTitle>Dialog title</RawDialogTitle>
        </RawDialogHeader>
        <div className="px-6 py-4 text-sm">Dialog body</div>
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
      <OldSheet isOpen={open} onOpenChange={setOpen}>
        <OldSheetHeader>Sheet title</OldSheetHeader>
        <OldSheetBody>Sheet body</OldSheetBody>
      </OldSheet>
    </>
  );
}

function RawSheetSample() {
  return (
    <RawSheet>
      <RawSheetTrigger render={<RawButton>Open sheet</RawButton>} />
      <RawSheetContent className="sense">
        <RawSheetHeader>
          <RawSheetTitle>Sheet title</RawSheetTitle>
        </RawSheetHeader>
        <div className="px-6 text-sm">Sheet body</div>
      </RawSheetContent>
    </RawSheet>
  );
}

function OldMenuSample() {
  return (
    <OldMenuTrigger>
      <OldButton color="secondary">Open menu</OldButton>
      <OldMenu>
        <OldMenuItem>Profile</OldMenuItem>
        <OldMenuItem>Settings</OldMenuItem>
        <OldMenuItem>Sign out</OldMenuItem>
      </OldMenu>
    </OldMenuTrigger>
  );
}

function RawDropdownMenuSample() {
  return (
    <RawDropdownMenu>
      <RawDropdownMenuTrigger
        render={<RawButton variant="outline">Open menu</RawButton>}
      />
      <RawDropdownMenuContent className="sense">
        <RawDropdownMenuItem>Profile</RawDropdownMenuItem>
        <RawDropdownMenuItem>Settings</RawDropdownMenuItem>
        <RawDropdownMenuItem>Sign out</RawDropdownMenuItem>
      </RawDropdownMenuContent>
    </RawDropdownMenu>
  );
}

function OldTooltipSample() {
  return (
    <OldTooltipTrigger delay={100}>
      <OldButton color="secondary">Hover me</OldButton>
      <OldTooltip>Tooltip content</OldTooltip>
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
        <RawTooltipContent className="sense">Tooltip content</RawTooltipContent>
      </RawTooltip>
    </RawTooltipProvider>
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
      <RawPopoverTrigger
        render={<RawButton variant="outline">Open popover</RawButton>}
      />
      <RawPopoverContent className="sense p-3 text-sm">
        Popover body
      </RawPopoverContent>
    </RawPopover>
  );
}

function RawCheckboxSample() {
  const id = useId();
  return (
    <div className="flex items-center space-x-2">
      <RawCheckbox id={id} />
      <RawLabel htmlFor={id}>Accept terms</RawLabel>
    </div>
  );
}

function RawSwitchSample() {
  const id = useId();
  return (
    <div className="flex items-center space-x-2">
      <RawSwitch id={id} />
      <RawLabel htmlFor={id}>Notifications</RawLabel>
    </div>
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
    <RawRadioGroup defaultValue="pro" className="flex flex-col gap-2">
      <div className="flex items-center space-x-2">
        <RawRadioGroupItem id={idA} value="free" />
        <RawLabel htmlFor={idA}>Free</RawLabel>
      </div>
      <div className="flex items-center space-x-2">
        <RawRadioGroupItem id={idB} value="pro" />
        <RawLabel htmlFor={idB}>Pro</RawLabel>
      </div>
    </RawRadioGroup>
  );
}

// Combobox samples — the two libraries demand different item shapes:
//   - @op/sense Combobox: base-ui auto-derives the filter string from
//     `item.value` when items are `{ value, label }`. Sense's Combobox
//     type omits `itemToStringLabel`, so we can't use any other shape.
//   - @op/ui MultiSelectComboBox: typed against an `Option` with `id`.
// Same data, two views.
const COMBOBOX_ITEMS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];
const OLD_COMBOBOX_ITEMS = COMBOBOX_ITEMS.map(({ value, label }) => ({
  id: value,
  label,
}));

function OldComboBoxSample() {
  return (
    <OldComboBox
      label="Fruit"
      items={OLD_COMBOBOX_ITEMS}
      placeholder="Pick one"
    >
      {(item) => <OldDropdownItem id={item.id}>{item.label}</OldDropdownItem>}
    </OldComboBox>
  );
}

function RawComboboxSample() {
  return (
    <RawCombobox items={COMBOBOX_ITEMS}>
      <RawComboboxInput placeholder="Pick a fruit" className="w-48" />
      <RawComboboxContent className="sense">
        <RawComboboxList>
          <RawComboboxCollection>
            {(opt: (typeof COMBOBOX_ITEMS)[number]) => (
              <RawComboboxItem key={opt.value} value={opt}>
                {opt.label}
              </RawComboboxItem>
            )}
          </RawComboboxCollection>
          <RawComboboxEmpty>No results</RawComboboxEmpty>
        </RawComboboxList>
      </RawComboboxContent>
    </RawCombobox>
  );
}

function OldMultiComboBoxSample() {
  const [value, setValue] = useState<typeof OLD_COMBOBOX_ITEMS>([]);
  return (
    <OldMultiSelectComboBox
      label="Fruits"
      items={OLD_COMBOBOX_ITEMS}
      value={value}
      onChange={setValue}
    />
  );
}

function RawMultiComboboxSample() {
  const [value, setValue] = useState<typeof COMBOBOX_ITEMS>([]);
  // Anchor the popup to the chips container, not the inner input. Without
  // this, base-ui's default positioner attaches to the input element; as
  // chips fill the row, the input shifts right and the popup visibly
  // jumps around. Sense exposes `useComboboxAnchor` precisely for this.
  const anchor = useRawComboboxAnchor();
  return (
    <RawCombobox
      items={COMBOBOX_ITEMS}
      multiple
      value={value}
      onValueChange={(v: unknown) => setValue(v as typeof COMBOBOX_ITEMS)}
    >
      <RawComboboxChips ref={anchor} className="w-48">
        {value.map((opt) => (
          <RawComboboxChip key={opt.value}>{opt.label}</RawComboboxChip>
        ))}
        <RawComboboxChipsInput placeholder="Pick" />
      </RawComboboxChips>
      <RawComboboxContent anchor={anchor} className="sense">
        <RawComboboxList>
          <RawComboboxCollection>
            {(opt: (typeof COMBOBOX_ITEMS)[number]) => (
              <RawComboboxItem key={opt.value} value={opt}>
                {opt.label}
              </RawComboboxItem>
            )}
          </RawComboboxCollection>
          <RawComboboxEmpty>No results</RawComboboxEmpty>
        </RawComboboxList>
      </RawComboboxContent>
    </RawCombobox>
  );
}

function OldSelectSample() {
  return (
    <OldSelect label="Plan" items={SELECT_ITEMS} placeholder="Pick one">
      {(item) => <OldDropdownItem id={item.id}>{item.label}</OldDropdownItem>}
    </OldSelect>
  );
}

// base-ui's Select.Value displays the raw `value` by default, not the
// Item's children. Passing `items` to <Select.Root> gives it a value→label
// map so the trigger shows "Free" instead of "free".
const RAW_SELECT_ITEMS = Object.fromEntries(
  SELECT_ITEMS.map((i) => [i.id, i.label]),
);

function RawSelectSample() {
  return (
    <RawSelect items={RAW_SELECT_ITEMS}>
      <RawSelectTrigger className="w-40">
        <RawSelectValue placeholder="Pick one" />
      </RawSelectTrigger>
      <RawSelectContent className="sense">
        {/* SelectGroup carries the `p-1` inner padding; items wrapped here
            get the breathing room around the popup edge. Sense's bare
            SelectContent intentionally has no padding so consumers can
            group items / labels themselves. */}
        <RawSelectGroup>
          {SELECT_ITEMS.map((item) => (
            <RawSelectItem key={item.id} value={item.id}>
              {item.label}
            </RawSelectItem>
          ))}
        </RawSelectGroup>
      </RawSelectContent>
    </RawSelect>
  );
}

function OldTabsSample() {
  return (
    <OldTabs defaultSelectedKey="overview" className="w-72">
      <OldTabList>
        <OldTab id="overview">Overview</OldTab>
        <OldTab id="settings">Settings</OldTab>
      </OldTabList>
      <OldTabPanel id="overview">Overview content</OldTabPanel>
      <OldTabPanel id="settings">Settings content</OldTabPanel>
    </OldTabs>
  );
}

function RawTabsSample() {
  return (
    <RawTabs defaultValue="overview" className="w-72">
      <RawTabsList variant="line">
        <RawTabsTrigger value="overview">Overview</RawTabsTrigger>
        <RawTabsTrigger value="settings">Settings</RawTabsTrigger>
      </RawTabsList>
      <RawTabsContent value="overview">Overview content</RawTabsContent>
      <RawTabsContent value="settings">Settings content</RawTabsContent>
    </RawTabs>
  );
}

function OldAccordionSample() {
  return (
    <OldAccordion className="w-72">
      <OldAccordionItem id="a">
        <OldAccordionHeader>
          <OldAccordionTrigger>First</OldAccordionTrigger>
        </OldAccordionHeader>
        <OldAccordionContent>First content</OldAccordionContent>
      </OldAccordionItem>
      <OldAccordionItem id="b">
        <OldAccordionHeader>
          <OldAccordionTrigger>Second</OldAccordionTrigger>
        </OldAccordionHeader>
        <OldAccordionContent>Second content</OldAccordionContent>
      </OldAccordionItem>
    </OldAccordion>
  );
}

function RawAccordionSample() {
  return (
    <RawAccordion className="w-72">
      <RawAccordionItem value="a">
        <RawAccordionTrigger>First</RawAccordionTrigger>
        <RawAccordionContent>First content</RawAccordionContent>
      </RawAccordionItem>
      <RawAccordionItem value="b">
        <RawAccordionTrigger>Second</RawAccordionTrigger>
        <RawAccordionContent>Second content</RawAccordionContent>
      </RawAccordionItem>
    </RawAccordion>
  );
}

function RawTableSample() {
  return (
    <RawTable>
      <RawTableHeader>
        <RawTableRow>
          <RawTableHead>Name</RawTableHead>
          <RawTableHead>Plan</RawTableHead>
        </RawTableRow>
      </RawTableHeader>
      <RawTableBody>
        <RawTableRow>
          <RawTableCell>Alice</RawTableCell>
          <RawTableCell>Pro</RawTableCell>
        </RawTableRow>
        <RawTableRow>
          <RawTableCell>Bob</RawTableCell>
          <RawTableCell>Free</RawTableCell>
        </RawTableRow>
      </RawTableBody>
    </RawTable>
  );
}

function OldTableSample() {
  return (
    <OldTable aria-label="users">
      <OldTableHeader>
        <OldTableColumn isRowHeader>Name</OldTableColumn>
        <OldTableColumn>Plan</OldTableColumn>
      </OldTableHeader>
      <OldTableBody>
        <OldTableRow>
          <OldTableCell>Alice</OldTableCell>
          <OldTableCell>Pro</OldTableCell>
        </OldTableRow>
        <OldTableRow>
          <OldTableCell>Bob</OldTableCell>
          <OldTableCell>Free</OldTableCell>
        </OldTableRow>
      </OldTableBody>
    </OldTable>
  );
}

// ---------- sections ----------

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
        label="Small"
        old={<OldButton size="small">Small</OldButton>}
        raw={<RawButton size="sm">Small</RawButton>}
      />
      <Pair
        label="Icon button"
        old={
          <OldButton color="secondary" aria-label="Search">
            <LuSearch className="size-4" />
          </OldButton>
        }
        raw={
          <RawButton variant="ghost" size="icon" aria-label="Search">
            <LuSearch />
          </RawButton>
        }
      />
      <Pair
        label="ButtonGroup"
        old={
          <OldButtonGroup>
            <OldButton color="secondary">One</OldButton>
            <OldButton color="secondary">Two</OldButton>
            <OldButton color="secondary">Three</OldButton>
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
      <Gain
        label="Toggle"
        raw={
          <RawToggle aria-label="Bold">
            <LuBold />
          </RawToggle>
        }
      />
      <Gain
        label="ToggleGroup"
        raw={
          <RawToggleGroup multiple defaultValue={['bold']}>
            <RawToggleGroupItem value="bold" aria-label="Bold">
              <LuBold />
            </RawToggleGroupItem>
            <RawToggleGroupItem value="italic" aria-label="Italic">
              <LuItalic />
            </RawToggleGroupItem>
            <RawToggleGroupItem value="underline" aria-label="Underline">
              <LuUnderline />
            </RawToggleGroupItem>
          </RawToggleGroup>
        }
      />
    </Section>
  );
}

export function Forms() {
  return (
    <Section title="Form inputs">
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
        label="Text (invalid)"
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
        label="Checkbox"
        old={<OldCheckbox>Accept terms</OldCheckbox>}
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
        label="Combobox"
        old={<OldComboBoxSample />}
        raw={<RawComboboxSample />}
      />
      <Pair
        label="Combobox (multi)"
        old={<OldMultiComboBoxSample />}
        raw={<RawMultiComboboxSample />}
      />
      <Pair
        label="Switch"
        old={
          <OldToggleButton aria-label="Notifications">
            Notifications
          </OldToggleButton>
        }
        raw={<RawSwitchSample />}
      />
      <Gain
        label="Slider"
        raw={
          <RawSlider defaultValue={[50]} max={100} step={1} className="w-48" />
        }
      />
      <Gain
        label="NativeSelect"
        raw={
          <RawNativeSelect>
            <option>Free</option>
            <option>Pro</option>
            <option>Team</option>
          </RawNativeSelect>
        }
      />
    </Section>
  );
}

export function Overlays() {
  return (
    <Section title="Overlays">
      <Pair
        label="Modal / Dialog"
        old={<OldModalSample />}
        raw={<RawDialogSample />}
      />
      <Gain
        label="AlertDialog"
        raw={
          <RawAlertDialog>
            <RawAlertDialogTrigger
              render={<RawButton variant="outline">Delete…</RawButton>}
            />
            <RawAlertDialogContent className="sense">
              <RawAlertDialogHeader>
                <RawAlertDialogTitle>Are you sure?</RawAlertDialogTitle>
                <RawAlertDialogDescription>
                  This cannot be undone.
                </RawAlertDialogDescription>
              </RawAlertDialogHeader>
              <RawAlertDialogFooter>
                <RawAlertDialogCancel>Cancel</RawAlertDialogCancel>
                <RawAlertDialogAction>Delete</RawAlertDialogAction>
              </RawAlertDialogFooter>
            </RawAlertDialogContent>
          </RawAlertDialog>
        }
      />
      <Pair label="Sheet" old={<OldSheetSample />} raw={<RawSheetSample />} />
      <Pair
        label="Popover"
        old={<OldPopoverSample />}
        raw={<RawPopoverSample />}
      />
      <Gain
        label="HoverCard"
        raw={
          <RawHoverCard>
            <RawHoverCardTrigger
              render={<RawButton variant="link">@user</RawButton>}
            />
            <RawHoverCardContent className="sense text-sm">
              Profile preview
            </RawHoverCardContent>
          </RawHoverCard>
        }
      />
      <Pair
        label="Tooltip"
        old={<OldTooltipSample />}
        raw={<RawTooltipSample />}
      />
      <Pair
        label="DropdownMenu / Menu"
        old={<OldMenuSample />}
        raw={<RawDropdownMenuSample />}
      />
      <Gain
        label="ContextMenu"
        raw={
          <RawContextMenu>
            <RawContextMenuTrigger className="rounded-md border border-dashed px-3 py-2 text-sm">
              Right-click me
            </RawContextMenuTrigger>
            <RawContextMenuContent className="sense">
              <RawContextMenuItem>Copy</RawContextMenuItem>
              <RawContextMenuItem>Paste</RawContextMenuItem>
            </RawContextMenuContent>
          </RawContextMenu>
        }
      />
      <Gain
        label="Menubar"
        raw={
          <RawMenubar>
            <RawMenubarMenu>
              <RawMenubarTrigger>File</RawMenubarTrigger>
              <RawMenubarContent className="sense">
                <RawMenubarItem>New</RawMenubarItem>
                <RawMenubarItem>Open…</RawMenubarItem>
              </RawMenubarContent>
            </RawMenubarMenu>
            <RawMenubarMenu>
              <RawMenubarTrigger>Edit</RawMenubarTrigger>
              <RawMenubarContent className="sense">
                <RawMenubarItem>Undo</RawMenubarItem>
                <RawMenubarItem>Redo</RawMenubarItem>
              </RawMenubarContent>
            </RawMenubarMenu>
          </RawMenubar>
        }
      />
    </Section>
  );
}

export function Navigation() {
  return (
    <Section title="Navigation">
      <Pair label="Tabs" old={<OldTabsSample />} raw={<RawTabsSample />} />
      <Pair
        label="Breadcrumb"
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
        label="Pagination"
        old={
          <OldPagination
            range={{ totalItems: 50, itemsPerPage: 10, page: 1 }}
            next={() => {}}
            previous={() => {}}
          />
        }
        raw={
          <RawPagination>
            <RawPaginationContent>
              <RawPaginationItem>
                <RawPaginationPrevious href="#" />
              </RawPaginationItem>
              <RawPaginationItem>
                <RawPaginationLink href="#">1</RawPaginationLink>
              </RawPaginationItem>
              <RawPaginationItem>
                <RawPaginationLink href="#" isActive>
                  2
                </RawPaginationLink>
              </RawPaginationItem>
              <RawPaginationItem>
                <RawPaginationLink href="#">3</RawPaginationLink>
              </RawPaginationItem>
              <RawPaginationItem>
                <RawPaginationNext href="#" />
              </RawPaginationItem>
            </RawPaginationContent>
          </RawPagination>
        }
      />
      <Gain
        label="NavigationMenu"
        raw={
          <RawNavigationMenu>
            <RawNavigationMenuList>
              <RawNavigationMenuItem>
                <RawNavigationMenuTrigger>Docs</RawNavigationMenuTrigger>
                <RawNavigationMenuContent className="sense">
                  <ul className="grid w-48 gap-1 p-2 text-sm">
                    <li>
                      <RawNavigationMenuLink href="#">
                        Getting started
                      </RawNavigationMenuLink>
                    </li>
                    <li>
                      <RawNavigationMenuLink href="#">
                        Guides
                      </RawNavigationMenuLink>
                    </li>
                  </ul>
                </RawNavigationMenuContent>
              </RawNavigationMenuItem>
            </RawNavigationMenuList>
          </RawNavigationMenu>
        }
      />
    </Section>
  );
}

export function Surfaces() {
  return (
    <Section title="Surfaces & layout">
      <Pair
        label="Card / Surface"
        old={
          <OldSurface className="w-64 p-4">
            <div className="font-medium">Title</div>
            <div className="text-neutral-gray4">Body content</div>
          </OldSurface>
        }
        raw={
          <RawCard className="w-64">
            <RawCardHeader>
              <RawCardTitle>Title</RawCardTitle>
            </RawCardHeader>
            <RawCardContent>Body content</RawCardContent>
          </RawCard>
        }
      />
      <Pair
        label="Skeleton"
        old={<OldSkeleton className="h-4 w-32" />}
        raw={<RawSkeleton className="h-4 w-32" />}
      />
      <Gain label="Separator" raw={<RawSeparator className="w-48" />} />
      <Gain
        label="AspectRatio"
        raw={
          <RawAspectRatio
            ratio={16 / 9}
            className="w-48 rounded-md bg-neutral-100"
          >
            <div className="flex h-full items-center justify-center text-xs text-neutral-500">
              16:9
            </div>
          </RawAspectRatio>
        }
      />
      <Gain
        label="ScrollArea"
        raw={
          <RawScrollArea className="h-24 w-48 rounded-md border">
            <div className="p-2 text-sm">
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i}>Row {i + 1}</div>
              ))}
            </div>
          </RawScrollArea>
        }
      />
      <Pair
        label="Resizable / SplitPane"
        old={
          <span className="text-xs text-neutral-500">SplitPane (@op/ui)</span>
        }
        raw={
          <RawResizablePanelGroup
            orientation="horizontal"
            className="h-24 w-64 rounded-md border"
          >
            <RawResizablePanel
              defaultSize={50}
              className="flex items-center justify-center text-xs"
            >
              A
            </RawResizablePanel>
            <RawResizableHandle />
            <RawResizablePanel
              defaultSize={50}
              className="flex items-center justify-center text-xs"
            >
              B
            </RawResizablePanel>
          </RawResizablePanelGroup>
        }
      />
      <Gain
        label="Collapsible"
        raw={
          <RawCollapsible className="w-48">
            <RawCollapsibleTrigger
              render={
                <RawButton variant="outline" size="sm">
                  Toggle
                </RawButton>
              }
            />
            <RawCollapsibleContent className="mt-2 text-sm">
              Hidden content
            </RawCollapsibleContent>
          </RawCollapsible>
        }
      />
    </Section>
  );
}

export function Feedback() {
  return (
    <Section title="Display & feedback">
      <Pair
        label="Badge / Chip"
        old={<OldChip>Tag</OldChip>}
        raw={<RawBadge variant="secondary">Tag</RawBadge>}
      />
      <Pair
        label="Avatar"
        old={<OldAvatar placeholder="Alice" />}
        raw={
          <RawAvatar>
            <RawAvatarImage src="https://i.pravatar.cc/64?u=alice" />
            <RawAvatarFallback>AL</RawAvatarFallback>
          </RawAvatar>
        }
      />
      <Pair
        label="Spinner"
        old={<OldLoadingSpinner />}
        raw={<RawSpinner className="size-6" />}
      />
      <Pair
        label="Accordion"
        old={<OldAccordionSample />}
        raw={<RawAccordionSample />}
      />
      <Pair label="Table" old={<OldTableSample />} raw={<RawTableSample />} />
      <Pair
        label="Toast"
        old={
          // Static preview — sonner is a global singleton, so we can't mount
          // both Toasters; rendering each library's toast markup statically
          // gives a clean side-by-side comparison without singleton fights.
          <div className="group toast text-5 flex w-72 gap-3 rounded-lg border bg-neutral-offWhite p-3 text-neutral-black backdrop-blur-md">
            <LuCircleCheck className="size-6 shrink-0 text-functional-green" />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">Saved</span>
            </div>
          </div>
        }
        raw={
          // data-slot lets the @op/sense [data-slot] text-scale override
          // apply, matching what an actual sonner toast inside the sense
          // Toaster would render at.
          <div
            data-slot="toast"
            className="flex w-72 items-center gap-3 rounded-[var(--radius)] border p-4 text-sm"
            style={{
              background: 'var(--popover)',
              color: 'var(--popover-foreground)',
              borderColor: 'var(--border)',
            }}
          >
            <LuCircleCheck className="size-4 shrink-0" />
            <span>Saved</span>
          </div>
        }
      />
      <Gain
        label="Alert"
        raw={
          <RawAlert>
            <RawAlertTitle>Heads up</RawAlertTitle>
            <RawAlertDescription>Something to know.</RawAlertDescription>
          </RawAlert>
        }
      />
      <Gain
        label="Progress"
        raw={<RawProgress value={62} className="w-48" />}
      />
      <Pair
        label="Empty / EmptyState"
        old={
          <OldEmptyState icon={<LuFolderCode />}>
            <p className="font-medium">No Projects Yet</p>
            <p className="text-sm">
              You haven’t created any projects yet. Get started by creating your
              first project.
            </p>
          </OldEmptyState>
        }
        raw={
          <RawEmpty>
            <RawEmptyHeader>
              <RawEmptyMedia variant="icon">
                <LuFolderCode />
              </RawEmptyMedia>
              <RawEmptyTitle>No Projects Yet</RawEmptyTitle>
              <RawEmptyDescription>
                You haven’t created any projects yet. Get started by creating
                your first project.
              </RawEmptyDescription>
            </RawEmptyHeader>
            <RawEmptyContent className="flex-row justify-center gap-2">
              <RawButton>Create Project</RawButton>
              <RawButton variant="outline">Import Project</RawButton>
            </RawEmptyContent>
            <RawButton
              variant="link"
              className="text-muted-foreground"
              size="sm"
              nativeButton={false}
              render={
                <a href="#">
                  Learn More <LuArrowUpRight />
                </a>
              }
            />
          </RawEmpty>
        }
      />
      <Gain label="Kbd" raw={<RawKbd>⌘ K</RawKbd>} />
    </Section>
  );
}

// ---------- top-level grid ----------

export function ComparisonGrid() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-xl font-semibold text-neutral-900">
        @op/ui (RAC) vs @op/sense (shadcn) — primitives
      </h1>
      <p className="mb-6 text-sm text-neutral-600">
        Side-by-side comparison of shadcn base-vega primitives shipped in
        <code className="mx-1 rounded bg-neutral-100 px-1.5 py-0.5">
          @op/sense
        </code>
        against their @op/ui counterparts. Rows labelled <em>no equivalent</em>
        are net new in sense.
      </p>
      <Buttons />
      <Forms />
      <Overlays />
      <Navigation />
      <Surfaces />
      <Feedback />
    </div>
  );
}
