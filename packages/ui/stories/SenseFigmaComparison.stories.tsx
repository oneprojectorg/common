import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@op/sense/InputGroup';
import { Select, SelectTrigger, SelectValue } from '@op/sense/Select';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';

import figmaFormInputsLight from './assets/figma/form-inputs-light.png';

// Figma parity: the committed design screenshot next to the live @op/sense
// render of the same cases. Source nodes are listed in
// assets/figma/figma-nodes.json — refresh the PNGs from there when the
// design library changes.
//
// The design is authored at a 16px root font-size; the app root is still
// smaller, so these stories force 16px on <html> to compare at true design
// scale. Screenshots are 1x exports: 1 image pixel = 1 CSS pixel.

const meta: Meta = {
  title: 'Sense Comparison/Figma Parity',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => {
      useEffect(() => {
        const previous = document.documentElement.style.fontSize;
        document.documentElement.style.fontSize = '16px';
        return () => {
          document.documentElement.style.fontSize = previous;
        };
      }, []);
      return <Story />;
    },
  ],
};

export default meta;

type Story = StoryObj;

export const FormInputs: Story = {
  name: 'Form inputs',
  render: () => (
    <div className="flex gap-8 p-8">
      <div className="min-w-0 shrink-0 overflow-auto">
        <ParityColumnHeading>Figma (Input page, Light)</ParityColumnHeading>
        <img
          src={figmaFormInputsLight}
          alt="Figma mock of the form input primitives"
          width={1252}
          height={2372}
          className="max-w-none"
        />
      </div>
      <div className="sense min-w-0">
        <ParityColumnHeading>@op/sense (live)</ParityColumnHeading>
        <div className="flex w-[22.5rem] flex-col gap-16 pt-32">
          <Input placeholder="Enter text" />

          <Field>
            <FieldLabel htmlFor="parity-username">Username</FieldLabel>
            <Input id="parity-username" placeholder="Matt Wierzbicki" />
            <FieldDescription>
              Use the Field component if you want to use Input with Label and
              description
            </FieldDescription>
          </Field>

          <Field data-disabled="true">
            <FieldLabel htmlFor="parity-disabled">Username</FieldLabel>
            <Input
              id="parity-disabled"
              placeholder="Matt Wierzbicki"
              disabled
            />
            <FieldDescription>
              Use the Field component if you want to use Input with Label and
              description
            </FieldDescription>
          </Field>

          <Field data-invalid="true">
            <FieldLabel htmlFor="parity-invalid">Username</FieldLabel>
            <Input
              id="parity-invalid"
              defaultValue="Matt Wierzbicki"
              aria-invalid="true"
            />
            <FieldDescription>
              Use the Field component if you want to use Input with Label and
              description
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="parity-file">Username</FieldLabel>
            <Input id="parity-file" type="file" />
            <FieldDescription>
              Use the Field component if you want to use Input with Label and
              description
            </FieldDescription>
          </Field>

          <div className="flex w-[30rem] gap-4 self-center">
            <Field>
              <FieldLabel htmlFor="parity-first">First Name</FieldLabel>
              <Input id="parity-first" placeholder="Jordan" />
            </Field>
            <Field>
              <FieldLabel htmlFor="parity-last">Last Name</FieldLabel>
              <Input id="parity-last" placeholder="Lee" />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="parity-required">
              Required Field <span className="text-destructive">*</span>
            </FieldLabel>
            <Input id="parity-required" placeholder="This field is required" />
            <FieldDescription>
              Add the star (*) with destructive color variable applied in the
              label above
            </FieldDescription>
          </Field>

          <Field className="relative">
            <Badge variant="secondary" className="absolute top-0 right-0">
              Beta
            </Badge>
            <FieldLabel htmlFor="parity-webhook">Webhook URL</FieldLabel>
            <Input
              id="parity-webhook"
              placeholder="https://www.shadcndesign.com"
            />
            <FieldDescription>
              You can add Badge with position absolute in the parent frame
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="parity-website">Website URL</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>https://</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="parity-website"
                placeholder="shadcndesign.com"
              />
            </InputGroup>
          </Field>

          <Field>
            <FieldLabel htmlFor="parity-search">Search</FieldLabel>
            <div className="flex gap-2">
              <InputGroup>
                <InputGroupInput
                  id="parity-search"
                  placeholder="Type to search..."
                />
              </InputGroup>
              <Button variant="outline">Search</Button>
            </div>
          </Field>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="parity-name">Name</FieldLabel>
              <Input id="parity-name" placeholder="ShadcnDesign" />
            </Field>
            <Field>
              <FieldLabel htmlFor="parity-email">Email</FieldLabel>
              <Input id="parity-email" placeholder="hi@shadcndesign.com" />
              <FieldDescription>
                We&rsquo;ll never share your email with anyone.
              </FieldDescription>
            </Field>
            <div className="flex gap-4">
              <Field>
                <FieldLabel>Phone</FieldLabel>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="+1 (123) 123-123" />
                  </SelectTrigger>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Country</FieldLabel>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Poland" />
                  </SelectTrigger>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="parity-address">Address</FieldLabel>
              <Input id="parity-address" placeholder="ul. Suchego Chleba 3" />
            </Field>
            <div className="flex gap-3">
              <Button>Submit</Button>
              <Button variant="outline">Cancel</Button>
            </div>
          </FieldGroup>
        </div>
      </div>
    </div>
  ),
};

function ParityColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="pb-4 font-mono text-xs text-muted-foreground uppercase">
      {children}
    </p>
  );
}
