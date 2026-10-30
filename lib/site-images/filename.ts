// Exactly the shape writeSiteImage produces: a random UUID plus a sniffed extension.
// Kept in its own dependency-free module (no node:fs, no @/lib/env) because
// lib/validation/content.ts needs it and that file is imported by client components —
// lib/site-images/storage.ts re-exports it for server-side callers.
//
// Used at two boundaries: the public GET route rejects anything that doesn't match this
// before touching the filesystem (spec §2), and the content-block Zod schemas reject any
// `imageKey` that doesn't match, so a key reaching deleteSiteImage()'s unlink() can never
// contain a path separator or `..` (CLAUDE.md rule 5).
export const SITE_IMAGE_FILENAME_PATTERN = /^[0-9a-f-]+\.(png|jpe?g|webp)$/;
