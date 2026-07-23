import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@op/sense/Sidebar';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  LuBookOpen,
  LuBuilding2,
  LuChevronsUpDown,
  LuEllipsis,
  LuHouse,
  LuInbox,
  LuScale,
  LuSettings,
} from 'react-icons/lu';

import { withSense } from './sense';

const meta: Meta<typeof Sidebar> = {
  title: 'Sense/Primitives/Sidebar',
  component: Sidebar,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Sidebar>;

const buildingYourApplication = [
  'Routing',
  'Data Fetching',
  'Rendering',
  'Caching',
  'Styling',
  'Optimizing',
];

// Rendered non-collapsible inside a bounded container so the sidebar can be
// inspected without taking over the Storybook canvas.
export const Default: Story = {
  render: () => (
    <div className="w-64 overflow-hidden rounded-lg border">
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
              <SidebarGroupLabel>Building Your Application</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {buildingYourApplication.map((item) => (
                    <SidebarMenuItem key={item}>
                      <SidebarMenuButton isActive={item === 'Data Fetching'}>
                        {item}
                      </SidebarMenuButton>
                      {item === 'Caching' && (
                        <SidebarMenuBadge>12</SidebarMenuBadge>
                      )}
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
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                    FK
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-strong">Frida Kahlo</span>
                    <span className="text-xs text-muted-foreground">
                      frida@example.com
                    </span>
                  </div>
                  <LuChevronsUpDown className="ms-auto" />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
      </SidebarProvider>
    </div>
  ),
};

const workspaceNav = [
  { label: 'Home', icon: LuHouse },
  { label: 'Inbox', icon: LuInbox, badge: '3' },
  { label: 'Decisions', icon: LuScale, action: true },
  { label: 'Organizations', icon: LuBuilding2 },
  { label: 'Settings', icon: LuSettings },
];

// Icon-collapsible variant: use the trigger in the inset header to collapse
// the sidebar to its icon rail. Exercises icon buttons, the menu action, and
// the badge (all size-sensitive: rail width, action/badge vertical centering).
export const CollapsibleIcons: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <LuBookOpen />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-strong">Common</span>
                  <span className="text-xs text-muted-foreground">
                    Workspace
                  </span>
                </div>
                <LuChevronsUpDown className="ms-auto" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {workspaceNav.map(({ label, icon: Icon, badge, action }) => (
                  <SidebarMenuItem key={label}>
                    <SidebarMenuButton
                      isActive={label === 'Decisions'}
                      // Tooltip content portals outside the `.sense` wrapper,
                      // so it re-scopes itself like other portaled content.
                      tooltip={{ children: label, className: 'sense' }}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                    {badge ? (
                      <SidebarMenuBadge>{badge}</SidebarMenuBadge>
                    ) : null}
                    {action ? (
                      <SidebarMenuAction showOnHover>
                        <LuEllipsis />
                        <span className="sr-only">More</span>
                      </SidebarMenuAction>
                    ) : null}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <span className="text-sm text-muted-foreground">
            Toggle the sidebar to check the icon rail
          </span>
        </header>
        <div className="flex-1 p-4 text-sm text-muted-foreground">
          Content area
        </div>
      </SidebarInset>
    </SidebarProvider>
  ),
};
