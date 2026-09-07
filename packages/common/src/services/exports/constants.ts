/**
 * Storage and lifetime configuration shared by every export pipeline.
 *
 * Two pipelines write here today: the admin-facing proposals CSV
 * (`services/decision/exports`) and the subject-facing personal data export
 * (`services/personalDataExport`). Each owns its own cache key, storage key, and
 * file name. What they must agree on is this module: one bucket, one URL
 * lifetime, one record lifetime, one set of download options.
 *
 * These values drifted once, inside a single pipeline. The workflow signed a URL
 * for 2 hours. It recorded a 24 hour expiry. The status read then served a dead
 * URL for 22 hours. A second pipeline with its own copy of the numbers is the
 * same bug with more places to hide, which is why they live here rather than
 * beside either caller.
 */

/**
 * The private bucket that holds every generated export.
 *
 * A reader must present a signature to get one. A proposals CSV carries
 * submitter names; a personal data export carries one subject's whole record.
 * The shared `assets` bucket cannot hold either, because
 * `apps/app/next.config.mjs` rewrites `/assets/:path*` to its public object
 * root. Use a separate bucket, not a prefix inside `assets`. Do not point this
 * constant back at `assets`.
 *
 * `services/db/migrate.ts` creates this bucket with `public: false`. It also
 * re-asserts the visibility on every deploy.
 *
 * A signing call needs the service-role client. Supabase enables row level
 * security (RLS) on `storage.objects`, and every policy scopes to
 * `bucket_id = 'assets'`. No policy grants a caller any access here, so a
 * caller-scoped client cannot see the object. Every pipeline therefore settles
 * authorization before it signs.
 */
export const EXPORTS_BUCKET = 'exports';

/**
 * The lifetime of a generated signed download URL.
 *
 * This value is shorter than {@link EXPORT_CACHE_TTL_SECONDS} on purpose. The
 * export record outlives any single URL. Someone who returns to a finished
 * export gets a new URL from the status read instead of a 404.
 *
 * {@link EXPORTS_BUCKET} is private, so expiry revokes access to the objects it
 * holds. Expiry does not cover the exports written before the move to that
 * bucket. Those objects stay in the public `assets` bucket, and a reader who
 * knows the path can still read them. Asana 1217696316242182 tracks the
 * deletion. This comment is the only record of that exposure in the tree.
 */
export const EXPORT_URL_TTL_SECONDS = 6 * 60 * 60; // 6 hours

/**
 * The lifetime of the cached export status record.
 *
 * Export state lives only in the cache. No table backs it. This value is
 * therefore also how long a completed export stays downloadable.
 *
 * Keep this value longer than {@link EXPORT_URL_TTL_SECONDS}. A shorter value
 * expires the record before the URL it holds. That makes the refresh path in
 * `refreshStaleSignedUrl` unreachable.
 */
export const EXPORT_CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * `createSignedUrl` options that make an export download instead of render.
 *
 * Supabase serves a storage object inline unless the signed URL asks for an
 * attachment. A `text/csv` or `application/json` export then renders as text.
 * Safari does this; Chrome downloads it anyway, which hid the bug.
 *
 * A link's `download` attribute cannot fix this. A browser ignores that
 * attribute on a cross-origin URL, and these links point at the Supabase host.
 *
 * Every signing site passes this. One that forgets leaves its own URLs inline.
 *
 * @param fileName - Name the browser saves the object under.
 * @returns Options for `createSignedUrl`, which put the name in the signed URL's
 *   `download` parameter.
 */
export const exportDownloadOptions = (fileName: string) => ({
  download: fileName,
});
