import {
  HorizontalList,
  HorizontalListItem,
} from '../src/components/HorizontalList';
import { Surface } from '../src/components/Surface';

export default {
  title: 'HorizontalList',
  component: HorizontalList,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

const items = [
  { title: 'Item 1' },
  { title: 'Item 2' },
  { title: 'Item 3' },
  { title: 'Item 4' },
  { title: 'Item 5' },
  { title: 'Item 6' },
  { title: 'Item 7' },
];

export const Example = () => (
  <HorizontalList className="max-w-lg scroll-px-8 rounded-xl bg-gray-100 py-8">
    {items.map((item) => (
      <HorizontalListItem key={item.title} className="first:ml-8 last:mr-8">
        <Surface className="flex size-40 flex-col items-center justify-center border-gray-300 bg-gray-200 bg-white text-gray-400">
          <span>{item.title}</span>
        </Surface>
      </HorizontalListItem>
    ))}
  </HorizontalList>
);
