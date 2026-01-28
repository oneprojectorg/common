import { useState } from 'react';

import { DragHandle, Reorderable } from '../src/components/Reorderable';
import { cn } from '../src/lib/utils';

export default {
  title: 'Reorderable',
  component: Reorderable,
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

export const WithDragHandle = () => {
  const [tasks, setTasks] = useState(initialTasks);

  return (
    <div className="w-[400px]">
      <h3 className="mb-4 text-lg font-semibold">Drag Handle Example</h3>
      <Reorderable
        items={tasks}
        onChange={setTasks}
        dragTrigger="handle"
        getItemLabel={(task) => task.title}
        className="space-y-2"
      >
        {(task, { isDragging }) => (
          <div
            className={`flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 ${
              isDragging ? 'shadow-lg' : 'shadow-sm'
            }`}
          >
            <DragHandle />
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
      </Reorderable>
      <div className="mt-4 text-sm text-neutral-500">
        Current order: {tasks.map((t) => t.id).join(', ')}
      </div>
    </div>
  );
};

export const EntireItemDraggable = () => {
  const [tasks, setTasks] = useState(initialTasks);

  return (
    <div className="w-[400px]">
      <h3 className="mb-4 text-lg font-semibold">Entire Item Draggable</h3>
      <Reorderable
        items={tasks}
        onChange={setTasks}
        dragTrigger="item"
        getItemLabel={(task) => task.title}
        className="space-y-2"
      >
        {(task, { isDragging }) => (
          <div
            className={`flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 ${
              isDragging ? 'shadow-lg' : 'shadow-sm'
            }`}
          >
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
      </Reorderable>
      <div className="mt-4 text-sm text-neutral-500">
        Current order: {tasks.map((t) => t.id).join(', ')}
      </div>
    </div>
  );
};

export const CustomDragPreview = () => {
  const [tasks, setTasks] = useState(initialTasks);

  return (
    <div className="w-[400px]">
      <h3 className="mb-4 text-lg font-semibold">Custom Drag Preview</h3>
      <Reorderable
        items={tasks}
        onChange={setTasks}
        dragTrigger="handle"
        getItemLabel={(task) => task.title}
        className="space-y-2"
        renderDragPreview={(items) => (
          <div className="rounded-lg bg-primary-teal px-4 py-2 text-white shadow-xl">
            Moving: {items[0]?.title}
          </div>
        )}
      >
        {(task, { isDragging }) => (
          <div
            className={`flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 ${
              isDragging ? 'shadow-lg' : 'shadow-sm'
            }`}
          >
            <DragHandle />
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
      </Reorderable>
      <div className="mt-4 text-sm text-neutral-500">
        Current order: {tasks.map((t) => t.id).join(', ')}
      </div>
    </div>
  );
};
