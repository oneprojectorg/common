'use client';

import { Button } from '@op/sense/Button';
import { Input } from '@op/sense/Input';
import { Popover, PopoverContent, PopoverTrigger } from '@op/sense/Popover';
import {
  RichTextEditor,
  type RichTextEditorRef,
} from '@op/sense/RichTextEditor';
import { Separator } from '@op/sense/Separator';
import { ToggleGroup, ToggleGroupItem } from '@op/sense/ToggleGroup';
import { Tooltip, TooltipContent, TooltipTrigger } from '@op/sense/Tooltip';
import { type ReactNode, useState } from 'react';
import {
  LuAlignCenter,
  LuAlignJustify,
  LuAlignLeft,
  LuAlignRight,
  LuBold,
  LuChevronDown,
  LuCode,
  LuHeading,
  LuHeading1,
  LuHeading2,
  LuHeading3,
  LuHeading4,
  LuImage,
  LuItalic,
  LuLink,
  LuLink2Off,
  LuList,
  LuListOrdered,
  LuQuote,
  LuStrikethrough,
  LuUnderline,
} from 'react-icons/lu';

/**
 * Taken from the design system's own ref rather than imported from
 * `@tiptap/react`: tiptap is sense's dependency, not the prototype's, and this
 * way the editor type follows whatever sense is built against.
 */
type Editor = NonNullable<RichTextEditorRef['editor']>;

/** One toolbar option: what it looks like, whether it is on, what it does. */
interface Option {
  value: string;
  label: string;
  Icon: typeof LuBold;
  run: () => void;
}

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * The About body's editor with its formatting toolbar. One component because the
 * toolbar is useless without the editor it drives: it needs the live instance to
 * know what is on at the cursor, which is what makes the buttons show state
 * rather than just fire commands.
 *
 * The toolbar is part of the editor, not part of the page — it exists only while
 * the body is being edited, which is what `HoverEdit` already decides. Read
 * state is untouched.
 */
export function PrototypeRichTextField({
  content,
  placeholder,
  onChange,
}: {
  content: string;
  placeholder?: string;
  onChange: (next: string) => void;
}) {
  /* The editor is the toolbar's source of truth for what is active, so it has
     to be state rather than a ref: the toolbar re-renders off it. */
  const [editor, setEditor] = useState<Editor | null>(null);

  return (
    /* The field is one box: the toolbar is a strip inside it rather than a
       second panel stacked on top. `data-slot` is what the design system's own
       editor styles look for to drop the editable's separate focus ring, so the
       whole field rings once, from here. No `overflow-hidden` — it would clip
       that ring — the strip inherits the corner radius instead. */
    <div
      data-slot="rich-text-editor-field"
      className="rounded-lg border bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
    >
      <PrototypeRichTextToolbar editor={editor} />
      <RichTextEditor
        content={content}
        placeholder={placeholder}
        onChange={onChange}
        onEditorReady={setEditor}
        // The field's own padding, at the 12 every other field in the system
        // uses. Without it the first line sits against the toolbar's rule.
        editorClassName="min-h-40 rounded-none p-3"
      />
    </div>
  );
}

/**
 * The formatting controls. Everything the design asks for is here, but not all
 * of it is on the surface: marks and lists are what people reach for while
 * writing, so those stay out; headings, blocks, alignment, links and images are
 * chosen once and then left alone, so they sit behind a disclosure each. A row
 * of nineteen icons is a row nobody reads.
 */
function PrototypeRichTextToolbar({ editor }: { editor: Editor | null }) {
  const off = !editor;

  /* Base UI's toggle groups are multi-select, so a group reports the whole set
     and the one option whose membership flipped is the one to run. Lifted from
     the product's own toolbar, which works the same way. */
  const runChanged = (options: Option[], active: string[], next: string[]) => {
    options
      .find(
        (option) =>
          next.includes(option.value) !== active.includes(option.value),
      )
      ?.run();
  };

  const marks: Option[] = [
    {
      value: 'bold',
      label: 'Bold',
      Icon: LuBold,
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      value: 'italic',
      label: 'Italic',
      Icon: LuItalic,
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      value: 'underline',
      label: 'Underline',
      Icon: LuUnderline,
      run: () => editor?.chain().focus().toggleUnderline().run(),
    },
    {
      value: 'strike',
      label: 'Strikethrough',
      Icon: LuStrikethrough,
      run: () => editor?.chain().focus().toggleStrike().run(),
    },
  ];

  const headings: Option[] = [1, 2, 3, 4].map((level) => ({
    value: String(level),
    label: `Heading ${level}`,
    Icon: [LuHeading1, LuHeading2, LuHeading3, LuHeading4][level - 1]!,
    run: () =>
      editor
        ?.chain()
        .focus()
        .toggleHeading({ level: level as 1 | 2 | 3 | 4 })
        .run(),
  }));

  const lists: Option[] = [
    {
      value: 'bullet',
      label: 'Bulleted list',
      Icon: LuList,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      value: 'ordered',
      label: 'Numbered list',
      Icon: LuListOrdered,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
  ];

  const blocks: Option[] = [
    {
      value: 'blockquote',
      label: 'Quote',
      Icon: LuQuote,
      run: () => editor?.chain().focus().toggleBlockquote().run(),
    },
    {
      value: 'codeBlock',
      label: 'Code',
      Icon: LuCode,
      run: () => editor?.chain().focus().toggleCodeBlock().run(),
    },
  ];

  const aligns: Option[] = [
    {
      value: 'left',
      label: 'Align left',
      Icon: LuAlignLeft,
      run: () => editor?.chain().focus().setTextAlign('left').run(),
    },
    {
      value: 'center',
      label: 'Align centre',
      Icon: LuAlignCenter,
      run: () => editor?.chain().focus().setTextAlign('center').run(),
    },
    {
      value: 'right',
      label: 'Align right',
      Icon: LuAlignRight,
      run: () => editor?.chain().focus().setTextAlign('right').run(),
    },
    {
      value: 'justify',
      label: 'Justify',
      Icon: LuAlignJustify,
      run: () => editor?.chain().focus().setTextAlign('justify').run(),
    },
  ];

  const activeMarks = marks
    .filter((mark) => editor?.isActive(mark.value))
    .map((mark) => mark.value);
  const activeHeadings = headings
    .filter((heading) =>
      editor?.isActive('heading', { level: Number(heading.value) }),
    )
    .map((heading) => heading.value);
  const activeLists = lists
    .filter((list) =>
      editor?.isActive(list.value === 'bullet' ? 'bulletList' : 'orderedList'),
    )
    .map((list) => list.value);
  const activeBlocks = blocks
    .filter((block) => editor?.isActive(block.value))
    .map((block) => block.value);
  const activeAligns = aligns
    .filter((align) => editor?.isActive({ textAlign: align.value }))
    .map((align) => align.value);

  const group = (label: string, options: Option[], active: string[]) => (
    <ToggleGroup
      size="icon-sm"
      spacing={1}
      disabled={off}
      aria-label={label}
      value={active}
      onValueChange={(next: string[]) => runChanged(options, active, next)}
    >
      {options.map(({ value, label: name, Icon }) => (
        <ToggleGroupItem key={value} value={value} aria-label={name}>
          <Icon className="size-4" aria-hidden />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      aria-orientation="horizontal"
      /* `p-1` and the matching scroll padding so a focus ring has room to paint
         — `overflow-x-auto` clips the other axis too. */
      className="scrollbar-hide flex min-w-0 scroll-p-1 items-center gap-1 overflow-x-auto rounded-t-[inherit] border-b bg-muted/40 px-2 py-1.5"
    >
      {group('Text style', marks, activeMarks)}

      <Divider />

      {/* Behind a disclosure: a heading is chosen once for a paragraph, and four
          more icons in the row would bury the marks people use constantly. The
          trigger shows the level in play. */}
      <Disclosure
        label="Headings"
        summary={
          activeHeadings.length > 0 ? `H${activeHeadings[0]}` : undefined
        }
        Icon={LuHeading}
        off={off}
      >
        {group('Headings', headings, activeHeadings)}
      </Disclosure>

      {group('Lists', lists, activeLists)}

      <Divider />

      <Disclosure label="Blocks and alignment" Icon={LuQuote} off={off}>
        <div className="flex flex-col gap-3">
          <Field label="Blocks">{group('Blocks', blocks, activeBlocks)}</Field>
          <Field label="Alignment">
            {group('Alignment', aligns, activeAligns)}
          </Field>
        </div>
      </Disclosure>

      <LinkControl editor={editor} />

      <ImageControl editor={editor} />
    </div>
  );
}

function Divider() {
  return <Separator orientation="vertical" className="mx-1 h-6 shrink-0" />;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** A toolbar button that opens a panel, with the state it stands for on it. */
function Disclosure({
  label,
  summary,
  Icon,
  off,
  children,
}: {
  label: string;
  summary?: string;
  Icon: typeof LuBold;
  off: boolean;
  children: ReactNode;
}) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={off}
                  aria-label={label}
                  className="shrink-0 gap-1 px-2"
                />
              }
            />
          }
        >
          <Icon className="size-4" aria-hidden />
          {summary ? <span className="text-sm">{summary}</span> : null}
          <LuChevronDown className="size-3 opacity-60" aria-hidden />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="sense w-auto p-3">
        {children}
      </PopoverContent>
    </Popover>
  );
}

/**
 * A link needs an address, so it is a small form rather than a toggle. Removing
 * one is offered in the same place, and only when the cursor is in a link —
 * `Unlink` on plain text is a button that cannot do anything.
 */
function LinkControl({ editor }: { editor: Editor | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [href, setHref] = useState('');
  const inLink = Boolean(editor?.isActive('link'));

  const apply = () => {
    const url = href.trim();

    if (!url) {
      return;
    }

    editor
      ?.chain()
      .focus()
      .extendMarkRange('link')
      // Typed bare, so it isn't read as a path on our own domain.
      .setLink({ href: /^https?:\/\//.test(url) ? url : `https://${url}` })
      .run();
    setIsOpen(false);
    setHref('');
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);

        if (open) {
          setHref(editor?.getAttributes('link').href ?? '');
        }
      }}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!editor}
                  aria-label="Link"
                  data-state={inLink ? 'on' : undefined}
                  className="shrink-0"
                />
              }
            />
          }
        >
          <LuLink className="size-4" aria-hidden />
        </TooltipTrigger>
        <TooltipContent>Link</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="sense w-80 p-3">
        <div className="flex flex-col gap-2">
          <Input
            value={href}
            placeholder="common.org"
            aria-label="Address"
            onChange={(event) => setHref(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                apply();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            {inLink ? (
              <Button
                variant="link"
                size="inline"
                onClick={() => {
                  editor?.chain().focus().unsetLink().run();
                  setIsOpen(false);
                }}
              >
                <LuLink2Off className="size-4" aria-hidden />
                Remove link
              </Button>
            ) : (
              <span />
            )}
            <Button size="sm" disabled={!href.trim()} onClick={apply}>
              {inLink ? 'Update' : 'Add link'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * An address rather than a file picker: uploading is the product's job, and a
 * prototype that pretended to store a file would be promising something it
 * cannot do.
 */
function ImageControl({ editor }: { editor: Editor | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [src, setSrc] = useState('');

  const apply = () => {
    const url = src.trim();

    if (!url) {
      return;
    }

    editor?.chain().focus().setImage({ src: url }).run();
    setIsOpen(false);
    setSrc('');
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!editor}
                  aria-label="Image"
                  className="shrink-0"
                />
              }
            />
          }
        >
          <LuImage className="size-4" aria-hidden />
        </TooltipTrigger>
        <TooltipContent>Image</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="sense w-80 p-3">
        <div className="flex flex-col gap-2">
          <Input
            value={src}
            placeholder="https://"
            aria-label="Image address"
            onChange={(event) => setSrc(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                apply();
              }
            }}
          />
          <div className="flex justify-end">
            <Button size="sm" disabled={!src.trim()} onClick={apply}>
              Insert
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
