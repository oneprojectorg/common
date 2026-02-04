import { useState } from 'react';

import { DragHandle, Sortable } from '../src/components/Sortable';
import { cn } from '../src/lib/utils';

export default {
  title: 'Sortable',
  component: Sortable,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

interface Task {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
}

const initialTasks: Task[] = [
  { id: '1', title: 'Review pull request', priority: 'high' },
  { id: '2', title: 'Update documentation', priority: 'medium' },
  { id: '3', title: 'Fix navigation bug', priority: 'high' },
  { id: '4', title: 'Write unit tests', priority: 'low' },
  { id: '5', title: 'Refactor API client', priority: 'medium' },
];

const priorityColors = {
  low: 'bg-green-50 text-green-800',
  medium: 'bg-yellow-50 text-yellow-800',
  high: 'bg-red-50 text-red-800',
};

/**
 * With a drag handle for keyboard and screen reader accessibility.
 * Mouse users can drag the entire item, but keyboard users use the
 * handle to initiate drag via Enter key.
 */
export const WithDragHandle = () => {
  const [tasks, setTasks] = useState(initialTasks);

  return (
    <div className="w-[400px]">
      <h3 className="mb-4 text-lg font-semibold">With Drag Handle</h3>
      <p className="mb-4 text-sm text-neutral-gray3">
        The drag handle provides keyboard and screen reader accessibility. Mouse
        users can drag the entire row.
      </p>
      <Sortable
        items={tasks}
        onChange={setTasks}
        dragTrigger="handle"
        getItemLabel={(task) => task.title}
        className="gap-2"
      >
        {(task, { isDragging, dragHandleProps }) => (
          <div
            className={`flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 ${
              isDragging ? 'shadow-lg' : 'shadow-sm'
            }`}
          >
            <DragHandle {...dragHandleProps} />
            <div className="flex-1">
              <h3>{task.title}</h3>
            </div>
            <span
              className={cn(
                `rounded px-2 py-0.5 text-xs font-medium`,
                priorityColors[task.priority],
              )}
            >
              {task.priority}
            </span>
          </div>
        )}
      </Sortable>
      <div className="mt-4 text-sm text-neutral-500">
        Current order: {tasks.map((t) => t.id).join(', ')}
      </div>
    </div>
  );
};

/**
 * Without a visible drag handle. The entire item acts as the drag target
 * for both mouse and keyboard users.
 */
export const WithoutDragHandle = () => {
  const [tasks, setTasks] = useState(initialTasks);

  return (
    <div className="w-[400px]">
      <h3 className="mb-4 text-lg font-semibold">Without Drag Handle</h3>
      <p className="mb-4 text-sm text-neutral-gray3">
        The entire item is the drag target. Press Enter on an item to start
        dragging with keyboard.
      </p>
      <Sortable
        items={tasks}
        onChange={setTasks}
        dragTrigger="item"
        getItemLabel={(task) => task.title}
        className="gap-2"
      >
        {(task, { isDragging }) => (
          <div
            className={`flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 ${
              isDragging ? 'shadow-lg' : 'shadow-sm'
            }`}
          >
            <div className="flex-1 text-left">
              <h3>{task.title}</h3>
            </div>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${priorityColors[task.priority]}`}
            >
              {task.priority}
            </span>
          </div>
        )}
      </Sortable>
      <div className="mt-4 text-sm text-neutral-500">
        Current order: {tasks.map((t) => t.id).join(', ')}
      </div>
    </div>
  );
};

/**
 * Customize the drag preview shown while dragging.
 */
export const CustomDragPreview = () => {
  const [tasks, setTasks] = useState(initialTasks);

  return (
    <div className="w-[400px]">
      <h3 className="mb-4 text-lg font-semibold">Custom Drag Preview</h3>
      <p className="mb-4 text-sm text-neutral-gray3">
        A custom preview is shown while dragging instead of the default item
        clone.
      </p>
      <Sortable
        items={tasks}
        onChange={setTasks}
        dragTrigger="handle"
        getItemLabel={(task) => task.title}
        className="gap-2"
        renderDragPreview={(items) => (
          <div className="rounded-lg bg-primary-teal px-4 py-2 text-white shadow-xl">
            Moving: {items[0]?.title}
          </div>
        )}
      >
        {(task, { isDragging, dragHandleProps }) => (
          <div
            className={`flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 ${
              isDragging ? 'shadow-lg' : 'shadow-sm'
            }`}
          >
            <DragHandle {...dragHandleProps} />
            <div className="flex-1">
              <h3>{task.title}</h3>
            </div>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${priorityColors[task.priority]}`}
            >
              {task.priority}
            </span>
          </div>
        )}
      </Sortable>
      <div className="mt-4 text-sm text-neutral-500">
        Current order: {tasks.map((t) => t.id).join(', ')}
      </div>
    </div>
  );
};

/**
 * Shows the default drop placeholder where the item will be placed.
 */
export const WithDropPlaceholder = () => {
  const [tasks, setTasks] = useState(initialTasks);

  return (
    <div className="w-[400px]">
      <h3 className="mb-4 text-lg font-semibold">With Drop Placeholder</h3>
      <p className="mb-4 text-sm text-neutral-gray3">
        A placeholder shows where the dragged item will be dropped.
      </p>
      <Sortable
        items={tasks}
        onChange={setTasks}
        dragTrigger="handle"
        getItemLabel={(task) => task.title}
        className="gap-2"
        dropIndicator="placeholder"
      >
        {(task, { isDragging, dragHandleProps }) => (
          <div
            className={`flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 ${
              isDragging ? 'shadow-lg' : 'shadow-sm'
            }`}
          >
            <DragHandle {...dragHandleProps} />
            <div className="flex-1">
              <h3>{task.title}</h3>
            </div>
            <span
              className={cn(
                `rounded px-2 py-0.5 text-xs font-medium`,
                priorityColors[task.priority],
              )}
            >
              {task.priority}
            </span>
          </div>
        )}
      </Sortable>
      <div className="mt-4 text-sm text-neutral-500">
        Current order: {tasks.map((t) => t.id).join(', ')}
      </div>
    </div>
  );
};

/**
 * Custom styling for the drop placeholder.
 */
export const CustomDropPlaceholder = () => {
  const [tasks, setTasks] = useState(initialTasks);

  return (
    <div className="w-[400px]">
      <h3 className="mb-4 text-lg font-semibold">Custom Drop Placeholder</h3>
      <p className="mb-4 text-sm text-neutral-gray3">
        The drop placeholder can be customized with your own styles.
      </p>
      <Sortable
        items={tasks}
        onChange={setTasks}
        dragTrigger="handle"
        getItemLabel={(task) => task.title}
        className="gap-2"
        dropIndicator="placeholder"
        dropPlaceholderClassName="rounded-lg bg-amber-100 border-2 border-dashed border-amber-400"
      >
        {(task, { isDragging, dragHandleProps }) => (
          <div
            className={`flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 ${
              isDragging ? 'shadow-lg' : 'shadow-sm'
            }`}
          >
            <DragHandle {...dragHandleProps} />
            <div className="flex-1">
              <h3>{task.title}</h3>
            </div>
            <span
              className={cn(
                `rounded px-2 py-0.5 text-xs font-medium`,
                priorityColors[task.priority],
              )}
            >
              {task.priority}
            </span>
          </div>
        )}
      </Sortable>
      <div className="mt-4 text-sm text-neutral-500">
        Current order: {tasks.map((t) => t.id).join(', ')}
      </div>
    </div>
  );
};

interface CardItem {
  id: string;
  title: string;
  description: string;
}

const variableHeightItems: CardItem[] = [
  {
    id: '1',
    title: 'Quick Note',
    description: 'A brief reminder.',
  },
  {
    id: '2',
    title: 'Project Overview',
    description:
      'This is a much longer description that spans multiple lines. It contains detailed information about the project scope, timeline, and deliverables. The team should review this carefully before the next sprint planning session.',
  },
  {
    id: '3',
    title: 'Meeting Notes',
    description: 'Discussed Q4 goals and budget allocation.',
  },
  {
    id: '4',
    title: 'Research Summary',
    description:
      'Key findings from user research:\n\n• Users prefer drag-and-drop interfaces\n• Mobile support is essential\n• Accessibility features are highly valued\n• Performance on large lists matters\n\nNext steps include prototyping and usability testing with a diverse group of participants.',
  },
  {
    id: '5',
    title: 'TODO',
    description: 'Fix bug.',
  },
];

/**
 * Items with varying heights to demonstrate the sortable handles
 * different sized content gracefully. Uses a line indicator for cleaner UX.
 */
export const VariableHeightItems = () => {
  const [items, setItems] = useState(variableHeightItems);

  return (
    <div className="w-[400px]">
      <h3 className="mb-4 text-lg font-semibold">Variable Height Items</h3>
      <p className="mb-4 text-sm text-neutral-gray3">
        Items with different content lengths sort correctly. A line indicator
        shows where the item will be dropped.
      </p>
      <Sortable
        items={items}
        onChange={setItems}
        dragTrigger="handle"
        getItemLabel={(item) => item.title}
        className="gap-2"
        dropIndicator="line"
      >
        {(item, { isDragging, dragHandleProps }) => (
          <div
            className={cn(
              'flex gap-3 rounded-lg border border-neutral-200 bg-white p-3',
              isDragging ? 'shadow-lg' : 'shadow-sm',
            )}
          >
            <DragHandle {...dragHandleProps} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium">{item.title}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600">
                {item.description}
              </p>
            </div>
          </div>
        )}
      </Sortable>
      <div className="mt-4 text-sm text-neutral-500">
        Current order: {items.map((i) => i.id).join(', ')}
      </div>
    </div>
  );
};
