/**
 * Resort slugs.
 *
 * The database constrains `tenants.slug` to `^[a-z0-9]+(-[a-z0-9]+)*$`, and the
 * slug is durable: it seeds the procedural terrain a resort falls back to
 * before its twin is uploaded, prefixes its lobby code and its storage objects.
 * Deriving it here rather than in the form means the value an operator previews
 * is byte-for-byte the one that gets written.
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      // Strip combining marks so "Forêt" becomes "foret" rather than "fort".
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 255)
      .replace(/-+$/, "")
  );
}

export function isValidSlug(input: string): boolean {
  return SLUG_PATTERN.test(input);
}
