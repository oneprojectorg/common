import { StatusDot } from '../src/components/StatusDot';

export default {
  title: 'StatusDot',
  component: StatusDot,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export const Success = () => <StatusDot intent="success" />;

export const Danger = () => <StatusDot intent="danger" />;

export const Warning = () => <StatusDot intent="warning" />;

export const Neutral = () => <StatusDot intent="neutral" />;

export const WithLabel = () => (
  <StatusDot intent="success">
    <span className="text-sm text-neutral-black">Approved</span>
  </StatusDot>
);

export const GroupHeading = () => (
  <StatusDot intent="warning" className="gap-2">
    <span className="font-serif !text-title-sm14 text-neutral-black">
      Maybe (3)
    </span>
  </StatusDot>
);

export const AllIntents = () => (
  <div className="flex flex-col gap-3">
    <StatusDot intent="success">
      <span className="text-sm text-neutral-black">Success</span>
    </StatusDot>
    <StatusDot intent="danger">
      <span className="text-sm text-neutral-black">Danger</span>
    </StatusDot>
    <StatusDot intent="warning">
      <span className="text-sm text-neutral-black">Warning</span>
    </StatusDot>
    <StatusDot intent="neutral">
      <span className="text-sm text-neutral-black">Neutral</span>
    </StatusDot>
  </div>
);
