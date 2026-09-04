import { Button } from '@op/sense/Button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@op/sense/Card';
import { Input } from '@op/sense/Input';
import { Label } from '@op/sense/Label';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Card> = {
  title: 'Primitives/Card',
  component: Card,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Login to your account</CardTitle>
        <CardDescription>
          Enter your email below to login to your account.
        </CardDescription>
        <CardAction>
          <Button variant="link">Sign up</Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6">
          <div className="grid gap-2">
            <Label htmlFor="card-email">Email</Label>
            <Input id="card-email" type="email" placeholder="m@example.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="card-password">Password</Label>
            <Input id="card-password" type="password" placeholder="Password" />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button className="w-full">Login</Button>
        <Button variant="outline" className="w-full">
          Login with Google
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const Small: Story = {
  render: () => (
    <Card size="sm" className="w-96">
      <CardHeader>
        <CardTitle>Weekly digest</CardTitle>
        <CardDescription>Sent every Monday at 9:00.</CardDescription>
      </CardHeader>
      <CardContent>
        A summary of the proposals, votes, and comments from your groups.
      </CardContent>
    </Card>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Delete workspace</CardTitle>
        <CardDescription>
          This action cannot be undone. All data will be permanently removed.
        </CardDescription>
      </CardHeader>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button variant="destructive">Delete</Button>
      </CardFooter>
    </Card>
  ),
};
