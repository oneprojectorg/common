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

import figmaFieldBadge from '../assets/figma/field-badge.png';
import figmaFieldDisabled from '../assets/figma/field-disabled.png';
import figmaFieldFile from '../assets/figma/field-file.png';
import figmaFieldGroupNames from '../assets/figma/field-group-names.png';
import figmaFieldInvalid from '../assets/figma/field-invalid.png';
import figmaFieldRequired from '../assets/figma/field-required.png';
import figmaFieldSearchButton from '../assets/figma/field-search-button.png';
import figmaFieldUsername from '../assets/figma/field-username.png';
import figmaFieldWebsiteAddon from '../assets/figma/field-website-addon.png';
import figmaForm from '../assets/figma/form.png';
import figmaInputDefault from '../assets/figma/input-default.png';
import { ParityGridHeader, ParityRow, withDesignScale } from './Parity';

// Figma parity for the form input family (Input page of the Common Sense
// file). See Parity.tsx for the conventions.

const meta: Meta = {
  title: 'Sense Comparison/Figma Parity/Form inputs',
  parameters: { layout: 'fullscreen' },
  decorators: [withDesignScale],
};

export default meta;

type Story = StoryObj;

export const FormInputs: Story = {
  name: 'Form inputs',
  render: () => (
    <div className="flex flex-col gap-10 p-8">
      <ParityGridHeader />

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
