import { useEffect, useRef, useState } from 'react';

const S = (c: string, t: string) => `<span class="${c}">${t}</span>`;
const kw = (t: string) => S('kw', t),
  str = (t: string) => S('str', t),
  cm = (t: string) => S('cm', t),
  n = (t: string) => S('num', t);

// plaintext versions for character-by-character deletion
const blocks = [
  {
    lines: [
      {
        html: `${cm('// COWOP review rubric')}`,
        raw: '// COWOP review rubric',
      },
      {
        html: `rubric = ${str('"Proposal Review"')}`,
        raw: 'rubric = "Proposal Review"',
      },
      { html: ``, raw: '' },
      { html: `${cm('// screening')}`, raw: '// screening' },
      { html: `isWorkerCoop = ${kw('true')}`, raw: 'isWorkerCoop = true' },
      { html: `registeredInMA = ${kw('true')}`, raw: 'registeredInMA = true' },
      { html: `minWorkerOwners = ${n('3')}`, raw: 'minWorkerOwners = 3' },
    ],
    pause: 1400,
    del: [6],
    delRaw: ['minWorkerOwners = 3'],
    ins: [
      {
        html: `minWorkerOwners = ${n('3')} ${cm('// ✓ qualified')}`,
        raw: 'minWorkerOwners = 3 // ✓ qualified',
      },
    ],
  },
  {
    lines: [
      { html: ``, raw: '' },
      {
        html: `${cm('// evaluation criteria')}`,
        raw: '// evaluation criteria',
      },
      { html: `criteria = [`, raw: 'criteria = [' },
      { html: `  ${str('"Need"')},`, raw: '  "Need",' },
      { html: `  ${str('"Feasibility"')},`, raw: '  "Feasibility",' },
      { html: `  ${str('"Co-op Impact"')},`, raw: '  "Co-op Impact",' },
      { html: `  ${str('"Community Impact"')},`, raw: '  "Community Impact",' },
      { html: `]`, raw: ']' },
    ],
    pause: 1200,
    del: [7],
    delRaw: [']'],
    ins: [
      {
        html: `  ${str('"Equity & Alignment"')},`,
        raw: '  "Equity & Alignment",',
      },
      {
        html: `] ${cm('// almost forgot one')}`,
        raw: '] // almost forgot one',
      },
    ],
  },
  {
    lines: [
      { html: ``, raw: '' },
      { html: `${cm('// scoring')}`, raw: '// scoring' },
      {
        html: `scoreRange = ${n('0')} to ${n('5')}`,
        raw: 'scoreRange = 0 to 5',
      },
      {
        html: `requireReasoning = ${kw('false')}`,
        raw: 'requireReasoning = false',
      },
    ],
    pause: 1100,
    del: [3],
    delRaw: ['requireReasoning = false'],
    ins: [
      {
        html: `requireReasoning = ${kw('true')} ${cm('// yes plz')}`,
        raw: 'requireReasoning = true // yes plz',
      },
    ],
  },
  {
    lines: [
      { html: ``, raw: '' },
      {
        html: `${cm('// brb getting coffee ☕')}`,
        raw: '// brb getting coffee ☕',
      },
    ],
    pause: 2000,
    del: [],
    delRaw: [],
    ins: [],
  },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// strip html tags to get visible char count
function stripTags(html: string) {
  return html.replace(/<[^>]*>/g, '');
}

// rebuild html truncated to n visible characters
function truncateHtml(html: string, maxChars: number) {
  let visible = 0,
    result = '',
    inTag = false;
  for (let i = 0; i < html.length; i++) {
    const ch = html[i];
    if (ch === '<') {
      inTag = true;
      result += ch;
      continue;
    }
    if (ch === '>') {
      inTag = false;
      result += ch;
      continue;
    }
    if (inTag) {
      result += ch;
      continue;
    }
    if (visible >= maxChars) break;
    result += ch;
    visible++;
  }
  // close any open spans
  const opens = (result.match(/<span[^>]*>/g) || []).length;
  const closes = (result.match(/<\/span>/g) || []).length;
  for (let i = 0; i < opens - closes; i++) result += '</span>';
  return result;
}

export function CodeAnimation() {
  const [lines, setLines] = useState<
    { id: string; html: string; state: string }[]
  >([]);
  const [cursorLine, setCursorLine] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (!scrollRef.current || !areaRef.current) return;
    const scrollH = scrollRef.current.scrollHeight;
    const viewH = areaRef.current.clientHeight;
    const padding = 20;
    const overflow = scrollH - viewH + padding;
    scrollRef.current.style.transform =
      overflow > 0 ? `translateY(${-overflow}px)` : 'translateY(0)';
  };

  useEffect(() => {
    let cancelled = false;

    async function run() {
      while (!cancelled) {
        let current: { id: string; html: string; state: string }[] = [];
        setLines([]);
        setCursorLine(-1);
        if (scrollRef.current)
          scrollRef.current.style.transform = 'translateY(0)';
        await sleep(400);

        for (const b of blocks) {
          if (cancelled) return;
          // type lines in
          for (let i = 0; i < b.lines.length; i++) {
            if (cancelled) return;
            const id = Date.now() + '-' + Math.random();
            current = [
              ...current,
              { id, html: b.lines[i]!.html, state: 'adding' },
            ];
            setLines([...current]);
            await sleep(110 + Math.random() * 80);
            setTimeout(scrollToBottom, 10);
          }

          // show cursor
          setCursorLine(current.length - 1);
          await sleep(b.pause);

          // backspace delete character by character
          const base = current.length - b.lines.length;
          for (const di of b.del) {
            const idx = base + di;
            const fullHtml = current[idx]!.html;
            const totalChars = stripTags(fullHtml).length;

            for (let c = totalChars; c >= 0; c--) {
              if (cancelled) return;
              const truncated = truncateHtml(fullHtml, c);
              current = current.map((l, i) =>
                i === idx ? { ...l, html: truncated } : l,
              );
              setCursorLine(idx);
              setLines([...current]);
              await sleep(25 + Math.random() * 15);
            }

            // remove empty line
            current = current.filter((_, i) => i !== idx);
            setLines([...current]);
            setCursorLine(-1);
            setTimeout(scrollToBottom, 10);
            await sleep(150);
          }

          await sleep(200);

          // type in replacements character by character
          for (const ins of b.ins) {
            if (cancelled) return;
            const id = Date.now() + '-' + Math.random();
            const totalChars = stripTags(ins.html).length;

            // add empty line first
            current = [...current, { id, html: '', state: 'adding' }];
            setLines([...current]);
            const lineIdx = current.length - 1;
            setCursorLine(lineIdx);

            for (let c = 1; c <= totalChars; c++) {
              if (cancelled) return;
              const truncated = truncateHtml(ins.html, c);
              current = current.map((l, i) =>
                i === lineIdx ? { ...l, html: truncated } : l,
              );
              setLines([...current]);
              await sleep(30 + Math.random() * 20);
              setTimeout(scrollToBottom, 10);
            }

            setCursorLine(-1);
          }
          await sleep(500);
        }

        await sleep(2000);
        // fade out
        current = current.map((l) => ({ ...l, state: 'removing' }));
        setLines([...current]);
        await sleep(400);
        setLines([]);
        if (scrollRef.current)
          scrollRef.current.style.transform = 'translateY(0)';
        await sleep(800);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ background: 'transparent' }}>
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
      <div
        style={{
          width: 300,
          height: 200,
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: "'Roboto Mono', monospace",
        }}
      >
        <div
          style={{
            padding: '8px 10px',
            borderBottom: '1px solid #F0F0F0',
            fontFamily: "'Roboto', sans-serif",
            fontSize: 10,
            color: '#999',
            flexShrink: 0,
            background: '#fff',
          }}
        >
          review-rubric.tsx
        </div>
        <div
          ref={areaRef}
          style={{
            flex: 1,
            padding: '10px 12px',
            overflow: 'hidden',
            fontSize: 10,
            lineHeight: 1.65,
            color: '#999',
            background: '#F5FBFB',
          }}
        >
          <div
            ref={scrollRef}
            style={{ transition: 'transform 0.3s ease-out' }}
          >
            {lines.map((l, i) => (
              <div
                key={l.id}
                className={`ce-line ${l.state}`}
                dangerouslySetInnerHTML={{
                  __html:
                    l.html +
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
