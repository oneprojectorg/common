import { Checkbox } from '@op/sense/Checkbox';
import { OptionBox } from '@op/sense/OptionBox';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof OptionBox> = {
  title: 'Composites/OptionBox',
  component: OptionBox,
  tags: ['autodocs'],
  argTypes: {
    width: { control: 'inline-radio', options: ['hug', 'fill'] },
    controlPlacement: { control: 'inline-radio', options: ['start', 'end'] },
  },
};

export default meta;

type Story = StoryObj<typeof OptionBox>;

// The control lives inside a real `<label>`, so the whole box is clickable and
// the input keeps its native keyboard behaviour. `htmlFor` must match the
// control's `id`.
export const Default: Story = {
  args: {
    htmlFor: 'option-box-default',
    control: <Checkbox id="option-box-default" defaultChecked />,
    label: 'Housing and infrastructure',
    width: 'fill',
  },
};

export const WithDescription: Story = {
  args: {
    htmlFor: 'option-box-description',
    control: <Checkbox id="option-box-description" defaultChecked />,
    label: 'Participatory budgeting',
    description: 'Residents allocate a share of the capital budget directly.',
  },
};

// `hug` shrinks to the label — the horizontal category chips.
export const HugWidth: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {['Housing', 'Transit', 'Parks', 'Schools'].map((topic) => (
        <OptionBox
          key={topic}
          width="hug"
          htmlFor={`option-box-hug-${topic}`}
          control={<Checkbox id={`option-box-hug-${topic}`} />}
          label={topic}
        />
      ))}
    </div>
  ),
};

// `controlPlacement="end"` is logical, not physical — it pushes the control to
// the trailing edge, so it flips automatically in an RTL document.
export const ControlAtEnd: Story = {
  render: () => (
    <RadioGroup defaultValue="weekly" className="flex w-96 flex-col gap-3">
      {[
        { value: 'daily', label: 'Daily digest' },
        { value: 'weekly', label: 'Weekly digest' },
        { value: 'never', label: 'No email' },
      ].map((option) => (
        <OptionBox
          key={option.value}
          controlPlacement="end"
          htmlFor={`option-box-end-${option.value}`}
          control={
            <RadioGroupItem
              id={`option-box-end-${option.value}`}
              value={option.value}
            />
          }
          label={option.label}
        />
      ))}
    </RadioGroup>
  ),
};

// The accessory follows `controlPlacement` rather than taking a side of its
// own, so the two can never collide.
export const WithAccessory: Story = {
  render: () => (
    <RadioGroup defaultValue="ada" className="flex w-96 flex-col gap-3">
      {[
        { value: 'ada', name: 'Ada Lovelace', role: 'Facilitator' },
        { value: 'grace', name: 'Grace Hopper', role: 'Reviewer' },
      ].map((person) => (
        <OptionBox
          key={person.value}
          htmlFor={`option-box-person-${person.value}`}
          control={
            <RadioGroupItem
              id={`option-box-person-${person.value}`}
              value={person.value}
            />
          }
          label={person.name}
          description={person.role}
          accessory={
            <ProfileAvatar name={person.name} alt={person.name} size="sm" />
          }
        />
      ))}
    </RadioGroup>
  ),
};

// `dir` defaults to `auto`: the direction is resolved from the label's first
// strong character, so an option written in another script reads as one
// coherent block instead of each part resolving on its own.
export const DirectionAuto: Story = {
  render: () => (
    <div className="flex w-96 flex-col gap-3">
      <OptionBox
        htmlFor="option-box-dir-en"
        control={<Checkbox id="option-box-dir-en" defaultChecked />}
        label="Neighbourhood parks"
        description="Playgrounds, benches and tree planting."
      />
      <OptionBox
        htmlFor="option-box-dir-ar"
        control={<Checkbox id="option-box-dir-ar" />}
        label="حدائق الحي"
        description="ملاعب ومقاعد وزراعة الأشجار."
      />
    </div>
  ),
};
