import { ImageResponse } from 'next/og.js';
// Standalone render of the decision OG card, one PNG per avatar gradient.
// Reads fonts/logo from disk (no server). Run from apps/app:
//   node scripts/og-preview.mjs <outDir>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createElement as h } from 'react';

const PUBLIC = join(process.cwd(), 'public');
const outDir = process.argv[2] || join(process.cwd(), 'og-previews');
mkdirSync(outDir, { recursive: true });

const size = { width: 1200, height: 630 };
const TEAL_GRADIENT = 'linear-gradient(135deg, #387582 0%, #32606C 100%)';
const GRADIENTS = {
  'bg-gradient':
    'radial-gradient(154% 99.31% at 0% 0%, #3ec300 0%, #0396a6 51.56%)',
  'bg-redTeal':
    'radial-gradient(96.92% 140.1% at 72.02% 100%, #3F8D99 0%, #CC3D31 92%)',
  'bg-blueGreen':
    'radial-gradient(91.78% 91.78% at 89.17% 4.38%, #5DB131 0%, #446FCC 100%)',
  'bg-orangePurple':
    'radial-gradient(70.56% 70.56% at 72.75% 33.21%, #A1649F 0%, #e35f00 100%)',
};

const fonts = [
  {
    name: 'Roboto',
    data: readFileSync(join(PUBLIC, 'og/Roboto-Regular.ttf')),
    weight: 400,
    style: 'normal',
  },
  {
    name: 'Roboto Serif',
    data: readFileSync(join(PUBLIC, 'og/RobotoSerif-Light.ttf')),
    weight: 300,
    style: 'normal',
  },
];
const logoSrc = `data:image/png;base64,${readFileSync(join(PUBLIC, 'Common-logo-white.png')).toString('base64')}`;

const card = (background) =>
  h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        position: 'relative',
        background,
        color: 'white',
        fontFamily: 'Roboto',
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: 96,
        },
      },
      h('img', {
        src: logoSrc,
        width: 134,
        height: 28,
        style: { display: 'flex' },
      }),
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column' } },
        h(
          'div',
          {
            style: {
              display: 'flex',
              fontFamily: 'Roboto Serif',
              fontWeight: 300,
              fontSize: 68,
              lineHeight: 1.1,
            },
          },
          'Participatory Budgeting 2026',
        ),
        h(
          'div',
          { style: { display: 'flex', fontSize: 32, marginTop: 16 } },
          'by Maria Fund',
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              fontSize: 26,
              marginTop: 24,
              opacity: 0.9,
            },
          },
          '12 proposals  ·  48 participants',
        ),
      ),
    ),
  );

for (const [name, background] of [
  ['teal', TEAL_GRADIENT],
  ...Object.entries(GRADIENTS),
]) {
  const res = new ImageResponse(card(background), { ...size, fonts });
  const buf = Buffer.from(await res.arrayBuffer());
  const file = join(outDir, `og-${name}.png`);
  writeFileSync(file, buf);
  console.log(`wrote ${file} (${buf.length}B)`);
}
