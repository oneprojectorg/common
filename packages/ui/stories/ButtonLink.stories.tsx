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
    <ButtonLink href="#" color="secondary">
      ButtonLink
    </ButtonLink>
    <ButtonLink href="#" color="destructive">
      ButtonLink
    </ButtonLink>
    <ButtonLink href="#" isDisabled color="destructive">
      ButtonLink
    </ButtonLink>
    Small:
    <ButtonLink href="#" size="small">
      ButtonLink
    </ButtonLink>
    <ButtonLink href="#" size="small" color="secondary">
      ButtonLink
    </ButtonLink>
    <ButtonLink href="#" isDisabled size="small">
      ButtonLink
    </ButtonLink>
    Loading:
    <ButtonLink href="#" isLoading>
      ButtonLink
    </ButtonLink>
    <ButtonLink href="#" isLoading color="secondary">
      ButtonLink
    </ButtonLink>
    <ButtonLink href="#" isLoading color="destructive">
      ButtonLink
    </ButtonLink>
    <ButtonLink href="#" isLoading size="small">
      ButtonLink
    </ButtonLink>
    <ButtonLink href="#" isLoading size="small" color="secondary">
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
