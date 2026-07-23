import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
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
  FieldTitle,
} from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { Switch } from '@op/sense/Switch';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof Field> = {
  title: 'Sense/Primitives/Field',
  component: Field,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Field>;

export const Default: Story = {
  render: () => (
    <Field className="max-w-sm">
      <FieldLabel htmlFor="field-username">Username</FieldLabel>
      <Input id="field-username" placeholder="Matt Wierzbicki" />
      <FieldDescription>
        Use the Field component if you want to use Input with Label and
        description
      </FieldDescription>
    </Field>
  ),
};

export const Invalid: Story = {
  render: () => (
    <Field data-invalid="true" className="max-w-sm">
      <FieldLabel htmlFor="field-invalid">Username</FieldLabel>
      <Input
        id="field-invalid"
        placeholder="Matt Wierzbicki"
        aria-invalid="true"
      />
      <FieldError errors={[{ message: 'Username is already taken.' }]} />
    </Field>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Field data-disabled="true" className="max-w-sm">
      <FieldLabel htmlFor="field-disabled">Username</FieldLabel>
      <Input id="field-disabled" placeholder="Matt Wierzbicki" disabled />
      <FieldDescription>
        Use the Field component if you want to use Input with Label and
        description
      </FieldDescription>
    </Field>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <Field orientation="horizontal" className="max-w-sm">
      <FieldContent>
        <FieldTitle>Notifications</FieldTitle>
        <FieldDescription>
          Receive emails about new decisions and comments.
        </FieldDescription>
      </FieldContent>
      <Switch defaultChecked />
    </Field>
  ),
};

export const WithFieldSet: Story = {
  render: () => (
    <FieldSet className="max-w-sm">
      <FieldLegend>Notification preferences</FieldLegend>
      <FieldDescription>Choose how you want to hear from us.</FieldDescription>
      {/* checkbox-group slot opts into the tighter gap-3 row spacing */}
      <FieldGroup data-slot="checkbox-group">
        {[
          ['email', 'Email'],
          ['sms', 'SMS'],
          ['push', 'Push notifications'],
        ].map(([value, label]) => (
          <Field key={value} orientation="horizontal">
            <Checkbox id={`field-channel-${value}`} />
            <FieldLabel htmlFor={`field-channel-${value}`}>{label}</FieldLabel>
          </Field>
        ))}
      </FieldGroup>
    </FieldSet>
  ),
};

export const Form: Story = {
  render: () => (
    <FieldGroup className="max-w-sm">
      <Field>
        <FieldLabel htmlFor="field-form-name">Name</FieldLabel>
        <Input id="field-form-name" placeholder="Frida Kahlo" />
      </Field>
      <Field>
        <FieldLabel htmlFor="field-form-email">Email</FieldLabel>
        <Input id="field-form-email" placeholder="hi@example.com" />
        <FieldDescription>
          We&rsquo;ll never share your email with anyone.
        </FieldDescription>
      </Field>
      <FieldSeparator>Optional</FieldSeparator>
      <Field>
        <FieldLabel htmlFor="field-form-website">Website</FieldLabel>
        <Input id="field-form-website" placeholder="https://example.com" />
      </Field>
      <div className="flex gap-3">
        <Button>Submit</Button>
        <Button variant="outline">Cancel</Button>
      </div>
    </FieldGroup>
  ),
};
