import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@op/sense/Breadcrumb';
import { Button } from '@op/sense/Button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@op/sense/Command';
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@op/sense/ContextMenu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from '@op/sense/Menubar';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@op/sense/NavigationMenu';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@op/sense/Pagination';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@op/sense/Sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  LuBookOpen,
  LuCalculator,
  LuCalendar,
  LuChevronDown,
  LuChevronsUpDown,
  LuCreditCard,
  LuSettings,
  LuSmile,
  LuUser,
} from 'react-icons/lu';

import figmaBreadcrumb from '../assets/figma/breadcrumb.png';
import figmaCommand from '../assets/figma/command.png';
import figmaContextMenu from '../assets/figma/context-menu.png';
import figmaDropdownMenu from '../assets/figma/dropdown-menu.png';
import figmaMenubar from '../assets/figma/menubar.png';
import figmaNavigationMenu from '../assets/figma/navigation-menu.png';
import figmaPagination from '../assets/figma/pagination.png';
import figmaSidebar from '../assets/figma/sidebar.png';
import figmaTabsLine from '../assets/figma/tabs-line.png';
import figmaTabs from '../assets/figma/tabs.png';
import { ParityGridHeader, ParityRow, withDesignScale } from './Parity';

// Figma parity for the menus & navigation family. See Parity.tsx for the
// conventions. Mocks come from each Figma page's Playground frame (first
// example, Light theme) and the live column mirrors that example's content.
//
// Menu panels are portal-based, so the live column renders each component's
// trigger wired to the real component — open it interactively to compare
// against the Figma export. Breadcrumb, tabs, pagination, command, and
// sidebar render statically.

const meta: Meta = {
  title: 'Sense Comparison/Figma Parity/Menus & navigation',
  parameters: { layout: 'fullscreen' },
  decorators: [withDesignScale],
};

export default meta;

type Story = StoryObj;

const buildingYourApplication = [
  'Routing',
  'Data Fetching',
  'Rendering',
  'Caching',
  'Styling',
  'Optimizing',
  'Configuring',
  'Testing',
  'Authentication',
  'Deploying',
  'Upgrading',
  'Examples',
];

const tabPanels = [
  {
    tab: 'Overview',
    body: 'View your key metrics and recent project activity. Track progress across all your active projects.',
    footer: 'You have 12 active projects and 3 pending tasks.',
  },
  {
    tab: 'Analytics',
    body: 'Dive into detailed analytics across sessions, conversion, and retention.',
    footer: 'Sessions are up 8% week over week.',
  },
  {
    tab: 'Reports',
    body: 'Generate and download reports to share with your team.',
    footer: '4 reports were shared this month.',
  },
  {
    tab: 'Settings',
    body: 'Manage your workspace preferences, members, and integrations.',
    footer: '2 integrations need attention.',
  },
];

const componentLinks = [
  [
    'Alert Dialog',
    'A modal dialog that interrupts the user with important content.',
  ],
  [
    'Hover Card',
    'For sighted users to preview content available behind a link.',
  ],
  [
    'Progress',
    'Displays an indicator showing the completion progress of a task.',
  ],
  ['Scroll-area', 'Visually or semantically separates content.'],
  ['Tabs', 'A set of layered sections of content—known as tab panels.'],
  ['Tooltip', 'A popup that displays information related to an element.'],
];

export const MenusNavigation: Story = {
  name: 'Menus & navigation',
  render: () => (
    <div className="flex flex-col gap-10 p-8">
      <ParityGridHeader />

      {/* Portal-based: open the menu interactively to compare. */}
      <ParityRow label="Dropdown menu" img={figmaDropdownMenu} imgWidth={170}>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>
            Open
          </DropdownMenuTrigger>
          <DropdownMenuContent className="sense w-40">
            <DropdownMenuGroup>
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuItem>
                Profile
                <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                Billing
                <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                Settings
                <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>Team</DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Invite users</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="sense">
                  <DropdownMenuItem>Email</DropdownMenuItem>
                  <DropdownMenuItem>Message</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem>
                New Team
                <DropdownMenuShortcut>⌘+T</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>GitHub</DropdownMenuItem>
            <DropdownMenuItem>Support</DropdownMenuItem>
            <DropdownMenuItem disabled>API</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              Log out
              <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ParityRow>

      {/* Portal-based: right-click the frame to compare the open menu. */}
      <ParityRow label="Context menu" img={figmaContextMenu} imgWidth={202}>
        <ContextMenu>
          <ContextMenuTrigger className="flex h-24 items-center justify-center rounded-md border border-dashed border-input bg-muted text-sm text-muted-foreground">
            Right-click here
          </ContextMenuTrigger>
          <ContextMenuContent className="sense w-52">
            <ContextMenuItem>
              Back
              <ContextMenuShortcut>⌘[</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem disabled>
              Forward
              <ContextMenuShortcut>⌘]</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem>
              Reload
              <ContextMenuShortcut>⌘R</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger>More Tools</ContextMenuSubTrigger>
              <ContextMenuSubContent className="sense">
                <ContextMenuItem>Save Page…</ContextMenuItem>
                <ContextMenuItem>Create Shortcut…</ContextMenuItem>
                <ContextMenuItem>Name Window…</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem>Developer Tools</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
            <ContextMenuCheckboxItem defaultChecked>
              Show Bookmarks
            </ContextMenuCheckboxItem>
            <ContextMenuCheckboxItem>Show Full URLs</ContextMenuCheckboxItem>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuLabel>People</ContextMenuLabel>
              <ContextMenuRadioGroup defaultValue="pedro">
                <ContextMenuRadioItem value="pedro">
                  Pedro Duarte
                </ContextMenuRadioItem>
                <ContextMenuRadioItem value="colm">
                  Colm Tuite
                </ContextMenuRadioItem>
              </ContextMenuRadioGroup>
            </ContextMenuGroup>
          </ContextMenuContent>
        </ContextMenu>
      </ParityRow>

      {/* The bar renders statically; open a menu to compare the panel. */}
      <ParityRow label="Menubar" img={figmaMenubar} imgWidth={325}>
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>File</MenubarTrigger>
            <MenubarContent className="sense">
              <MenubarItem>
                New Tab
                <MenubarShortcut>⌘T</MenubarShortcut>
              </MenubarItem>
              <MenubarItem>
                New Window
                <MenubarShortcut>⌘N</MenubarShortcut>
              </MenubarItem>
              <MenubarItem>New Incognito Window</MenubarItem>
              <MenubarSeparator />
              <MenubarSub>
                <MenubarSubTrigger>Share</MenubarSubTrigger>
                <MenubarSubContent className="sense">
                  <MenubarItem>Email link</MenubarItem>
                  <MenubarItem>Messages</MenubarItem>
                  <MenubarItem>Notes</MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
              <MenubarSeparator />
              <MenubarItem>
                Print...
                <MenubarShortcut>⌘P</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Edit</MenubarTrigger>
            <MenubarContent className="sense">
              <MenubarItem>
                Undo
                <MenubarShortcut>⌘Z</MenubarShortcut>
              </MenubarItem>
              <MenubarItem>
                Redo
                <MenubarShortcut>⇧⌘Z</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>View</MenubarTrigger>
            <MenubarContent className="sense">
              <MenubarItem>Reload</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Profiles</MenubarTrigger>
            <MenubarContent className="sense">
              <MenubarItem>Andy</MenubarItem>
              <MenubarItem>Benoit</MenubarItem>
              <MenubarItem>Luis</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </ParityRow>

      {/* Triggers render statically; open the popover to compare the panel. */}
      <ParityRow
        label="Navigation menu"
        img={figmaNavigationMenu}
        imgWidth={676}
      >
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Getting Started</NavigationMenuTrigger>
              <NavigationMenuContent className="sense">
                <ul className="grid w-64 gap-1">
                  <li>
                    <NavigationMenuLink href="#">
                      <div className="flex flex-col gap-1">
                        <div className="text-base font-strong text-foreground">
                          Introduction
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Re-usable components built with Base UI.
                        </p>
                      </div>
                    </NavigationMenuLink>
                  </li>
                  <li>
                    <NavigationMenuLink href="#">
                      <div className="flex flex-col gap-1">
                        <div className="text-base font-strong text-foreground">
                          Installation
                        </div>
                        <p className="text-sm text-muted-foreground">
                          How to install dependencies and structure your app.
                        </p>
                      </div>
                    </NavigationMenuLink>
                  </li>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Components</NavigationMenuTrigger>
              <NavigationMenuContent className="sense">
                <ul className="grid w-[512px] grid-cols-2 gap-1">
                  {componentLinks.map(([title, description]) => (
                    <li key={title}>
                      <NavigationMenuLink href="#">
                        <div className="flex flex-col gap-1">
                          <div className="text-base font-strong text-foreground">
                            {title}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {description}
                          </p>
                        </div>
                      </NavigationMenuLink>
                    </li>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                href="#"
                className={navigationMenuTriggerStyle()}
              >
                Docs
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </ParityRow>

      <ParityRow label="Breadcrumb" img={figmaBreadcrumb} imgWidth={623}>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Components</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1">
                  Components
                  <LuChevronDown className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="sense w-auto">
                  <DropdownMenuItem className="text-sm">
                    Documentation
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-sm">
                    Themes
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-sm">
                    GitHub
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Breadcrumb</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Breadcrumb</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </ParityRow>

      <ParityRow label="Tabs" img={figmaTabs} imgWidth={400}>
        <Tabs defaultValue="Overview" className="w-[400px]">
          <TabsList>
            {tabPanels.map(({ tab }) => (
              <TabsTrigger key={tab} value={tab}>
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabPanels.map(({ tab, body, footer }) => (
            <TabsContent
              key={tab}
              value={tab}
              className="flex flex-col gap-4 rounded-lg border border-border p-4"
            >
              <div className="flex flex-col gap-1">
                <p className="font-strong text-foreground">{tab}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
              <p className="text-sm text-muted-foreground">{footer}</p>
            </TabsContent>
          ))}
        </Tabs>
      </ParityRow>

      <ParityRow label="Tabs, underline" img={figmaTabsLine} imgWidth={269}>
        <Tabs defaultValue="Overview">
          <TabsList variant="line">
            {['Overview', 'Analytics', 'Reports'].map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </ParityRow>

      <ParityRow label="Sidebar" img={figmaSidebar} imgWidth={256}>
        <div className="w-full overflow-hidden rounded-lg border border-border">
          <SidebarProvider className="min-h-0 w-64">
            <Sidebar collapsible="none" className="h-auto">
              <SidebarHeader>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton size="lg">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <LuBookOpen />
                      </div>
                      <div className="flex flex-col gap-0.5 leading-none">
                        <span className="font-strong">Documentation</span>
                        <span className="text-xs text-muted-foreground">
                          v1.0.1
                        </span>
                      </div>
                      <LuChevronsUpDown className="ms-auto" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
                <SidebarGroup className="py-0">
                  <SidebarGroupContent>
                    <SidebarInput placeholder="Search" />
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarHeader>
              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupLabel>Getting started</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {['Installation', 'Project Structure'].map((item) => (
                        <SidebarMenuItem key={item}>
                          <SidebarMenuButton>{item}</SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                  <SidebarGroupLabel>
                    Building Your Application
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {buildingYourApplication.map((item) => (
                        <SidebarMenuItem key={item}>
                          <SidebarMenuButton
                            isActive={item === 'Data Fetching'}
                          >
                            {item}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                  <SidebarGroupLabel>API Reference</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {['Components', 'File Conventions'].map((item) => (
                        <SidebarMenuItem key={item}>
                          <SidebarMenuButton>{item}</SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
            </Sidebar>
          </SidebarProvider>
        </div>
      </ParityRow>

      <ParityRow label="Pagination" img={figmaPagination} imgWidth={433}>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                2
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">3</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </ParityRow>

      {/* cmdk renders inline, so the real panel is compared directly. */}
      <ParityRow label="Command" img={figmaCommand} imgWidth={384}>
        {/* value="" suppresses cmdk's automatic first-item highlight so the
            static panel matches the Figma mock's no-selection state. */}
        <Command value="" className="w-96">
          <CommandInput placeholder="Type a command or search" />
          <CommandList className="max-h-none">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              <CommandItem>
                <LuCalendar />
                Calendar
              </CommandItem>
              <CommandItem>
                <LuSmile />
                Search Emoji
              </CommandItem>
              <CommandItem disabled>
                <LuCalculator />
                Calculator
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Settings">
              <CommandItem>
                <LuUser />
                Profile
                <CommandShortcut>⌘P</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <LuCreditCard />
                Billing
                <CommandShortcut>⌘B</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <LuSettings />
                Settings
                <CommandShortcut>⌘S</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </ParityRow>
    </div>
  ),
};
