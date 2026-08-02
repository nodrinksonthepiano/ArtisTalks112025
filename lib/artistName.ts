/**
 * Mirror of profiles.artist_name_slug generated column for API lookups only.
 * DB remains authoritative — do not write this value from the client.
 */
export function normalizeArtistNameSlug(name: string): string | null {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  return slug || null
}
