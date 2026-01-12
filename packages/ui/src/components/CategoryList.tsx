'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LuPlus, LuX } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { TextField } from './TextField';

type CategoryItem = {
  id: string;
  label: string;
};

type CategoryListProps<C extends CategoryItem> = {
  initialCategories?: C[];
  placeholder?: string;
  onUpdateList?: (categories: C[]) => void;
  className?: string;
};

export const CategoryList = <C extends CategoryItem>({
  initialCategories = [] as C[],
  placeholder = 'Enter category name...',
  onUpdateList,
  className,
}: CategoryListProps<C>) => {
  const [categories, setCategories] = useState<C[]>(
    initialCategories.length > 0
      ? initialCategories
      : [{ id: '', label: '' } as C],
  );
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const idCounterRef = useRef(0);

  const createRefForIndex = useCallback((index: number) => {
    return {
      get current() {
        return inputRefs.current[index] || null;
      },
      set current(el: HTMLInputElement | null) {
        inputRefs.current[index] = el;
      },
    };
  }, []);

  useEffect(() => {
    if (focusIndex !== null && inputRefs.current[focusIndex]) {
      inputRefs.current[focusIndex]?.focus();
      setFocusIndex(null);
    }
  }, [focusIndex]);

  const generateId = useCallback(() => {
    const newId = `category_${idCounterRef.current}`;
    idCounterRef.current += 1;
    return newId;
  }, []);

  const addCategory = useCallback(() => {
    const newIndex = categories.length;
    setCategories((prev) => {
      const newCategories = [...prev, { id: generateId(), label: '' } as C];
      onUpdateList?.(newCategories);
      return newCategories;
    });
    setFocusIndex(newIndex);
  }, [categories.length, onUpdateList, generateId]);

  const removeCategory = useCallback(
    (index: number) => {
      if (categories.length <= 1) {
        // If there's only one item, clear it instead of removing it.
        setCategories((prev) => {
          const newCategories = prev.map((category, i) =>
            i === index ? ({ id: generateId(), label: '' } as C) : category,
          );
          onUpdateList?.(newCategories);
          return newCategories;
        });
        // Focus the cleared input.
        setFocusIndex(index);
        return;
      }

      setCategories((prev) => {
        const newCategories = prev.filter((_, i) => i !== index);
        onUpdateList?.(newCategories);
        return newCategories;
      });
    },
    [categories.length, onUpdateList, generateId],
  );

  const updateCategory = useCallback(
    (index: number, value: string) => {
      setCategories((prev) => {
        const newCategories = prev.map((category, i) =>
          i === index ? ({ ...category, label: value } as C) : category,
        );
        onUpdateList?.(newCategories);
        return newCategories;
      });
    },
    [onUpdateList],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addCategory();
      }
    },
    [addCategory],
  );

  return (
    <div
      className={cn(
        'flex flex-col',
        'gap-2 p-4',
        'bg-neutral-offWhite',
        className,
      )}
    >
      <ul className="flex w-full flex-col gap-2">
        {categories.map((category, index) => (
          <li
            key={category.id || index}
            className="relative flex items-center gap-2"
          >
            <div className="flex-1">
              <TextField
                value={category.label}
                onChange={(value) => updateCategory(index, value)}
                inputProps={{
                  placeholder,
                  onKeyDown: handleKeyDown,
                }}
                ref={createRefForIndex(index)}
              />
            </div>
            <IconButton
              size="large"
              variant="outline"
              aria-label="Remove category"
              className="bg-white"
              onPress={() => removeCategory(index)}
              isDisabled={categories.length <= 1 && categories[0]?.label === ''}
            >
              <LuX className="h-4 w-4 text-neutral-black" aria-hidden="true" />
            </IconButton>
          </li>
        ))}
      </ul>
      <Button
        color="secondary"
        onPress={addCategory}
        className="flex w-full items-center justify-center gap-1 border-primary-teal shadow-none"
      >
        <LuPlus className="h-4 w-4" />
        Add Category
      </Button>
    </div>
  );
};
