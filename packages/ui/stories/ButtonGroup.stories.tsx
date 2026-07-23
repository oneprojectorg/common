import type { Meta } from '@storybook/react-vite';
import { useState } from 'react';
import { LuFile, LuLink } from 'react-icons/lu';

import { Button } from '../src/components/Button';
import { ButtonGroup } from '../src/components/ButtonGroup';

const meta: Meta = {
  title: 'Legacy/ButtonGroup',
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

export const Basic = () => {
  const [value, setValue] = useState<'one' | 'two' | 'three'>('one');
  return (
    <ButtonGroup>
      <Button
        color="secondary"
        size="small"
        aria-pressed={value === 'one'}
        onPress={() => setValue('one')}
      >
        One
      </Button>
      <Button
        color="secondary"
        size="small"
        aria-pressed={value === 'two'}
        onPress={() => setValue('two')}
      >
        Two
      </Button>
      <Button
        color="secondary"
        size="small"
        aria-pressed={value === 'three'}
        onPress={() => setValue('three')}
      >
        Three
      </Button>
    </ButtonGroup>
  );
};

export const ToggleTwoOptions = () => {
  const [value, setValue] = useState<'link' | 'document'>('link');
  return (
    <div className="w-80">
      <ButtonGroup className="w-full">
        <Button
          color="secondary"
          size="small"
          aria-pressed={value === 'link'}
          onPress={() => setValue('link')}
          className="flex-1"
        >
          <LuLink className="size-4" />
          Link
        </Button>
        <Button
          color="secondary"
          size="small"
          aria-pressed={value === 'document'}
          onPress={() => setValue('document')}
          className="flex-1"
        >
          <LuFile className="size-4" />
          Document
        </Button>
      </ButtonGroup>
    </div>
  );
};

export const Vertical = () => {
  const [value, setValue] = useState<'top' | 'middle' | 'bottom'>('top');
  return (
    <ButtonGroup orientation="vertical">
      <Button
        color="secondary"
        size="small"
        aria-pressed={value === 'top'}
        onPress={() => setValue('top')}
      >
        Top
      </Button>
      <Button
        color="secondary"
        size="small"
        aria-pressed={value === 'middle'}
        onPress={() => setValue('middle')}
      >
        Middle
      </Button>
      <Button
        color="secondary"
        size="small"
        aria-pressed={value === 'bottom'}
        onPress={() => setValue('bottom')}
      >
        Bottom
      </Button>
    </ButtonGroup>
  );
};
