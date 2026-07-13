import {
  Breadcrumb,
  BreadcrumbEllipsis,
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
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
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
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from '@op/sense/Menubar';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
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
import { Tabs, TabsList, TabsTrigger } from '@op/sense/Tabs';
import type { Meta, StoryObj } from '@storybook/react-vite';

import figmaBreadcrumb from '../assets/figma/breadcrumb.png';
import figmaCommand from '../assets/figma/command.png';
import figmaContextMenu from '../assets/figma/context-menu.png';
import figmaDropdownMenu from '../assets/figma/dropdown-menu.png';
import figmaMenubar from '../assets/figma/menubar.png';
import figmaNavigationMenu from '../assets/figma/navigation-menu.png';
import figmaPagination from '../assets/figma/pagination.png';
import figmaSidebar from '../assets/figma/sidebar.png';
import figmaTabs from '../assets/figma/tabs.png';
import { ParityGridHeader, ParityRow, withDesignScale } from './Parity';

// Figma parity for the menus & navigation family. See Parity.tsx for the
// conventions.
//
// Menu panels are portal-based, so the live column renders each component's
// trigger wired to the real component — open it interactively to compare
// against the Figma export. Breadcrumb, tabs, pagination, and command render
// statically.

const meta: Meta = {
  title: 'Sense Comparison/Figma Parity/Menus & navigation',
  parameters: { layout: 'fullscreen' },
  decorators: [withDesignScale],
};

export default meta;

type Story = StoryObj;

export const MenusNavigation: Story = {
  name: 'Menus & navigation',
  render: () => (
    <div className="flex flex-col gap-10 p-8">
      <ParityGridHeader />

      {/* Portal-based: open the menu interactively to compare. */}
      <ParityRow label="Dropdown menu" img={figmaDropdownMenu} imgWidth={170}>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>
            Open menu
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
            <DropdownMenuItem variant="destructive">
              Log out
              <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ParityRow>

      {/* Portal-based: right-click the frame to compare the open menu. */}
      <ParityRow label="Context menu" img={figmaContextMenu} imgWidth={290}>
        <ContextMenu>
          <ContextMenuTrigger className="flex h-24 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            Right-click here
          </ContextMenuTrigger>
          <ContextMenuContent className="sense w-64">
            <ContextMenuGroup>
              <ContextMenuLabel>Actions</ContextMenuLabel>
              <ContextMenuItem>
                Back
                <ContextMenuShortcut>⌘[</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem>
                Reload
                <ContextMenuShortcut>⌘R</ContextMenuShortcut>
              </ContextMenuItem>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive">Delete</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </ParityRow>

      {/* The bar renders statically; open a menu to compare the panel. */}
      <ParityRow label="Menubar" img={figmaMenubar} imgWidth={202}>
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
              <MenubarSeparator />
              <MenubarItem>Print…</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Edit</MenubarTrigger>
            <MenubarContent className="sense">
              <MenubarItem>Undo</MenubarItem>
              <MenubarItem>Redo</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>View</MenubarTrigger>
            <MenubarContent className="sense">
              <MenubarItem>Reload</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </ParityRow>

      {/* Triggers render statically; open the popover to compare the panel. */}
      <ParityRow
        label="Navigation menu"
        img={figmaNavigationMenu}
        imgWidth={524}
      >
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Getting started</NavigationMenuTrigger>
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
              <NavigationMenuLink href="#">Documentation</NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </ParityRow>

      <ParityRow label="Breadcrumb" img={figmaBreadcrumb} imgWidth={615}>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Components</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </ParityRow>

      <ParityRow label="Tabs" img={figmaTabs} imgWidth={285}>
        <Tabs defaultValue="account">
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        </Tabs>
      </ParityRow>

      {/* Sidebar needs the full SidebarProvider layout scaffold (fixed
          full-height positioning), so it is compared against the mock only. */}
      <ParityRow label="Sidebar" img={figmaSidebar} imgWidth={256}>
        <p className="text-sm text-muted-foreground">
          Mock only — the sidebar requires the full-page SidebarProvider
          scaffold; verify in the app shell.
        </p>
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
        <Command>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              <CommandItem>Calendar</CommandItem>
              <CommandItem>Search Emoji</CommandItem>
              <CommandItem>Calculator</CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Settings">
              <CommandItem>
                Profile
                <CommandShortcut>⌘P</CommandShortcut>
              </CommandItem>
              <CommandItem>
                Billing
                <CommandShortcut>⌘B</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </ParityRow>
    </div>
  ),
};
