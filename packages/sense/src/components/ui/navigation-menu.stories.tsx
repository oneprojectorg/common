import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@op/sense/NavigationMenu';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuCircle, LuCircleCheck, LuCircleDashed } from 'react-icons/lu';

const meta: Meta<typeof NavigationMenu> = {
  title: 'Primitives/NavigationMenu',
  component: NavigationMenu,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof NavigationMenu>;

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

export const Default: Story = {
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Getting Started</NavigationMenuTrigger>
          <NavigationMenuContent>
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
          <NavigationMenuContent>
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
          <NavigationMenuTrigger>With Icon</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-48">
              <li>
                <NavigationMenuLink href="#">
                  <LuCircleDashed />
                  Backlog
                </NavigationMenuLink>
                <NavigationMenuLink href="#">
                  <LuCircle />
                  To Do
                </NavigationMenuLink>
                <NavigationMenuLink href="#">
                  <LuCircleCheck />
                  Done
                </NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#" className={navigationMenuTriggerStyle()}>
            Docs
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};
