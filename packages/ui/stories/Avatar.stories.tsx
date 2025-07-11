import { Avatar, AvatarSkeleton } from '../src/components/Avatar';

export default {
  title: 'Avatar',
  component: Avatar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    placeholder: {
      control: 'text',
    },
    className: {
      control: 'text',
    },
  },
  args: {
    placeholder: 'John Doe',
  },
};

export const Example = () => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center gap-4">
      <Avatar placeholder="John Doe" />
      <Avatar placeholder="Jane Smith" />
      <Avatar placeholder="Bob Johnson" />
      <Avatar placeholder="Alice Brown" />
    </div>
    
    <div className="flex items-center gap-4">
      <Avatar placeholder="Single" />
      <Avatar placeholder="" />
      <Avatar />
    </div>
    
    <div className="flex items-center gap-4">
      <Avatar placeholder="John Doe" className="size-12" />
      <Avatar placeholder="Jane Smith" className="size-16" />
      <Avatar placeholder="Bob Johnson" className="size-20" />
    </div>
    
    <div className="flex items-center gap-4">
      <Avatar placeholder="John Doe">
        <img 
          src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" 
          alt="John Doe"
          className="size-full object-cover"
        />
      </Avatar>
      <Avatar placeholder="Jane Smith">
        <img 
          src="https://images.unsplash.com/photo-1494790108755-2616b612b5bc?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" 
          alt="Jane Smith"
          className="size-full object-cover"
        />
      </Avatar>
    </div>
  </div>
);

export const WithPlaceholder = {
  args: {
    placeholder: 'John Doe',
  },
};

export const WithImage = {
  args: {
    placeholder: 'John Doe',
    children: (
      <img 
        src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" 
        alt="John Doe"
        className="size-full object-cover"
      />
    ),
  },
};

export const CustomSize = {
  args: {
    placeholder: 'Large Avatar',
    className: 'size-16',
  },
};

export const Skeleton = () => (
  <div className="flex items-center gap-4">
    <AvatarSkeleton />
    <AvatarSkeleton className="size-12" />
    <AvatarSkeleton className="size-16" />
    <AvatarSkeleton className="size-20" />
  </div>
);