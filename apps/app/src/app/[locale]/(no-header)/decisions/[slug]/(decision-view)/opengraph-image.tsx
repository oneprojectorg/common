import { OPURLConfig, getTextPreview } from '@op/core';
import { logger } from '@op/logging';
import { getAvatarColorForString } from '@op/styles/constants';
import { ImageResponse } from 'next/og';

import { getTranslations } from '@/lib/i18n';
import { getLocaleDirection, i18nConfig } from '@/lib/i18n/config';

import { loadDecision } from './loadDecision';

// A plain `export const alt` is static. Localizing it would require switching
// to generateImageMetadata's id/URL machinery — not worth it for an
// accessibility-only string; the card text below is localized per-request.
export const alt = 'A decision on One Project';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Brand palette (mirrors the teal ramp); ImageResponse can't read
// Tailwind tokens, so the hex values live here.
const TEAL = '#387582';
const TEAL_DARK = '#32606C';
const TEAL_GRADIENT = `linear-gradient(135deg, ${TEAL} 0%, ${TEAL_DARK} 100%)`;

// satori can't read Tailwind tokens or var(), so the four avatar gradients
// (getAvatarColorForString) are inlined here as resolved hex. Values mirror the
// bg-gradient / bg-redTeal / bg-blueGreen / bg-orangePurple @utility blocks in
// theme.css, keyed by the class name the shared helper returns, giving
// each decision a stable brand-palette background. Typing the table by the
// helper's return union makes a new avatar gradient a compile error here, not a
// silent miss.
type AvatarGradientClass = ReturnType<
  typeof getAvatarColorForString
>['gradient'];
const GRADIENT_CSS: Record<AvatarGradientClass, string> = {
  'bg-gradient':
    'radial-gradient(154% 99.31% at 0% 0%, #7CCC4F 0%, #387582 51.56%)',
  // redTeal intentionally drops the utility's #fafbfb 100% off-white tail — it
  // reads as a washed-out corner at OG-card scale.
  'bg-redTeal':
    'radial-gradient(96.92% 140.1% at 72.02% 100%, #3F8D99 0%, #CC3D31 92%)',
  'bg-blueGreen':
    'radial-gradient(91.78% 91.78% at 89.17% 4.38%, #5DB131 0%, #446FCC 100%)',
  'bg-orangePurple':
    'radial-gradient(70.56% 70.56% at 72.75% 33.21%, #A1649F 0%, #e35f00 100%)',
};
const gradientForName = (name: string) =>
  GRADIENT_CSS[getAvatarColorForString(name).gradient];

const FULL_BLEED = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
} as const;

// Assets are fetched over HTTP from /public rather than via
// `new URL(..., import.meta.url)`: that pattern resolves to a file:// URL the
// Node runtime's fetch can't read, which threw and 500'd the whole route.
const ASSET_BASE = OPURLConfig('APP').ENV_URL;

const logoUrl = `${ASSET_BASE}/Common-logo-white.png`;

// Roboto TTFs (satori can't use the app's woff2). Loaded once per runtime.
// The card only renders weight 400 (Roboto) and 300 (Roboto Serif) — add a
// weight here only when the markup actually uses it.
type OGFont = {
  name: string;
  data: ArrayBuffer;
  weight: 300 | 400;
  style: 'normal';
};
let fontsPromise: Promise<OGFont[]> | undefined;
const loadFonts = () => {
  fontsPromise ??= Promise.all([
    fetch(`${ASSET_BASE}/og/Roboto-Regular.ttf`).then((res) =>
      res.arrayBuffer(),
    ),
    fetch(`${ASSET_BASE}/og/RobotoSerif-Light.ttf`).then((res) =>
      res.arrayBuffer(),
    ),
  ])
    .then(([regular, serif]): OGFont[] => [
      { name: 'Roboto', data: regular, weight: 400, style: 'normal' },
      { name: 'Roboto Serif', data: serif, weight: 300, style: 'normal' },
    ])
    .catch((error) => {
      // Don't cache a transient failure — let the next request retry.
      fontsPromise = undefined;
      throw error;
    });
  return fontsPromise;
};

// The Common wordmark, loaded once and inlined as a data URI for satori.
let logoPromise: Promise<string> | undefined;
const loadLogo = () => {
  logoPromise ??= fetch(logoUrl)
    .then((res) => res.arrayBuffer())
    .then(
      (buf) => `data:image/png;base64,${Buffer.from(buf).toString('base64')}`,
    )
    .catch((error) => {
      // Don't cache a transient failure — let the next request retry.
      logoPromise = undefined;
      throw error;
    });
  return logoPromise;
};

/**
 * Dynamic OG card for the canonical public decision page. Renders the decision
 * name, steward byline, and participation stats over the decision's header
 * image when it has one, otherwise over a gradient hashed from the decision
 * name.
 */
const Image = async ({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) => {
  try {
    const { slug, locale } = await params;
    // satori (next/og's renderer) doesn't apply Arabic joining: RTL text
    // renders in disconnected isolated letter forms. Until the card text is
    // pre-shaped to Unicode presentation forms, RTL locales fall back to
    // default-locale card text — the page's <meta> tags stay localized.
    const cardLocale =
      getLocaleDirection(locale) === 'rtl' ? i18nConfig.defaultLocale : locale;
    const [{ decisionProfile }, t, fonts, logoSrc] = await Promise.all([
      loadDecision(slug),
      getTranslations({ locale: cardLocale }),
      loadFonts(),
      loadLogo(),
    ]);
    const instance = decisionProfile.processInstance;
    const byName = instance.steward?.name;
    const headerKey = decisionProfile.headerImage?.name;
    const headerUrl =
      headerKey && process.env.S3_ASSET_ROOT
        ? `${process.env.S3_ASSET_ROOT}/${headerKey}`
        : undefined;

    const stats: string[] = [];
    if (instance.proposalCount != null) {
      stats.push(
        t('{count, plural, one {# proposal} other {# proposals}}', {
          count: instance.proposalCount,
        }),
      );
    }
    if (instance.participantCount != null) {
      stats.push(
        t('{count, plural, one {# participant} other {# participants}}', {
          count: instance.participantCount,
        }),
      );
    }

    return new ImageResponse(
      <Card
        title={getTextPreview({
          content: decisionProfile.name || t('Decision'),
          maxLength: 80,
        })}
        byline={byName ? t('by {name}', { name: byName }) : undefined}
        stats={stats}
        headerUrl={headerUrl}
        logoSrc={logoSrc}
        // Hash the raw (untranslated) name so a decision keeps the same
        // gradient across locales.
        background={gradientForName(decisionProfile.name || 'Decision')}
      />,
      { ...size, fonts },
    );
  } catch (error) {
    // Any failure (private/missing decision, asset fetch, render error) degrades
    // to a minimal font-less card (default font, so satori can't fail on a
    // missing family) rather than 500ing this crawler asset. Logged so a
    // persistent/unexpected failure is visible instead of silently serving the
    // generic card for every decision.
    logger.warn('Falling back to default decision OG image', {
      error: error instanceof Error ? error.message : String(error),
    });
    return new ImageResponse(
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          background: TEAL_GRADIENT,
          color: 'white',
          fontSize: 64,
        }}
      >
        One Project
      </div>,
      { ...size },
    );
  }
};

export default Image;

const Card = ({
  title,
  byline,
  stats,
  headerUrl,
  logoSrc,
  background,
}: {
  title: string;
  byline?: string;
  stats: string[];
  headerUrl?: string;
  logoSrc?: string;
  background?: string;
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        position: 'relative',
        background: background ?? TEAL_GRADIENT,
        color: 'white',
        fontFamily: 'Roboto',
      }}
    >
      {headerUrl ? (
        <>
          <img
            src={headerUrl}
            width={size.width}
            height={size.height}
            style={{ ...FULL_BLEED, objectFit: 'cover' }}
          />
          {/* Darken the photo so foreground text stays legible. */}
          <div
            style={{
              ...FULL_BLEED,
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.75) 100%)',
            }}
          />
        </>
      ) : null}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: 96,
          position: 'relative',
        }}
      >
        {logoSrc ? (
          // Common wordmark at its native 134x28 (no scaling/distortion).
          <img
            src={logoSrc}
            width={134}
            height={28}
            style={{ display: 'flex' }}
          />
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Roboto Serif',
              fontWeight: 300,
              fontSize: 68,
              lineHeight: 1.1,
            }}
          >
            {title}
          </div>
          {byline ? (
            <div style={{ display: 'flex', fontSize: 32, marginTop: 16 }}>
              {byline}
            </div>
          ) : null}
          {stats.length > 0 ? (
            <div
              style={{
                display: 'flex',
                fontSize: 26,
                marginTop: 24,
                opacity: 0.9,
              }}
            >
              {stats.join('  ·  ')}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
