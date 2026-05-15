import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId } from 'react';

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Textarea,
} from '@/components/Field';
import { Button } from '@/components/ui/button';

const meta: Meta = {
  title: 'shadcn/Field',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

export const Vertical: Story = {
  render: () => {
    const id = useId();
    return (
      <Field>
        <FieldLabel htmlFor={id}>Email</FieldLabel>
        <Input id={id} placeholder="you@example.com" />
        <FieldDescription>We will not spam you.</FieldDescription>
      </Field>
    );
  },
};

export const Horizontal: Story = {
  render: () => {
    const id = useId();
    return (
      <Field orientation="horizontal">
        <FieldLabel htmlFor={id}>Email</FieldLabel>
        <Input id={id} placeholder="you@example.com" />
      </Field>
    );
  },
};

export const WithError: Story = {
  render: () => {
    const id = useId();
    return (
      <Field data-invalid="true">
        <FieldLabel htmlFor={id}>Email</FieldLabel>
        <Input id={id} aria-invalid placeholder="you@example.com" />
        <FieldError errors={[{ message: 'Required' }]} />
      </Field>
    );
  },
};

export const WithIcon: Story = {
  render: () => {
    const id = useId();
    return (
      <Field>
        <FieldLabel htmlFor={id}>Search</FieldLabel>
        <Input
          id={id}
          placeholder="Search…"
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          }
        />
      </Field>
    );
  },
};

export const InputColors: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Input placeholder="Primary" />
      <Input color="muted" placeholder="Muted" />
      <Input color="error" placeholder="Error" />
    </div>
  ),
};

export const TextareaVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Textarea placeholder="Default textarea" />
      <Textarea variant="borderless" placeholder="Borderless" />
    </div>
  ),
};

export const Group: Story = {
  render: () => {
    const emailId = useId();
    const nameId = useId();
    return (
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={nameId}>Name</FieldLabel>
          <Input id={nameId} />
        </Field>
        <Field>
          <FieldLabel htmlFor={emailId}>Email</FieldLabel>
          <Input id={emailId} />
          <FieldDescription>Used for sign-in.</FieldDescription>
        </Field>
      </FieldGroup>
    );
  },
};

export const FieldSetStory: Story = {
  name: 'FieldSet + Legend',
  render: () => {
    const aId = useId();
    const bId = useId();
    return (
      <FieldSet>
        <FieldLegend>Account</FieldLegend>
        <FieldDescription>Update your account details.</FieldDescription>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={aId}>Username</FieldLabel>
            <Input id={aId} />
          </Field>
          <Field>
            <FieldLabel htmlFor={bId}>Bio</FieldLabel>
            <Textarea id={bId} />
          </Field>
        </FieldGroup>
      </FieldSet>
    );
  },
};

export const Separator_: Story = {
  name: 'FieldSeparator',
  render: () => (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="a">A</FieldLabel>
        <Input id="a" />
      </Field>
      <FieldSeparator>or</FieldSeparator>
      <Field>
        <FieldLabel htmlFor="b">B</FieldLabel>
        <Input id="b" />
      </Field>
    </FieldGroup>
  ),
};

export const InputGroupStory: Story = {
  name: 'InputGroup (compound input)',
  render: () => (
    <InputGroup>
      <InputGroupAddon>
        <span className="text-muted-foreground">@</span>
      </InputGroupAddon>
      <InputGroupInput placeholder="username" />
    </InputGroup>
  ),
};

export const FieldContentLayout: Story = {
  name: 'FieldContent (description + control)',
  render: () => {
    const id = useId();
    return (
      <Field orientation="horizontal">
        <FieldLabel htmlFor={id}>Marketing</FieldLabel>
        <FieldContent>
          <Input id={id} placeholder="Email" />
          <FieldDescription>Get the monthly newsletter.</FieldDescription>
        </FieldContent>
        <Button size="sm">Subscribe</Button>
      </Field>
    );
  },
};
