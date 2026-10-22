// Runs in the browser, inside the bundle: puts every export on `window.Sense`
// and renders a component's Storybook stories into a design-system preview.
import {
  Component,
  Fragment,
  createElement,
  isValidElement,
  type ElementType,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';

type Module = Record<string, unknown>;

/** A story module and its story names in file order (a namespace import sorts them). */
interface StoryFile {
  module: Module;
  order: string[];
}

interface StoryContext {
  args: Record<string, unknown>;
  argTypes: Record<string, unknown>;
  globals: Record<string, unknown>;
  parameters: Record<string, unknown>;
  id: string;
  name: string;
  viewMode: 'story';
}

type Render = (args: Record<string, unknown>, context: StoryContext) => unknown;
type Decorator = (story: ElementType, context: StoryContext) => unknown;

declare global {
  interface Window {
    Sense?: Record<string, unknown>;
  }
}

/** Called once by the generated bundle entry. */
export function register(
  modules: Record<string, Module>,
  stories: Record<string, StoryFile>,
) {
  const namespace: Record<string, unknown> = {};
  const clashes: string[] = [];
  for (const module of Object.values(modules)) {
    for (const [key, value] of Object.entries(module)) {
      if (key === 'default') continue;
      if (key in namespace && namespace[key] !== value) clashes.push(key);
      else namespace[key] = value;
    }
  }
  window.Sense = Object.assign(namespace, {
    __clashes: clashes,
    __renderStories: (element: Element, card: string) =>
      renderStories(namespace, stories, element, card),
  });
}

function renderStories(
  namespace: Record<string, unknown>,
  stories: Record<string, StoryFile>,
  element: Element,
  card: string,
) {
  const file = stories[card];
  if (!file) throw new Error(`No stories for ${card}`);
  const { module, order } = file;
  const meta = isRecord(module.default) ? module.default : {};
  const sections = order
    .map((key): [string, unknown] => [key, module[key]])
    .filter(([, story]) => isRecord(story))
    .map(([key, story]) =>
      createElement(
        'section',
        { key, className: 'flex flex-col gap-3' },
        createElement(
          'div',
          { className: 'text-xs font-strong text-muted-foreground' },
          storyName(key, story),
        ),
        createElement(
          StoryBoundary,
          { name: key },
          createElement(StoryHost, { meta, story, storyKey: key }),
        ),
      ),
    );

  createRoot(element).render(
    wrapInProviders(
      namespace,
      createElement('div', { className: 'flex flex-col gap-8' }, sections),
    ),
  );
}

function StoryHost({
  meta,
  story,
  storyKey,
}: {
  meta: Module;
  story: unknown;
  storyKey: string;
}) {
  const own = isRecord(story) ? story : {};
  const args = { ...recordOf(meta.args), ...recordOf(own.args) };
  const context: StoryContext = {
    args,
    argTypes: {},
    globals: {},
    parameters: {},
    id: storyKey,
    name: storyKey,
    viewMode: 'story',
  };
  const render = asRender(own.render) ?? asRender(meta.render);
  const component =
    asElementType(own.component) ?? asElementType(meta.component);

  let Story: ElementType = () =>
    toNode(
      render
        ? render(args, context)
        : component
          ? createElement(component, args)
          : null,
    );
  for (const decorate of [
    ...decoratorsOf(own.decorators),
    ...decoratorsOf(meta.decorators),
  ]) {
    const Inner: ElementType = Story;
    Story = (): ReactNode => toNode(decorate(Inner, context));
  }
  return createElement(Story);
}

class StoryBoundary extends Component<
  { name: string; children?: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return createElement(
        'div',
        { className: 'text-sm text-destructive', 'data-story-error': '' },
        `${this.props.name}: ${this.state.error.message}`,
      );
    }
    return this.props.children;
  }
}

/** The app wraps every page in these; stories assume them. */
function wrapInProviders(namespace: Record<string, unknown>, node: ReactNode) {
  let wrapped = node;
  const tooltip = asElementType(namespace.TooltipProvider);
  if (tooltip) wrapped = createElement(tooltip, null, wrapped);
  const direction = asElementType(namespace.DirectionProvider);
  if (direction)
    wrapped = createElement(direction, { direction: 'ltr' }, wrapped);
  return createElement(Fragment, null, wrapped);
}

function storyName(key: string, story: unknown) {
  if (isRecord(story) && typeof story.name === 'string') return story.name;
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordOf(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

function asRender(value: unknown): Render | undefined {
  return isFunction(value) ? value : undefined;
}

function decoratorsOf(value: unknown): Decorator[] {
  return Array.isArray(value) ? value.filter(isFunction) : [];
}

/** A component React can render: a function, a class, or a forwardRef / memo object. */
function isElementType(value: unknown): value is ElementType {
  return isFunction(value) || (isRecord(value) && '$$typeof' in value);
}

function asElementType(value: unknown): ElementType | undefined {
  return isElementType(value) ? value : undefined;
}

function isNode(value: unknown): value is ReactNode {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    isValidElement(value) ||
    (Array.isArray(value) && value.every(isNode))
  );
}

function toNode(value: unknown): ReactNode {
  return isNode(value) ? value : null;
}
