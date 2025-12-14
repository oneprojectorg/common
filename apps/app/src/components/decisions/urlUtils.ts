/**
 * Utility functions for URL detection and validation for Iframely embeds
 */

/**
 * URL regex pattern that matches http/https URLs
 */
const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

/**
 * Common domains that work well with Iframely embeds
 */
const EMBEDDABLE_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'facebook.com',
  'tiktok.com',
  'linkedin.com',
  'github.com',
  'codepen.io',
  'figma.com',
  'docs.google.com',
  'drive.google.com',
  'medium.com',
  'dev.to',
  'stackoverflow.com',
  'reddit.com',
  'slideshare.net',
  'speakerdeck.com',
  'spotify.com',
  'soundcloud.com',
  'twitch.tv',
  'discord.gg',
  'calendly.com',
  'typeform.com',
  'notion.so',
  'airtable.com',
  'miro.com',
  'canva.com',
];

/**
 * Domains that should NOT be auto-embedded (better as regular links)
 */
const NON_EMBEDDABLE_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'mail.google.com',
  'login.',
  'auth.',
  'signin.',
  'signup.',
  'admin.',
  'dashboard.',
  'api.',
];

/**
 * Checks if a URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts URLs from a text string
 */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches ? matches.filter(isValidUrl) : [];
}

/**
 * Checks if a URL is likely to work well as an Iframely embed
 */
export function isEmbeddableUrl(url: string): boolean {
  if (!isValidUrl(url)) {
    return false;
  }

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const path = urlObj.pathname.toLowerCase();

    // Check if it's a non-embeddable domain
    if (NON_EMBEDDABLE_DOMAINS.some((domain) => hostname.includes(domain))) {
      return false;
    }

    // Check if it's a known embeddable domain
    if (EMBEDDABLE_DOMAINS.some((domain) => hostname.includes(domain))) {
      return true;
    }

    // Check for file extensions that shouldn't be embedded
    if (path.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|exe|dmg)$/)) {
      return false;
    }

    // Default to true for other domains (let Iframely decide)
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if text contains only a URL (possibly with whitespace)
 */
export function isOnlyUrl(text: string): boolean {
  const trimmed = text.trim();
  const urls = extractUrls(trimmed);

  // Check if the trimmed text is exactly one URL
  return urls.length === 1 && urls[0] === trimmed;
}

/**
 * Detects if pasted content is a single embeddable URL
 */
export function shouldAutoEmbed(text: string): string | null {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const trimmed = text.trim();

  // Check if it's only a URL
  if (!isOnlyUrl(trimmed)) {
    return null;
  }

  const url = trimmed;

  // Check if it's embeddable
  if (isEmbeddableUrl(url)) {
    return url;
  }

  return null;
}
