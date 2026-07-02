// Re-export the decision OG card for this segment: the file convention only
// injects og:image for the folder the file lives in, and this route's
// generateMetadata redefines openGraph (wiping the inherited images), so
// without this file /current would ship with no og:image at all.
export { alt, contentType, default, size } from '../opengraph-image';
