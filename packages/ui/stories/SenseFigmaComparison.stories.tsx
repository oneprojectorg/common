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

import figmaFieldBadge from './assets/figma/field-badge.png';
import figmaFieldDisabled from './assets/figma/field-disabled.png';
import figmaFieldFile from './assets/figma/field-file.png';
import figmaFieldGroupNames from './assets/figma/field-group-names.png';
import figmaFieldInvalid from './assets/figma/field-invalid.png';
import figmaFieldRequired from './assets/figma/field-required.png';
import figmaFieldSearchButton from './assets/figma/field-search-button.png';
import figmaFieldUsername from './assets/figma/field-username.png';
import figmaFieldWebsiteAddon from './assets/figma/field-website-addon.png';
import figmaForm from './assets/figma/form.png';
import figmaInputDefault from './assets/figma/input-default.png';

// Figma parity: committed design exports next to the live @op/sense render of
// the same case, one row per case. Source nodes are listed in
// assets/figma/figma-nodes.json — refresh the PNGs from there when the design
// library changes.
//
// Screenshots are @2x exports rendered at half their pixel size, so they stay
// crisp on retina displays and 1 rendered CSS pixel = 1 design pixel.
//
// The design is authored at a 16px root font-size; the app root is still
// smaller, so these stories force 16px on <html> to compare at true design
// scale.

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
    <div className="flex flex-col gap-10 p-8">
      <div className="grid w-fit grid-cols-[12rem_31rem_31rem] gap-x-8">
        <ParityHeading>Case</ParityHeading>
        <ParityHeading>Figma (@2x)</ParityHeading>
        <ParityHeading>@op/sense (live)</ParityHeading>
      </div>

      <ParityRow label="Input" img={figmaInputDefault} imgWidth={360}>
        <Input placeholder="Enter text" />
      </ParityRow>

      <ParityRow label="Field" img={figmaFieldUsername} imgWidth={360}>
        <Field>
          <FieldLabel htmlFor="parity-username">Username</FieldLabel>
          <Input id="parity-username" placeholder="Matt Wierzbicki" />
          <FieldDescription>
            Use the Field component if you want to use Input with Label and
            description
          </FieldDescription>
        </Field>
      </ParityRow>

      <ParityRow label="Disabled" img={figmaFieldDisabled} imgWidth={360}>
        <Field data-disabled="true">
          <FieldLabel htmlFor="parity-disabled">Username</FieldLabel>
          <Input id="parity-disabled" placeholder="Matt Wierzbicki" disabled />
          <FieldDescription>
            Use the Field component if you want to use Input with Label and
            description
          </FieldDescription>
        </Field>
      </ParityRow>

      <ParityRow label="Invalid" img={figmaFieldInvalid} imgWidth={366}>
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
      </ParityRow>

      <ParityRow label="File" img={figmaFieldFile} imgWidth={360}>
        <Field>
          <FieldLabel htmlFor="parity-file">Username</FieldLabel>
          <Input id="parity-file" type="file" />
          <FieldDescription>
            Use the Field component if you want to use Input with Label and
            description
          </FieldDescription>
        </Field>
      </ParityRow>

      <ParityRow label="Field group" img={figmaFieldGroupNames} imgWidth={480}>
        <div className="flex gap-4">
          <Field>
            <FieldLabel htmlFor="parity-first">First Name</FieldLabel>
            <Input id="parity-first" placeholder="Jordan" />
          </Field>
          <Field>
            <FieldLabel htmlFor="parity-last">Last Name</FieldLabel>
            <Input id="parity-last" placeholder="Lee" />
          </Field>
        </div>
      </ParityRow>

      <ParityRow label="Required" img={figmaFieldRequired} imgWidth={360}>
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
      </ParityRow>

      <ParityRow label="With badge" img={figmaFieldBadge} imgWidth={360}>
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
      </ParityRow>

      <ParityRow
        label="Inline addon"
        img={figmaFieldWebsiteAddon}
        imgWidth={360}
      >
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
      </ParityRow>

      <ParityRow
        label="With button"
        img={figmaFieldSearchButton}
        imgWidth={360}
      >
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
      </ParityRow>

      <ParityRow label="Form" img={figmaForm} imgWidth={360}>
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
      </ParityRow>
    </div>
  ),
};

function ParityRow({
  label,
  img,
  imgWidth,
  children,
}: {
  label: string;
  img: string;
  /** Rendered CSS width: half the @2x export's pixel width. */
  imgWidth: number;
  children: React.ReactNode;
}) {
  return (
    <div className="grid w-fit grid-cols-[12rem_31rem_31rem] items-start gap-x-8 border-t border-neutral-gray1 pt-6">
      <p className="font-mono text-xs text-neutral-gray4 uppercase">{label}</p>
      <div className="min-w-0">
        <img
          src={img}
          alt={`Figma mock: ${label}`}
          style={{ width: imgWidth }}
          className="max-w-none"
        />
      </div>
      <div className="sense min-w-0">
        <div style={{ width: imgWidth }}>{children}</div>
      </div>
    </div>
  );
}

function ParityHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs text-neutral-gray4 uppercase">{children}</p>
  );
}
