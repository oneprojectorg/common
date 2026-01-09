import { Form } from 'react-aria-components';

import { Button } from '../src/components/Button';
import { Radio, RadioGroup } from '../src/components/RadioGroup';

export default {
  title: 'RadioGroup',
  component: RadioGroup,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
  args: {
    label: 'Favorite sport',
    isDisabled: false,
    isRequired: false,
    description: '',
    children: (
      <>
        <Radio value="soccer">Soccer</Radio>
        <Radio value="baseball">Baseball</Radio>
        <Radio value="basketball">Basketball</Radio>
      </>
    ),
  },
};

export const Default = {
  args: {},
};

export const Validation = (args: any) => (
  <Form className="gap-2 flex flex-col items-start">
    <RadioGroup {...args} />
    <Button type="submit">Submit</Button>
  </Form>
);

Validation.args = {
  isRequired: true,
};
