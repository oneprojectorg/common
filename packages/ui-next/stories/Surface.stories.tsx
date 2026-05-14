import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId } from 'react';
import { LuBell, LuCheck } from 'react-icons/lu';

import { Button } from '@/components/Button';
import { Field, FieldDescription, FieldLabel, Input } from '@/components/Field';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Surface,
} from '@/components/Surface';

const meta: Meta<typeof Surface> = {
  title: 'shadcn/Surface',
  component: Surface,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Surface>;

export const Default: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your email below to create your account.
        </CardDescription>
        <CardAction>
          <Button variant="link" size="small">
            Sign in
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" placeholder="m@example.com" />
        </Field>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button className="w-full">Continue with email</Button>
        <Button variant="outline" className="w-full">
          Continue with Google
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const LoginForm: Story = {
  render: () => {
    const emailId = useId();
    const passwordId = useId();
    return (
      <Card className="w-96">
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account.
          </CardDescription>
          <CardAction>
            <Button variant="link" size="small">
              Sign up
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor={emailId}>Email</FieldLabel>
            <Input id={emailId} type="email" placeholder="m@example.com" />
          </Field>
          <Field>
            <FieldLabel htmlFor={passwordId}>Password</FieldLabel>
            <Input id={passwordId} type="password" />
            <FieldDescription className="text-right">
              <a href="#" className="text-primary hover:underline">
                Forgot your password?
              </a>
            </FieldDescription>
          </Field>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button className="w-full">Login</Button>
          <Button variant="outline" className="w-full">
            Login with Google
          </Button>
        </CardFooter>
      </Card>
    );
  },
};

const NOTIFICATIONS = [
  {
    title: 'Your call has been confirmed.',
    description: '1 hour ago',
  },
  {
    title: 'You have a new message!',
    description: '1 hour ago',
  },
  {
    title: 'Your subscription is expiring soon!',
    description: '2 hours ago',
  },
];

export const Notifications: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>You have 3 unread messages.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-md border p-3">
          <LuBell className="size-5" />
          <div className="flex-1 space-y-1">
            <p className="text-sm leading-none font-medium">
              Push notifications
            </p>
            <p className="text-muted-foreground text-sm">
              Send notifications to device.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {NOTIFICATIONS.map((n, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
              <div className="space-y-0.5">
                <p className="text-sm leading-none font-medium">{n.title}</p>
                <p className="text-muted-foreground text-sm">{n.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">
          <LuCheck className="size-4" />
          Mark all as read
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const Simple: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Card title</CardTitle>
        <CardDescription>Card description.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">Body content.</p>
      </CardContent>
    </Card>
  ),
};
