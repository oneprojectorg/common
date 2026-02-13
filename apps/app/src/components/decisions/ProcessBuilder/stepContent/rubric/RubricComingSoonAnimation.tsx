import { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Syntax highlighting helpers — wrap text in colored <span> tags for the
// code editor animation. These produce raw HTML strings that are later
// rendered via dangerouslySetInnerHTML. All inputs are hardcoded literals
// defined in ANIMATION_BLOCKS below, so there is no XSS risk.
// ---------------------------------------------------------------------------

const highlight = (className: string, text: string) =>
  `<span class="${className}">${text}</span>`;

const keyword = (text: string) => highlight('kw', text);
const string = (text: string) => highlight('str', text);
const comment = (text: string) => highlight('cm', text);
const number = (text: string) => highlight('num', text);

// ---------------------------------------------------------------------------
// Animation script — each block describes a group of lines to type in,
// an optional set of lines to delete, and replacement lines to type in
// character-by-character after deletion.
// ---------------------------------------------------------------------------

interface AnimationLine {
  html: string;
}

interface AnimationBlock {
  /** Lines to type in one by one */
  lines: AnimationLine[];
  /** Pause (ms) after all lines are typed before edits begin */
  pause: number;
  /** Indices (relative to this block's lines) to delete character-by-character */
  deleteIndices: number[];
  /** Replacement lines to type in after deletion */
  insertions: AnimationLine[];
}

const ANIMATION_BLOCKS: AnimationBlock[] = [
  {
    lines: [
      { html: comment('// COWOP review rubric') },
      { html: `rubric = ${string('"Proposal Review"')}` },
      { html: '' },
      { html: comment('// screening') },
      { html: `isWorkerCoop = ${keyword('true')}` },
      { html: `registeredInMA = ${keyword('true')}` },
      { html: `minWorkerOwners = ${number('3')}` },
    ],
    pause: 1400,
    deleteIndices: [6],
    insertions: [
      { html: `minWorkerOwners = ${number('3')} ${comment('// ✓ qualified')}` },
    ],
  },
  {
    lines: [
      { html: '' },
      { html: comment('// evaluation criteria') },
      { html: 'criteria = [' },
      { html: `  ${string('"Need"')},` },
      { html: `  ${string('"Feasibility"')},` },
      { html: `  ${string('"Co-op Impact"')},` },
      { html: `  ${string('"Community Impact"')},` },
      { html: ']' },
    ],
    pause: 1200,
    deleteIndices: [7],
    insertions: [
      { html: `  ${string('"Equity & Alignment"')},` },
      { html: `] ${comment('// almost forgot one')}` },
    ],
  },
  {
    lines: [
      { html: '' },
      { html: comment('// scoring') },
      { html: `scoreRange = ${number('0')} to ${number('5')}` },
      { html: `requireReasoning = ${keyword('false')}` },
    ],
    pause: 1100,
    deleteIndices: [3],
    insertions: [
      {
        html: `requireReasoning = ${keyword('true')} ${comment('// yes plz')}`,
      },
    ],
  },
  {
    lines: [{ html: '' }, { html: comment('// brb getting coffee ☕') }],
    pause: 2000,
    deleteIndices: [],
    insertions: [],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Strip HTML tags to get the visible character count of an HTML string. */
function getVisibleLength(html: string): number {
  return html.replace(/<[^>]*>/g, '').length;
}

/**
 * Truncate an HTML string to `maxChars` visible characters while keeping
 * tags intact. Unclosed <span> tags are automatically closed.
 */
function truncateHtml(html: string, maxChars: number): string {
  let visibleCount = 0;
  let result = '';
  let insideTag = false;

  for (let i = 0; i < html.length; i++) {
    const char = html[i];
    if (char === '<') {
      insideTag = true;
      result += char;
      continue;
    }
    if (char === '>') {
      insideTag = false;
      result += char;
      continue;
    }
    if (insideTag) {
      result += char;
      continue;
    }
    if (visibleCount >= maxChars) {
      break;
    }
    result += char;
    visibleCount++;
  }

  // Close any unclosed <span> tags
  const openCount = (result.match(/<span[^>]*>/g) || []).length;
  const closeCount = (result.match(/<\/span>/g) || []).length;
  for (let i = 0; i < openCount - closeCount; i++) {
    result += '</span>';
  }

  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LineState {
  id: string;
  html: string;
  animationClass: 'adding' | 'removing' | '';
}

export function CodeAnimation() {
  const [lines, setLines] = useState<LineState[]>([]);
  const [cursorLine, setCursorLine] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (!scrollRef.current || !viewportRef.current) {
      return;
    }
    const contentHeight = scrollRef.current.scrollHeight;
    const viewportHeight = viewportRef.current.clientHeight;
    const padding = 20;
    const overflow = contentHeight - viewportHeight + padding;
    scrollRef.current.style.transform =
      overflow > 0 ? `translateY(${-overflow}px)` : 'translateY(0)';
  };

  useEffect(() => {
    let cancelled = false;

    async function runAnimation() {
      while (!cancelled) {
        let currentLines: LineState[] = [];
        setLines([]);
        setCursorLine(-1);
        if (scrollRef.current) {
          scrollRef.current.style.transform = 'translateY(0)';
        }
        await sleep(400);

        for (const block of ANIMATION_BLOCKS) {
          if (cancelled) {
            return;
          }

          // Phase 1: Type in lines one by one
          for (let i = 0; i < block.lines.length; i++) {
            if (cancelled) {
              return;
            }
            const id = `${Date.now()}-${Math.random()}`;
            currentLines = [
              ...currentLines,
              { id, html: block.lines[i]!.html, animationClass: 'adding' },
            ];
            setLines([...currentLines]);
            await sleep(110 + Math.random() * 80);
            setTimeout(scrollToBottom, 10);
          }

          // Phase 2: Pause with cursor blinking on the last line
          setCursorLine(currentLines.length - 1);
          await sleep(block.pause);

          // Phase 3: Delete specified lines character by character
          const blockStartIndex = currentLines.length - block.lines.length;
          for (const relativeIndex of block.deleteIndices) {
            const lineIndex = blockStartIndex + relativeIndex;
            const fullHtml = currentLines[lineIndex]!.html;
            const totalChars = getVisibleLength(fullHtml);

            for (let charCount = totalChars; charCount >= 0; charCount--) {
              if (cancelled) {
                return;
              }
              const truncated = truncateHtml(fullHtml, charCount);
              currentLines = currentLines.map((line, i) =>
                i === lineIndex ? { ...line, html: truncated } : line,
              );
              setCursorLine(lineIndex);
              setLines([...currentLines]);
              await sleep(25 + Math.random() * 15);
            }

            // Remove the now-empty line
            currentLines = currentLines.filter((_, i) => i !== lineIndex);
            setLines([...currentLines]);
            setCursorLine(-1);
            setTimeout(scrollToBottom, 10);
            await sleep(150);
          }

          await sleep(200);

          // Phase 4: Type in replacement lines character by character
          for (const insertion of block.insertions) {
            if (cancelled) {
              return;
            }
            const id = `${Date.now()}-${Math.random()}`;
            const totalChars = getVisibleLength(insertion.html);

            // Add an empty line, then fill it in character by character
            currentLines = [
              ...currentLines,
              { id, html: '', animationClass: 'adding' },
            ];
            setLines([...currentLines]);
            const lineIndex = currentLines.length - 1;
            setCursorLine(lineIndex);

            for (let charCount = 1; charCount <= totalChars; charCount++) {
              if (cancelled) {
                return;
              }
              const truncated = truncateHtml(insertion.html, charCount);
              currentLines = currentLines.map((line, i) =>
                i === lineIndex ? { ...line, html: truncated } : line,
              );
              setLines([...currentLines]);
              await sleep(30 + Math.random() * 20);
              setTimeout(scrollToBottom, 10);
            }

            setCursorLine(-1);
          }
          await sleep(500);
        }

        // Fade out all lines and reset
        await sleep(2000);
        currentLines = currentLines.map((line) => ({
          ...line,
          animationClass: 'removing',
        }));
        setLines([...currentLines]);
        await sleep(400);
        setLines([]);
        if (scrollRef.current) {
          scrollRef.current.style.transform = 'translateY(0)';
        }
        await sleep(800);
      }
    }

    runAnimation();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-transparent">
      <style>{`
        .ce-line { white-space: pre; min-height: 1.65em; }
        .ce-line.removing { animation: ceRemove 0.15s ease forwards; }
        .ce-line.adding { animation: ceAdd 0.2s ease forwards; }
        @keyframes ceRemove {
          0% { opacity: 1; height: 1.65em; }
          100% { opacity: 0; height: 0; min-height: 0; overflow: hidden; }
        }
        @keyframes ceAdd { from { opacity: 0; } to { opacity: 1; } }
        .ce-cursor {
          display: inline-block; width: 1.5px; height: 11px; background: #2BA880;
          vertical-align: text-bottom; animation: ceBlink 0.85s step-end infinite;
        }
        @keyframes ceBlink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        .kw { color: #2BA880; } .str { color: #48B5A0; }
        .cm { color: #C0C0C0; font-style: italic; } .num { color: #E8913A; }
      `}</style>
      <div className="flex h-[200px] w-[300px] flex-col overflow-hidden rounded-xl border bg-white font-mono shadow-md shadow-teal/5">
        <div className="flex shrink-0 items-center gap-2 border-b border-neutral-gray1 bg-white px-2 py-1.5 font-sans text-xs text-neutral-gray4">
          <div className="flex gap-0.75">
            <div className="size-2 rounded-full bg-neutral-gray2/60" />
            <div className="size-2 rounded-full bg-neutral-gray2/60" />
            <div className="size-2 rounded-full bg-neutral-gray2/60" />
          </div>
          <span>review-rubric.tsx</span>
        </div>
        <div
          ref={viewportRef}
          className="flex-1 overflow-hidden bg-[#F5FBFB] px-3 py-2.5 text-xs/2 text-neutral-gray4"
        >
          <div
            ref={scrollRef}
            className="transition-transform duration-300 ease-out"
          >
            {lines.map((line, i) => (
              <div
                key={line.id}
                className={`ce-line ${line.animationClass}`}
                dangerouslySetInnerHTML={{
                  __html:
                    line.html +
                    (cursorLine === i ? '<span class="ce-cursor"></span>' : ''),
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
