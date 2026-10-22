import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import postcss, { AtRule } from 'postcss';
import type { Declaration, Root } from 'postcss';

import { REPO_DIR, SENSE_DIR, STYLES_DIR } from './util.ts';

// tokens.json in the shape the Design System page reads: every family but
// `type` is a flat list of {name, value, usage}. Values come from
// packages/styles; the usage notes below are this file's only prose.

export interface Token {
  name: string;
  value: string;
  usage: string;
}

interface TypeStyle {
  name: string;
  fontSize: string;
  lineHeight: string | number;
  fontWeight: number;
  letterSpacing?: string;
  usage: string;
}

interface FontFile {
  family: string;
  file: string;
  weight: string;
  style: 'normal' | 'italic';
}

export interface Tokens {
  name: string;
  version: number;
  color: { themes: { id: string; name: string }[]; tokens: Token[] };
  type: {
    fonts: FontFile[];
    families: Record<string, string>;
    groups: { name: string; family: string; styles: TypeStyle[] }[];
  };
  spacing: { tokens: Token[] };
  radius: { tokens: Token[] };
  shadow: { tokens: Token[] };
  breakpoint: { note: string; tokens: Token[] };
  fontWeight: { tokens: Token[] };
  meta: Record<string, unknown>;
}

/** Text colours, and the grounds each must read on (checked at 4.5:1). */
const TEXT_ON: Record<string, string[]> = {
  foreground: ['background', 'muted', 'secondary'],
  'muted-foreground': ['background', 'muted'],
  primary: ['background'],
  'primary-foreground': ['primary'],
  'accent-foreground': ['accent'],
  'destructive-foreground': ['destructive'],
  'warning-foreground': ['warning'],
  'success-foreground': ['success'],
};

/** Marks that must read at 3:1: control borders, focus ring, status icons. */
const MARK_ON: Record<string, string[]> = {
  input: ['background'],
  ring: ['background'],
  warning: ['warning-muted'],
  success: ['success-muted'],
  destructive: ['destructive-muted'],
};

const COLOR_USAGE: Record<string, string> = {
  background: 'Page background.',
  foreground: 'Body text and headings on every surface and muted fill.',
  card: 'Card surface.',
  'card-foreground': 'Text on `card`.',
  popover: 'Popover, menu and dropdown surface.',
  'popover-foreground': 'Text on `popover`.',
  primary:
    'The brand action colour: default Button, Badge, checked Checkbox and Switch, links.',
  'primary-foreground': 'Text and icons on `primary`.',
  secondary:
    'Neutral fill: secondary Button, secondary Badge, inactive StatusBadge.',
  'secondary-foreground': 'Text on `secondary`.',
  muted:
    'Quiet surface: hover fills, disabled inputs, card footers, Kbd. Design-approved off-ramp value.',
  'muted-foreground': 'Secondary text: descriptions, placeholders, captions.',
  accent: 'Selected or highlighted rows, accent Badge.',
  'accent-foreground': 'Text on `accent`.',
  destructive: 'Destructive Button fill, error borders, invalid rings.',
  'destructive-foreground': 'Text on `destructive`.',
  'destructive-muted': 'Error Alert fill, small destructive Buttons.',
  'destructive-muted-foreground': 'Text on `destructive-muted`.',
  warning: 'Warning Alert border and StatusBadge icon.',
  'warning-foreground': 'Text on `warning`.',
  'warning-muted': 'Warning Alert, Badge and StatusBadge fill.',
  'warning-muted-foreground': 'Text on `warning-muted`.',
  success: 'Success StatusBadge icon.',
  'success-foreground': 'Text on `success`.',
  'success-muted': 'Success StatusBadge fill.',
  'success-muted-foreground': 'Text on `success-muted`.',
  input:
    'Control borders (Input, Textarea, Checkbox, outline Button) and the scrollbar thumb.',
  border: 'Default hairline: cards, separators, bare `border`. Decorative.',
  ring: 'Focus ring, drawn 3px at 50% opacity.',
  'ring-offset': 'Gap between a control and its focus ring.',
  overlay: 'Modal and drawer scrim, applied with opacity.',
  mark: 'Rich-text highlight. Off-ramp, between teal-50 and teal-100.',
  'color-white':
    "Tailwind's white. `background`, `card` and `popover` alias it.",
};

const HUE_USAGE: Record<string, string> = {
  red: 'Destructive and alert states.',
  orange: 'Warning states and chart-1.',
  yellow: 'Highlights and chart-4.',
  green: 'Success states.',
  teal: 'The brand hue: `primary` and `accent`.',
  blue: 'Chart-3 and illustration.',
  purple: 'Chart-5 and avatar gradients.',
  gray: 'Neutrals: text, borders and quiet fills.',
};

const TAILWIND_DEFAULTS = {
  radius: {
    'radius-sm': '4px',
    'radius-md': '6px',
    'radius-xl': '12px',
    'radius-2xl': '16px',
    'radius-full': '9999px',
  },
  shadow: {
    'shadow-2xs': '0px 1px 0px rgba(0, 0, 0, 0.05)',
    'shadow-sm':
      '0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px -1px rgba(0, 0, 0, 0.1)',
  },
  breakpoint: {
    'breakpoint-sm': '640px',
    'breakpoint-md': '768px',
    'breakpoint-lg': '1024px',
    'breakpoint-xl': '1280px',
    'breakpoint-2xl': '1536px',
  },
};

const LENGTH_USAGE: Record<string, string> = {
  'space-1':
    'Tailwind base step (`--spacing` 0.25rem). Gap inside xs/sm Buttons and Badges.',
  'space-1.5': 'Gap between icon and label in default Buttons.',
  'space-2': 'Field gaps, StatusBadge inset, small paddings.',
  'space-3': 'Input side padding, sm Button padding.',
  'space-4': 'Button side padding, Card and Alert padding.',
  'space-6': 'Section gaps.',
  'space-8': 'Large section gaps.',
  'control-sm': '`h-8`. Small Buttons, icon-sm.',
  'control-default': '`h-11`. Default height for Button, Input, TabsList.',
  'control-lg': '`h-12`. Large Buttons.',
  'spacing-18': '`--spacing-18`. Wide layout gutters.',
  'spacing-editor-topbar': 'Proposal editor top bar height.',
  'radius-xs': 'Square corners.',
  'radius-sm': 'Badge, Kbd, Checkbox.',
  'radius-md': 'Small Buttons, Tab triggers, StatusBadge.',
  radius:
    '`--radius` and `rounded-lg`. Buttons, Inputs, Cards, Alerts, Tabs list.',
  'radius-xl': 'Larger panels.',
  'radius-2xl': 'Hero cards.',
  'radius-full': 'Avatars, Switch, number badges.',
  'shadow-2xs': 'Cards.',
  'shadow-sm': 'Active tab, Switch thumb.',
  'shadow-light': 'Soft lift for floating panels.',
  'shadow-green': 'Celebration glow.',
  'shadow-orange': 'Attention glow.',
  'breakpoint-md': 'The type scale switches to its `-md` sizes here.',
};

/** Steps the components use; Tailwind's 4px base, not declared in the repo. */
const SPACING_STEPS = ['1', '1.5', '2', '3', '4', '6', '8'];
const CONTROL_HEIGHTS = {
  'control-sm': '32px',
  'control-default': '44px',
  'control-lg': '48px',
};

/** Tailwind's own sans sizes, which the components use for control and body text. */
const SANS_STYLES = [
  ['base', '16px', '24px', 400, '`text-base`. Body copy, inputs, card text.'],
  [
    'base-strong',
    '16px',
    '24px',
    450,
    '`text-base font-strong`. Buttons, form labels, tab triggers.',
  ],
  ['sm', '14px', '20px', 400, '`text-sm`. Field descriptions, small buttons.'],
  [
    'sm-strong',
    '14px',
    '20px',
    450,
    '`text-sm font-strong`. StatusBadge labels.',
  ],
  ['xs', '12px', '16px', 400, '`text-xs`. Fine print.'],
  ['xs-strong', '12px', '16px', 450, '`text-xs font-strong`. Badge and Kbd.'],
] as const;

const SERIF_USAGE: Record<string, string> = {
  display: 'Page heroes.',
  headline: 'Page titles.',
  title: 'Dialog, sheet and card titles.',
  label:
    'Small serif heading: popover and small-card titles. Not a form label.',
};

/** Font files, from the Fontsource packages (OFL). Latin Roboto; Arabic Rubik. */
const FONTS: (FontFile & { package: string; source: string })[] = [
  {
    family: 'Roboto',
    package: '@fontsource-variable/roboto',
    source: 'roboto-latin-wght-normal.woff2',
    file: 'fonts/roboto-latin-wght-normal.woff2',
    weight: '100 900',
    style: 'normal',
  },
  {
    family: 'Roboto',
    package: '@fontsource-variable/roboto',
    source: 'roboto-latin-wght-italic.woff2',
    file: 'fonts/roboto-latin-wght-italic.woff2',
    weight: '100 900',
    style: 'italic',
  },
  ...(['300', '400'] as const).flatMap((weight) =>
    (['normal', 'italic'] as const).map((style) => ({
      family: 'Roboto Serif',
      package: '@fontsource/roboto-serif',
      source: `roboto-serif-latin-${weight}-${style}.woff2`,
      file: `fonts/roboto-serif-latin-${weight}-${style}.woff2`,
      weight,
      style,
    })),
  ),
  {
    family: 'Rubik',
    package: '@fontsource-variable/rubik',
    source: 'rubik-arabic-wght-normal.woff2',
    file: 'fonts/rubik-arabic-wght-normal.woff2',
    weight: '300 900',
    style: 'normal',
  },
];

export function buildTokens(projectDir: string): Tokens {
  const tokensCss = parse(resolve(STYLES_DIR, 'tokens.css'));
  const themeCss = parse(resolve(STYLES_DIR, 'theme.css'));
  const raw = declarations(tokensCss);

  const colors = readColors(tokensCss, themeCss);
  copyFonts(projectDir);

  return {
    name: 'Sense',
    version: 1,
    color: { themes: [{ id: 'light', name: 'Light' }], tokens: colors },
    type: {
      fonts: FONTS.map(({ family, file, weight, style }) => ({
        family,
        file,
        weight,
        style,
      })),
      families: {
        sans: stack(raw, 'font-sans'),
        serif: stack(raw, 'font-serif'),
        mono: stack(raw, 'font-mono'),
      },
      groups: readTypeGroups(themeCss),
    },
    spacing: {
      tokens: [
        ...SPACING_STEPS.map((step) =>
          token(`space-${step}`, `${Number(step) * 4}px`),
        ),
        ...Object.entries(raw)
          .filter(([name]) => name.startsWith('spacing-'))
          .map(([name, value]) => token(name, px(value))),
        ...Object.entries(CONTROL_HEIGHTS).map(([name, value]) =>
          token(name, value),
        ),
      ],
    },
    radius: {
      tokens: withDefaults(
        Object.entries(raw).filter(([name]) => /^radius(-|$)/.test(name)),
        TAILWIND_DEFAULTS.radius,
      ).map(([name, value]) => token(name, px(value))),
    },
    shadow: {
      tokens: withDefaults(
        Object.entries(raw).filter(([name]) => name.startsWith('shadow-')),
        TAILWIND_DEFAULTS.shadow,
      ).map(([name, value]) => token(name, value)),
    },
    breakpoint: {
      note: 'Viewport widths for responsive utilities.',
      tokens: withDefaults(
        Object.entries(raw).filter(([name]) => name.startsWith('breakpoint-')),
        TAILWIND_DEFAULTS.breakpoint,
      ).map(([name, value]) => token(name, value)),
    },
    fontWeight: {
      tokens: [
        {
          name: 'font-weight-strong',
          value: declarations(themeCss)['font-weight-strong'] ?? '450',
          usage:
            '`font-strong`. Between normal and medium: buttons, labels, badges, Kbd.',
        },
      ],
    },
    meta: {
      source: 'github',
      repo: 'oneprojectorg/common',
      ref: execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
        cwd: REPO_DIR,
        encoding: 'utf8',
      }).trim(),
      package: 'packages/sense, packages/styles',
      paths: {
        tokens: ['packages/styles/tokens.css', 'packages/styles/theme.css'],
        fonts: FONTS.map((font) => font.package).filter(
          (p, i, all) => all.indexOf(p) === i,
        ),
      },
      synced: new Date().toISOString().slice(0, 10),
    },
  };
}

function readColors(tokensCss: Root, themeCss: Root): Token[] {
  const values = new Map<string, string>([['color-white', '#ffffff']]);
  const tokens: Token[] = [
    token('color-white', '#ffffff', COLOR_USAGE['color-white']),
  ];

  // Ramps (`--color-teal-500`) and the off-ramp gradient stops (`--brand-*`).
  tokensCss.walkDecls((decl) => {
    const name = decl.prop.slice(2);
    const ramp = /^color-([a-z]+)-(\d+)$/.exec(name);
    if (ramp || name.startsWith('brand-')) {
      values.set(name, decl.value.toLowerCase());
      const hue = ramp?.[1] ?? '';
      const usage = ramp
        ? ramp[2] === '500'
          ? (HUE_USAGE[hue] ?? '')
          : `${capitalize(hue)} ramp, step ${ramp[2]}. Reach for a semantic token first.`
        : 'Brand gradient stop off the ramp. Read through var() only.';
      tokens.push(token(name, decl.value.toLowerCase(), usage));
    }
  });

  // The semantic layer: theme.css's top-level `:root` block.
  const semantic: [string, string][] = [];
  themeCss.each((node) => {
    if (node.type !== 'rule' || node.selector !== ':root') return;
    node.walkDecls((decl) => {
      if (decl.prop.startsWith('--') && decl.prop !== '--radius') {
        semantic.push([decl.prop.slice(2), decl.value.trim()]);
      }
    });
  });
  for (const [name, value] of semantic) {
    const alias = /^var\(--([\w-]+)\)$/.exec(value)?.[1];
    if (alias && !values.has(alias)) {
      throw new Error(`--${name} aliases unknown --${alias}`);
    }
    values.set(
      name,
      alias ? (values.get(alias) ?? value) : value.toLowerCase(),
    );
    tokens.push(
      token(
        name,
        alias ? `{${alias}}` : value.toLowerCase(),
        COLOR_USAGE[name] ?? usageFromName(name),
      ),
    );
  }

  // Contrast, measured on the resolved values so a palette change updates the notes.
  for (const t of tokens) {
    const checks = [
      ...(TEXT_ON[t.name] ?? []).map((ground) => [ground, 4.5] as const),
      ...(MARK_ON[t.name] ?? []).map((ground) => [ground, 3] as const),
    ];
    const notes = checks.map(([ground, floor]) => {
      const ratio = contrast(values.get(t.name), values.get(ground));
      const flag = ratio < floor ? ` (under ${floor}:1)` : '';
      return `${ratio.toFixed(1)}:1 on \`${ground}\`${flag}`;
    });
    if (notes.length)
      t.usage = `${t.usage} Contrast: ${notes.join(', ')}.`.trim();
  }
  return tokens;
}

function readTypeGroups(themeCss: Root): Tokens['type']['groups'] {
  const base: Record<string, string> = {};
  const desktop: Record<string, string> = {};
  themeCss.walkDecls((decl) => {
    if (!decl.prop.startsWith('--text-')) return;
    const media = decl.parent?.parent;
    const inDesktop = media instanceof AtRule && media.params.includes('768px');
    (inDesktop ? desktop : base)[decl.prop.slice(7)] = decl.value.trim();
  });

  const serif: TypeStyle[] = [];
  for (const step of ['display', 'headline', 'title', 'label']) {
    const style = (
      sizes: Record<string, string>,
      suffix: string,
      where: string,
    ): TypeStyle | null => {
      const size = sizes[step] ?? base[step];
      const lineHeight =
        sizes[`${step}--line-height`] ?? base[`${step}--line-height`];
      if (!size || !lineHeight) return null;
      return {
        name: `serif-${step}${suffix}`,
        fontSize: px(size),
        lineHeight: px(lineHeight),
        fontWeight: 400,
        letterSpacing: base[`${step}--letter-spacing`],
        usage: `\`text-${step}\`${where}. ${SERIF_USAGE[step] ?? ''}`,
      };
    };
    const hasDesktop = desktop[step] !== undefined;
    const wide = hasDesktop ? style(desktop, '-md', ' from 768px up') : null;
    const narrow = style({}, '', hasDesktop ? ' below 768px' : '');
    for (const s of [wide, narrow]) if (s) serif.push(s);
  }

  const legacy: TypeStyle[] = ['lg', 'base', 'sm14'].flatMap((step) => {
    const size = base[`title-${step}`];
    if (!size) return [];
    return [
      {
        name: `legacy-title-${step}`,
        fontSize: px(size),
        lineHeight:
          Number.parseFloat(base[`title-${step}--line-height`] ?? '120') / 100,
        fontWeight: Number(base[`title-${step}--font-weight`] ?? 400),
        letterSpacing: base[`title-${step}--letter-spacing`],
        usage:
          'Retired pre-sense scale, kept for stored rich text. Never use in new work.',
      },
    ];
  });

  return [
    { name: 'Headings', family: 'serif', styles: serif },
    {
      name: 'Text',
      family: 'sans',
      styles: SANS_STYLES.map(
        ([name, fontSize, lineHeight, fontWeight, usage]) => ({
          name: `sans-${name}`,
          fontSize,
          lineHeight,
          fontWeight,
          usage,
        }),
      ),
    },
    { name: 'Legacy (rich text only)', family: 'serif', styles: legacy },
  ];
}

function copyFonts(projectDir: string) {
  const require = createRequire(resolve(SENSE_DIR, 'package.json'));
  for (const font of FONTS) {
    const pkgDir = dirname(require.resolve(`${font.package}/package.json`));
    const target = resolve(projectDir, font.file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(resolve(pkgDir, 'files', font.source), target);
  }
}

/** The page's compiled form of tokens.json: variables, type classes, @font-face. */
export function tokensCss(tokens: Tokens): string {
  const value = (v: string) => v.replace(/^\{(.+)\}$/, 'var(--$1)');
  const decl = (t: Token) =>
    `  --${t.name.replace(/\./g, '\\.')}: ${value(t.value)}; /* ${t.usage.replace(/\*\//g, '*\\/')} */`;
  const families = Object.entries(tokens.type.families).map(
    ([key, stack]) => `  --font-${key}: ${stack};`,
  );
  const styles = tokens.type.groups.flatMap((group) =>
    group.styles.map((style) => ({ ...style, family: group.family })),
  );
  return [
    `/* ${tokens.name} — generated from tokens.json */`,
    ':root, [data-theme="light"] {',
    ...tokens.color.tokens.map(decl),
    ...tokens.shadow.tokens.map(decl),
    '}',
    ':root {',
    ...[
      ...tokens.spacing.tokens,
      ...tokens.radius.tokens,
      ...tokens.breakpoint.tokens,
      ...tokens.fontWeight.tokens,
    ].map(decl),
    ...families,
    ...styles.map(
      (s) =>
        `  --text-${s.name}: ${s.fontWeight} ${s.fontSize}/${s.lineHeight} var(--font-${s.family}); /* ${s.usage} */`,
    ),
    '}',
    ...styles.map((s) =>
      [
        `.${s.name} {`,
        `  font-family: var(--font-${s.family});`,
        `  font-size: ${s.fontSize};`,
        `  line-height: ${s.lineHeight};`,
        `  font-weight: ${s.fontWeight};`,
        ...(s.letterSpacing ? [`  letter-spacing: ${s.letterSpacing};`] : []),
        '}',
      ].join('\n'),
    ),
    ...tokens.type.fonts.map((font) =>
      [
        '@font-face {',
        `  font-family: "${font.family}";`,
        `  src: url("${font.file}") format("woff2");`,
        `  font-weight: ${font.weight};`,
        `  font-style: ${font.style};`,
        '  font-display: swap;',
        '}',
      ].join('\n'),
    ),
    '',
  ].join('\n');
}

/** Every token name, as the CSS custom property tokens.css declares. */
export function tokenNames(tokens: Tokens): Set<string> {
  const lists = [
    tokens.color,
    tokens.spacing,
    tokens.radius,
    tokens.shadow,
    tokens.breakpoint,
    tokens.fontWeight,
  ];
  return new Set([
    ...lists.flatMap((list) => list.tokens.map((t) => t.name)),
    ...Object.keys(tokens.type.families).map((key) => `font-${key}`),
  ]);
}

function parse(path: string): Root {
  return postcss.parse(readFileSync(path, 'utf8'), { from: path });
}

function declarations(root: Root): Record<string, string> {
  const out: Record<string, string> = {};
  root.walkDecls((decl: Declaration) => {
    if (decl.prop.startsWith('--')) out[decl.prop.slice(2)] = decl.value.trim();
  });
  return out;
}

/** A font stack on one line with double quotes, as tokens.json wants it. */
function stack(raw: Record<string, string>, name: string): string {
  const value = raw[name];
  if (!value) throw new Error(`packages/styles/tokens.css has no --${name}`);
  return value.replace(/\s+/g, ' ').replace(/'/g, '"');
}

function withDefaults(
  found: [string, string][],
  defaults: Record<string, string>,
): [string, string][] {
  const names = new Set(found.map(([name]) => name));
  const merged = [
    ...found,
    ...Object.entries(defaults).filter(([name]) => !names.has(name)),
  ];
  return merged.sort(([, a], [, b]) => pxNumber(a) - pxNumber(b));
}

function token(name: string, value: string, usage?: string): Token {
  return {
    name,
    value,
    usage: usage ?? LENGTH_USAGE[name] ?? 'From packages/styles.',
  };
}

function usageFromName(name: string): string {
  const [area, ...rest] = name.split('-');
  return `${capitalize(area ?? name)} ${rest.join(' ')}.`.replace(' .', '.');
}

function px(value: string): string {
  const rem = /^(-?[\d.]+)rem$/.exec(value);
  return rem?.[1] ? `${Number(rem[1]) * 16}px` : value;
}

function pxNumber(value: string): number {
  return Number.parseFloat(px(value)) || 0;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function contrast(a: string | undefined, b: string | undefined): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function luminance(hex: string | undefined): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!match?.[1]) return 1;
  const channels = [0, 2, 4].map((i) => {
    const c = Number.parseInt(match[1]?.slice(i, i + 2) ?? '0', 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
