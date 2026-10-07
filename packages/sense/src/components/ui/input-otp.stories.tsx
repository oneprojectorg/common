import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@op/sense/InputOTP';
import { Label } from '@op/sense/Label';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof InputOTP> = {
  title: 'Primitives/InputOTP',
  component: InputOTP,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof InputOTP>;

export const Default: Story = {
  render: () => (
    <InputOTP maxLength={6}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  ),
};

export const WithSeparators: Story = {
  render: () => (
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
  ),
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid gap-2">
      <Label htmlFor="otp-code">Verification code</Label>
      <InputOTP id="otp-code" maxLength={6}>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <InputOTP maxLength={6} defaultValue="123456" disabled>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  ),
};

export const TenDigitsFluid: Story = {
  render: () => (
    <InputOTP
      maxLength={10}
      defaultValue="5404043206"
      containerClassName="w-full justify-center"
    >
      <InputOTPGroup className="w-full justify-center">
        {Array.from({ length: 10 }, (_, index) => (
          <InputOTPSlot
            key={index}
            index={index}
            className="max-w-10 min-w-7 flex-1"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  ),
};
