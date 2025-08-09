import { Button } from '../src/components/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from '../src/components/Dialog';
import { Modal } from '../src/components/Modal';

export default {
  title: 'Dialog',
  component: Dialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
    },
  },
};

export const Example = () => (
  <div className="flex flex-col gap-4">
    <DialogTrigger>
      <Button>Open Simple Dialog</Button>
      <Modal>
        <Dialog>
          <DialogHeader>Simple Dialog</DialogHeader>
          <DialogContent>
            <DialogDescription>
              This is a simple dialog with minimal content.
            </DialogDescription>
          </DialogContent>
          <DialogFooter>
            <Button color="secondary">Cancel</Button>
            <Button>Confirm</Button>
          </DialogFooter>
        </Dialog>
      </Modal>
    </DialogTrigger>

    <DialogTrigger>
      <Button color="secondary">Open Complex Dialog</Button>
      <Modal>
        <Dialog>
          <DialogHeader>Complex Dialog</DialogHeader>
          <DialogContent>
            <DialogDescription>
              This dialog contains more detailed content with multiple sections.
            </DialogDescription>
            <div className="mt-4 space-y-4">
              <div>
                <h4 className="font-medium">Section 1</h4>
                <p className="text-sm text-neutral-600">
                  Some detailed information about the first section.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Section 2</h4>
                <p className="text-sm text-neutral-600">
                  More information about the second section with additional
                  details.
                </p>
              </div>
            </div>
          </DialogContent>
          <DialogFooter>
            <Button color="secondary">Cancel</Button>
            <Button color="destructive">Delete</Button>
            <Button>Save Changes</Button>
          </DialogFooter>
        </Dialog>
      </Modal>
    </DialogTrigger>
  </div>
);

export const BasicDialog = () => (
  <DialogTrigger>
    <Button>Open Dialog</Button>
    <Modal>
      <Dialog>
        <DialogHeader>Basic Dialog</DialogHeader>
        <DialogContent>
          <DialogDescription>This is a basic dialog example.</DialogDescription>
        </DialogContent>
        <DialogFooter>
          <Button color="secondary">Cancel</Button>
          <Button>OK</Button>
        </DialogFooter>
      </Dialog>
    </Modal>
  </DialogTrigger>
);

export const WithForm = () => (
  <DialogTrigger>
    <Button>Open Form Dialog</Button>
    <Modal>
      <Dialog>
        <DialogHeader>Create New Item</DialogHeader>
        <DialogContent>
          <DialogDescription>
            Fill out the form below to create a new item.
          </DialogDescription>
          <form className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium">Name</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border border-neutral-gray3 px-3 py-2"
                placeholder="Enter name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Description</label>
              <textarea
                className="mt-1 block w-full rounded-md border border-neutral-gray3 px-3 py-2"
                rows={3}
                placeholder="Enter description"
              />
            </div>
          </form>
        </DialogContent>
        <DialogFooter>
          <Button color="secondary">Cancel</Button>
          <Button>Create</Button>
        </DialogFooter>
      </Dialog>
    </Modal>
  </DialogTrigger>
);

export const DestructiveAction = () => (
  <DialogTrigger>
    <Button color="destructive">Delete Item</Button>
    <Modal>
      <Dialog>
        <DialogHeader>Confirm Deletion</DialogHeader>
        <DialogContent>
          <DialogDescription>
            Are you sure you want to delete this item? This action cannot be
            undone.
          </DialogDescription>
        </DialogContent>
        <DialogFooter>
          <Button color="secondary">Cancel</Button>
          <Button color="destructive">Delete</Button>
        </DialogFooter>
      </Dialog>
    </Modal>
  </DialogTrigger>
);
