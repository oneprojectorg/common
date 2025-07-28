import { useState } from 'react';

import { Button } from '../src/components/Button';
import { DialogTrigger } from '../src/components/Dialog';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '../src/components/Modal';

export default {
  title: 'Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
    },
    confetti: {
      control: 'boolean',
    },
  },
};

export const Example = () => (
  <div className="flex flex-col gap-4">
    <DialogTrigger>
      <Button>Open Basic Modal</Button>
      <Modal>
        <ModalHeader>Basic Modal</ModalHeader>
        <ModalBody>
          <p>This is a basic modal with header, body, and footer sections.</p>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary">Cancel</Button>
          <Button>Confirm</Button>
        </ModalFooter>
      </Modal>
    </DialogTrigger>

    <DialogTrigger>
      <Button color="secondary">Open Modal with Confetti</Button>
      <Modal confetti>
        <ModalHeader>Success Modal</ModalHeader>
        <ModalBody>
          <p>Congratulations! Your action was completed successfully.</p>
        </ModalBody>
        <ModalFooter>
          <Button>Close</Button>
        </ModalFooter>
      </Modal>
    </DialogTrigger>

    <DialogTrigger>
      <Button color="destructive">Open Large Modal</Button>
      <Modal className="max-w-2xl">
        <ModalHeader>Large Modal</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p>This is a larger modal with more content.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Section 1</h4>
                <p className="text-sm text-neutral-600">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
                  do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Section 2</h4>
                <p className="text-sm text-neutral-600">
                  Ut enim ad minim veniam, quis nostrud exercitation ullamco
                  laboris nisi ut aliquip ex ea commodo consequat.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Additional Content</h4>
              <p className="text-sm text-neutral-600">
                Duis aute irure dolor in reprehenderit in voluptate velit esse
                cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat
                cupidatat non proident, sunt in culpa qui officia deserunt
                mollit anim id est laborum.
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary">Cancel</Button>
          <Button color="destructive">Delete</Button>
          <Button>Save Changes</Button>
        </ModalFooter>
      </Modal>
    </DialogTrigger>
  </div>
);

export const BasicModal = () => (
  <DialogTrigger>
    <Button>Open Modal</Button>
    <Modal>
      <ModalHeader>Modal Title</ModalHeader>
      <ModalBody>
        <p>This is the modal content.</p>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary">Cancel</Button>
        <Button>OK</Button>
      </ModalFooter>
    </Modal>
  </DialogTrigger>
);

export const WithConfetti = () => (
  <DialogTrigger>
    <Button>Open Success Modal</Button>
    <Modal confetti>
      <ModalHeader>Success!</ModalHeader>
      <ModalBody>
        <p>Your action was completed successfully with confetti!</p>
      </ModalBody>
      <ModalFooter>
        <Button>Celebrate</Button>
      </ModalFooter>
    </Modal>
  </DialogTrigger>
);

export const DismissableModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DialogTrigger>
      <Button onPress={() => setIsOpen(true)}>Open Dismissable Modal</Button>
      <Modal isDismissable onOpenChange={setIsOpen} isOpen={isOpen}>
        <ModalHeader>Dismissable Modal</ModalHeader>
        <ModalBody className="min-w-[400px]">
          <p>This modal is dismissable.</p>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary">Cancel</Button>
          <Button>Confirm</Button>
        </ModalFooter>
      </Modal>
    </DialogTrigger>
  );
};

export const WithForm = () => (
  <DialogTrigger>
    <Button>Open Form Modal</Button>
    <Modal>
      <ModalHeader>Create New Project</ModalHeader>
      <ModalBody>
        <form className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Project Name
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-neutral-gray3 px-3 py-2"
              placeholder="Enter project name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Description
            </label>
            <textarea
              className="w-full rounded-md border border-neutral-gray3 px-3 py-2"
              rows={3}
              placeholder="Enter project description"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <select className="w-full rounded-md border border-neutral-gray3 px-3 py-2">
              <option>Select category</option>
              <option>Web Development</option>
              <option>Mobile App</option>
              <option>Design</option>
              <option>Other</option>
            </select>
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary">Cancel</Button>
        <Button>Create Project</Button>
      </ModalFooter>
    </Modal>
  </DialogTrigger>
);

export const LargeModal = () => (
  <DialogTrigger>
    <Button>Open Large Modal</Button>
    <Modal className="max-w-4xl">
      <ModalHeader>Large Modal with Lots of Content</ModalHeader>
      <ModalBody>
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="rounded border border-neutral-gray3 p-4">
                <h4 className="font-medium">Item {i + 1}</h4>
                <p className="text-sm text-neutral-600">
                  This is item {i + 1} with some sample content.
                </p>
              </div>
            ))}
          </div>
          <div>
            <h3 className="mb-2 font-medium">Additional Information</h3>
            <p className="text-sm text-neutral-600">
              This modal demonstrates how content can be organized in a larger
              modal with multiple sections and complex layouts.
            </p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary">Cancel</Button>
        <Button>Save All</Button>
      </ModalFooter>
    </Modal>
  </DialogTrigger>
);
