import { ButtonLink } from '../src/components/Button';

export default {
  title: 'ButtonLink',
  component: ButtonLink,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'gradient', 'destructive'],
    },
    isLoading: {
      control: 'boolean',
    },
  },
  args: {
    isDisabled: false,
    isLoading: false,
    children: 'ButtonLink',
    href: '#',
  },
};

export const Example = () => (
  <div className="flex flex-col gap-8">
    Medium:
    <ButtonLink href="#">ButtonLink</ButtonLink>
    <ButtonLink href="#" variant="outline">
      ButtonLink
    </ButtonLink>
    <ButtonLink href="#" variant="destructive">
      ButtonLink
    </ButtonLink>
    <ButtonLink href="#" isDisabled variant="destructive">
      ButtonLink
    </ButtonLink>
    Small:
    <ButtonLink href="#" size="sm">
      ButtonLink
    </ButtonLink>
    <ButtonLink href="#" size="sm" variant="outline">
      ButtonLink
    </ButtonLink>
    <ButtonLink href="#" isDisabled size="sm">
      ButtonLink
    </ButtonLink>
    Loading:
    <ButtonLink href="#" isLoading>
      ButtonLink
    </ButtonLink>
    <ButtonLink href="#" isLoading variant="outline">
      ButtonLink
    </ButtonLink>
    <ButtonLink href="#" isLoading variant="destructive">
      ButtonLink
    </ButtonLink>
    <ButtonLink href="#" isLoading size="sm">
      ButtonLink
    </ButtonLink>
    <ButtonLink href="#" isLoading size="sm" variant="outline">
      ButtonLink
    </ButtonLink>
  </div>
);

export const Primary = {
  args: {
    color: 'primary',
  },
};

export const Secondary = {
  args: {
    color: 'secondary',
  },
};

export const Destructive = {
  args: {
    color: 'destructive',
  },
};

export const Loading = {
  args: {
    isLoading: true,
  },
};

export const LoadingSmall = {
  args: {
    isLoading: true,
    size: 'small',
  },
};
