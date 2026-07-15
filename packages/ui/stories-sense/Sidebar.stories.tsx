import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@op/sense/Sidebar';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuBookOpen, LuChevronsUpDown } from 'react-icons/lu';

import { withSense } from './sense';

const meta: Meta<typeof Sidebar> = {
  title: 'Sense/Sidebar',
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
    <div className="w-64 overflow-hidden rounded-lg border border-border">
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
                  <LuChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarInput placeholder="Search" />
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
                  <LuChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
      </SidebarProvider>
    </div>
  ),
};
