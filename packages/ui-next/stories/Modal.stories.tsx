import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Button } from '@/components/Button';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalStepper,
} from '@/components/Modal';

const meta: Meta = {
  title: 'shadcn/Modal',
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onPress={() => setOpen(true)}>Open modal</Button>
        <Modal isOpen={open} onOpenChange={setOpen} isDismissable>
          <ModalHeader>Modal title</ModalHeader>
          <ModalBody>
            <p>Body content. Click X, press Esc, or click outside to close.</p>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onPress={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onPress={() => setOpen(false)}>Confirm</Button>
          </ModalFooter>
        </Modal>
      </>
    );
  },
};

export const FlatSurface: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onPress={() => setOpen(true)}>Open flat modal</Button>
        <Modal
          isOpen={open}
          onOpenChange={setOpen}
          isDismissable
          surface="flat"
        >
          <ModalHeader className="pl-6 text-left">Delete draft?</ModalHeader>
          <ModalBody>
            <p>
              This draft will be permanently deleted and can&apos;t be
              recovered.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onPress={() => setOpen(false)}>
              Keep draft
            </Button>
            <Button color="destructive" onPress={() => setOpen(false)}>
              Delete draft
            </Button>
          </ModalFooter>
        </Modal>
      </>
    );
  },
};

export const NonDismissable: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onPress={() => setOpen(true)}>Open non-dismissable</Button>
        <Modal isOpen={open} onOpenChange={setOpen} isDismissable={false}>
          <ModalBody>
            <p>
              Outside click and Esc are suppressed. Programmatic close only.
            </p>
            <Button onPress={() => setOpen(false)}>Close</Button>
          </ModalBody>
        </Modal>
      </>
    );
  },
};

export const Stepper: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(1);
    return (
      <>
        <Button onPress={() => setOpen(true)}>Open stepper</Button>
        <Modal isOpen={open} onOpenChange={setOpen} isDismissable>
          <ModalHeader>Step {step}</ModalHeader>
          <ModalBody>
            <p>Content for step {step}.</p>
          </ModalBody>
          <ModalStepper
            currentStep={step}
            totalSteps={3}
            onNext={() => {
              setStep((s) => Math.min(s + 1, 3));
              return true;
            }}
            onPrevious={() => setStep((s) => Math.max(s - 1, 1))}
            onFinish={() => {
              setOpen(false);
              setStep(1);
            }}
          />
        </Modal>
      </>
    );
  },
};
