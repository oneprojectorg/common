import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@op/sense/Accordion';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof Accordion> = {
  title: 'Sense/Primitives/Accordion',
  component: Accordion,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Accordion>;

const items = [
  {
    value: 'item-1',
    question: 'How do I reset my password?',
    answer:
      "Click on 'Forgot Password' on the login page, enter your email address, and we'll send you a link to reset your password. The link will expire in 24 hours.",
  },
  {
    value: 'item-2',
    question: 'Can I change my subscription plan?',
    answer:
      'Yes, you can change your plan at any time from your account settings.',
  },
  {
    value: 'item-3',
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards and PayPal.',
  },
];

export const Default: Story = {
  render: () => (
    <Accordion defaultValue={['item-1']} className="max-w-lg">
      {items.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
};

// base-ui accordions are single-open by default; `multiple` lets several
// panels stay expanded at once.
export const MultipleOpen: Story = {
  render: () => (
    <Accordion
      multiple
      defaultValue={['item-1', 'item-2']}
      className="max-w-lg"
    >
      {items.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
};
