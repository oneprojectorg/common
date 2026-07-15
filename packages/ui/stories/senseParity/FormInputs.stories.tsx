import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import { ButtonGroup } from '@op/sense/ButtonGroup';
import { Checkbox } from '@op/sense/Checkbox';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@op/sense/Combobox';
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@op/sense/InputOTP';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Slider } from '@op/sense/Slider';
import { Switch } from '@op/sense/Switch';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import { LuGlobe, LuInfo } from 'react-icons/lu';

import figmaCheckboxDescription from '../assets/figma/checkbox-description.png';
import figmaCheckboxGroup from '../assets/figma/checkbox-group.png';
import figmaCheckbox from '../assets/figma/checkbox.png';
import figmaCombobox from '../assets/figma/combobox.png';
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
import figmaInputOtp from '../assets/figma/input-otp.png';
import figmaRadioGroup from '../assets/figma/radio-group.png';
import figmaSelectTrigger from '../assets/figma/select-trigger.png';
import figmaSlider from '../assets/figma/slider.png';
import figmaSwitch from '../assets/figma/switch.png';
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

// Form-input components are width-fluid, so the live preview would stretch
// past the mock. Cap it at the mock's width — scoped to this family only;
// ParityRow itself stays deliberately fluid for the other families.
function FormParityRow({
  children,
  ...props
}: ComponentProps<typeof ParityRow>) {
  return (
    <ParityRow {...props}>
      <div style={{ maxWidth: props.imgWidth }}>{children}</div>
    </ParityRow>
  );
}

// First item with a null value acts as the placeholder: the select's initial
// value is null, so SelectValue renders that item's label.
const selectItems = [
  { value: null, label: 'Placeholder' },
  { value: 'option-1', label: 'Option 1' },
  { value: 'option-2', label: 'Option 2' },
  { value: 'option-3', label: 'Option 3' },
];

const phoneItems = [
  { value: null, label: '+1 (123) 123-123' },
  { value: 'pl', label: '+48 123 456 789' },
  { value: 'uk', label: '+44 1234 567890' },
];

const countryItems = [
  { value: null, label: 'Poland' },
  { value: 'germany', label: 'Germany' },
  { value: 'france', label: 'France' },
  { value: 'usa', label: 'United States' },
];

export const FormInputs: Story = {
  name: 'Form inputs',
  render: () => (
    <div className="flex flex-col gap-10 p-8">
      <ParityGridHeader />

      <FormParityRow label="Input" img={figmaInputDefault} imgWidth={360}>
        <Input placeholder="Enter text" />
      </FormParityRow>

      <FormParityRow label="Field" img={figmaFieldUsername} imgWidth={360}>
        <Field>
          <FieldLabel htmlFor="parity-username">Username</FieldLabel>
          <Input id="parity-username" placeholder="Matt Wierzbicki" />
          <FieldDescription>
            Use the Field component if you want to use Input with Label and
            description
          </FieldDescription>
        </Field>
      </FormParityRow>

      <FormParityRow label="Disabled" img={figmaFieldDisabled} imgWidth={360}>
        {/* Figma mock fades only the input; whole-field fade kept on purpose,
            flagged to design */}
        <Field data-disabled="true">
          <FieldLabel htmlFor="parity-disabled">Username</FieldLabel>
          <Input id="parity-disabled" placeholder="Matt Wierzbicki" disabled />
          <FieldDescription>
            Use the Field component if you want to use Input with Label and
            description
          </FieldDescription>
        </Field>
      </FormParityRow>

      <FormParityRow label="Invalid" img={figmaFieldInvalid} imgWidth={366}>
        <Field data-invalid="true">
          <FieldLabel htmlFor="parity-invalid">Username</FieldLabel>
          <Input
            id="parity-invalid"
            placeholder="Matt Wierzbicki"
            aria-invalid="true"
          />
          <FieldDescription>
            Use the Field component if you want to use Input with Label and
            description
          </FieldDescription>
        </Field>
      </FormParityRow>

      <FormParityRow label="File" img={figmaFieldFile} imgWidth={360}>
        <Field>
          <FieldLabel htmlFor="parity-file">Username</FieldLabel>
          <Input id="parity-file" type="file" />
          <FieldDescription>
            Use the Field component if you want to use Input with Label and
            description
          </FieldDescription>
        </Field>
      </FormParityRow>

      <FormParityRow
        label="Field group"
        img={figmaFieldGroupNames}
        imgWidth={480}
      >
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
      </FormParityRow>

      <FormParityRow label="Required" img={figmaFieldRequired} imgWidth={360}>
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
      </FormParityRow>

      <FormParityRow label="With badge" img={figmaFieldBadge} imgWidth={360}>
        <Field className="relative">
          {/* max-w-fit: Field's vertical orientation sets *:w-full, which would
              stretch the absolutely-positioned badge over the label */}
          <Badge
            variant="secondary"
            className="absolute top-0 right-0 max-w-fit"
          >
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
      </FormParityRow>

      <FormParityRow
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
            <InputGroupAddon align="inline-end">
              <LuInfo />
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </FormParityRow>

      <FormParityRow
        label="With button"
        img={figmaFieldSearchButton}
        imgWidth={360}
      >
        <Field>
          <FieldLabel htmlFor="parity-search">Search</FieldLabel>
          <ButtonGroup>
            <InputGroup>
              <InputGroupInput
                id="parity-search"
                type="search"
                placeholder="Type to search..."
              />
            </InputGroup>
            <Button variant="outline">Search</Button>
          </ButtonGroup>
        </Field>
      </FormParityRow>

      <FormParityRow label="Checkbox" img={figmaCheckbox} imgWidth={230}>
        <div className="flex items-center gap-2">
          <Checkbox defaultChecked id="parity-checkbox-terms" />
          <label htmlFor="parity-checkbox-terms" className="text-sm">
            Accept terms and conditions
          </label>
        </div>
      </FormParityRow>

      <FormParityRow
        label="Checkbox with description"
        img={figmaCheckboxDescription}
        imgWidth={425}
      >
        <div className="flex items-start gap-2">
          <Checkbox defaultChecked id="parity-checkbox-described" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="parity-checkbox-described" className="text-sm">
              Accept terms and conditions
            </label>
            <p className="text-sm text-muted-foreground">
              By clicking this checkbox, you agree to the terms and conditions.
            </p>
          </div>
        </div>
      </FormParityRow>

      <FormParityRow
        label="Checkbox group"
        img={figmaCheckboxGroup}
        imgWidth={219}
      >
        <div className="flex flex-col gap-4">
          {[
            ['technology', 'Technology News', true],
            ['product', 'Product Updates', true],
            ['tips', 'Tips & Tricks', true],
            ['events', 'Events & Webinars', false],
          ].map(([value, title, checked]) => (
            <div key={String(value)} className="flex items-center gap-2">
              <Checkbox
                defaultChecked={Boolean(checked)}
                id={`parity-checkbox-${value}`}
              />
              <label htmlFor={`parity-checkbox-${value}`} className="text-sm">
                {title}
              </label>
            </div>
          ))}
        </div>
      </FormParityRow>

      <FormParityRow label="Radio group" img={figmaRadioGroup} imgWidth={371}>
        <RadioGroup defaultValue="starter" className="gap-3">
          {[
            ['starter', 'Starter Plan', 'Perfect for small businesses.'],
            ['pro', 'Pro Plan', 'Advanced features with more storage.'],
            ['enterprise', 'Enterprise Plan', 'For large teams.'],
          ].map(([value, title, description]) => (
            <div key={value} className="flex items-start gap-2">
              <RadioGroupItem
                value={value}
                id={`parity-radio-${value}`}
                className="mt-0"
              />
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`parity-radio-${value}`}
                  className="text-label font-strong"
                >
                  {title}
                </label>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </RadioGroup>
      </FormParityRow>

      <FormParityRow label="Switch" img={figmaSwitch} imgWidth={320}>
        <div className="flex flex-col gap-4">
          {[
            ['on', 'Switch Text', 'This is a switch description.', true],
            ['off', 'Switch Text', 'This is a switch description.', false],
          ].map(([key, title, description, checked]) => (
            <div key={String(key)} className="flex items-start gap-3">
              <Switch defaultChecked={Boolean(checked)} />
              <div className="flex flex-col gap-0.5">
                <p className="text-base font-strong">{title}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </FormParityRow>

      <FormParityRow label="Slider" img={figmaSlider} imgWidth={400}>
        <Slider defaultValue={[62]} />
      </FormParityRow>

      <FormParityRow label="Select" img={figmaSelectTrigger} imgWidth={200}>
        <Select items={selectItems}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="sense">
            {selectItems.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormParityRow>

      <FormParityRow label="Combobox" img={figmaCombobox} imgWidth={228}>
        <Combobox
          items={['Next.js', 'SvelteKit', 'Remix', 'Nuxt', 'Astro', 'Vite']}
        >
          <ComboboxInput placeholder="Placeholder" className="w-[228px]">
            <InputGroupAddon>
              <LuGlobe />
            </InputGroupAddon>
          </ComboboxInput>
          <ComboboxContent className="sense">
            <ComboboxEmpty>No results found.</ComboboxEmpty>
            <ComboboxList>
              {(item: string) => (
                <ComboboxItem key={item} value={item}>
                  {item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </FormParityRow>

      <FormParityRow label="Input OTP" img={figmaInputOtp} imgWidth={296}>
        <InputOTP maxLength={6} defaultValue="12">
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </FormParityRow>

      <FormParityRow label="Form" img={figmaForm} imgWidth={360}>
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
              <Select items={phoneItems}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="sense">
                  {phoneItems.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Country</FieldLabel>
              <Select items={countryItems}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="sense">
                  {countryItems.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
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
      </FormParityRow>
    </div>
  ),
};
