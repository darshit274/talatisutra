# Dynamic, admin-editable site content

Status: approved design, ready for implementation plan.

## Context

The public marketing site (`app/(marketing)/`) — Home, About, Services, Contact —
currently renders 100% hardcoded JSX with lorem-ipsum placeholder copy. The client
wants to be able to edit this content themselves (titles, body text, images —
"everything") without a developer, through the admin portal, while the header/footer
navigation structure and the footer logo stay fixed/code-defined, and the site's own
functional pieces (the Contact page's contact form) stay as they are.

This is "Piece 4" of a larger request decomposed earlier in this project's build:
pieces 1-3 (rebrand, employee-only portal shell, category hierarchy) are already
built and shipped; piece 4 was explicitly deferred by the client at the time
("i want the website content is dynamic... but this part we do it later") and is
being picked up now as its own full spec → plan → implementation cycle.

A fifth public page, `/information`, was removed in a separate, already-completed
request earlier in this same work session — it no longer exists and is not part of
this spec's scope. Four public content pages remain: Home, About, Services, Contact.

Decisions settled with the user before this spec was written:
- **Flexible block/section system** — each page is an ordered list of content
  blocks; admin can add, remove, reorder, and edit blocks on each page. This is
  deliberately more work than a single rich-text blob per page or fixed structured
  fields per page, chosen explicitly over both.
- **Images are in scope now** — block types can include images (hero image, card
  images), not deferred to a later piece.
- **Direct edit, goes live immediately** — no draft/preview/publish step. Matches
  how every other piece of this admin portal already behaves (category rename,
  material edits, etc.).
- **Dedicated "Site Content" admin section** (new sidebar entry, same pattern as
  Categories/Departments/Users today) — not inline editing on the live public pages.
- **Contact page**: only the heading/subtext above the form become an editable
  block. The contact form itself (name/email/phone/subject/message, honeypot,
  `submitContactForm` Server Action) stays exactly as it is — never a block, never
  admin-editable.
- The **set of pages stays fixed** — Home, About, Services, Contact. This spec does
  not add the ability for an admin to create new routable pages; only to edit the
  content of these four. (Implied by the user's own framing — "except the header
  and footer menu" — the set of nav destinations doesn't change, only what's on
  them.)
- **Reordering uses plain Move up / Move down buttons**, not drag-and-drop — avoids
  pulling in a new library for a 4-page site with a handful of blocks each.
- **A block's `type` is fixed at creation** — there's no "convert this Text block
  into a Hero block" operation. To change a block's type, delete it and add a new
  one of the desired type.

## 1. Data model

Two new enums and one new table, additive only:

```prisma
enum SitePage {
  HOME
  ABOUT
  SERVICES
  CONTACT
}

enum ContentBlockType {
  HERO
  TEXT
  CARD_GRID
  CTA_BAND
}

model ContentBlock {
  id          String           @id @default(cuid())
  page        SitePage
  type        ContentBlockType
  sortOrder   Int
  data        Json
  updatedAt   DateTime         @updatedAt
  updatedById String?
  updatedBy   User?            @relation("ContentBlockUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull)

  @@index([page, sortOrder])
}
```

Prisma requires both sides of an explicit relation to be declared (the existing
`Material.uploadedBy` / `User.uploads` pair is the precedent), so `User` gains one
new back-relation field alongside its existing `uploads Material[] @relation("UploadedBy")`:

```prisma
  updatedContentBlocks ContentBlock[] @relation("ContentBlockUpdatedBy")
```

`data`'s shape depends on `type`. This is the same "validated JSON, not a rigid
column-per-field schema" pattern `AuditLog.meta` already uses in this codebase —
precedented, not a new idiom. Correctness is enforced by Zod at the server
boundary (§5), not by the database schema.

Four block types — not a speculative open-ended set, chosen to cover exactly what
the current four pages use:

- **HERO**: `{ heading: string; subtext: string; buttons: Array<{ label: string; href: string }>; imageKey: string | null }`
- **TEXT**: `{ heading: string | null; body: string }` (`body` is one free-form
  block of text; paragraph breaks are literal blank lines in the stored string,
  rendered as separate `<p>` tags — no repeatable-paragraph-field UI needed for the
  simplest block type)
- **CARD_GRID**: `{ heading: string | null; subtext: string | null; cards: Array<{ title: string; body: string; imageKey: string | null }> }`
- **CTA_BAND**: `{ heading: string; subtext: string; button: { label: string; href: string } }`

Page → initial block layout (seeded at migration time, see §3):
- Home: `[HERO, CARD_GRID, CTA_BAND]`
- About: `[TEXT, CARD_GRID]`
- Services: `[TEXT, CARD_GRID]`
- Contact: `[TEXT]`

## 2. Image storage & serving

Materials are served through an auth-gated route (`GET /api/materials/[id]/file`)
because they're permission-restricted. Site-content images are public marketing
assets — visible to anyone, no login — so that pattern doesn't apply directly;
this spec defines a parallel, public-appropriate path instead.

- **Storage**: a new `STORAGE_DIR/site-images/` directory, outside the repo — same
  reasoning as materials (not a build-time asset; keeps "where do uploads live" in
  one consistent place across the app rather than splitting some uploads into
  `public/`).
- **Serving**: a new route handler, `GET /api/site-images/[filename]`, with **no
  auth check** (intentional — these are meant to be public) and a long
  `Cache-Control` header (non-sensitive, infrequently-changed assets).
- **Filename validation (security-relevant)**: since there is no database row per
  image to look up (see below), `filename` arrives straight from the URL as a
  route param. Before it ever touches a filesystem path, the route validates it
  against `^[0-9a-f-]+\.(png|jpe?g|webp)$` — exactly the shape the upload step
  produces (random UUID + sniffed extension) — and returns 404 on anything that
  doesn't match. This is the standard, sufficient defense against path traversal
  for a route that serves files by a client-supplied name; no database lookup is
  needed for it to be safe.
- **Upload validation**: reuses the existing `sniffFileType()` magic-byte detection
  from `lib/materials/upload.ts` — accepts only when the sniffed kind is `IMAGE`
  (rejects a renamed PDF/DOC claiming to be a PNG, same as materials already
  reject a mismatched declared type). Max 5 MB (smaller than materials' 25 MB —
  these are web-display images, not documents). Filename is a random UUID plus the
  sniffed extension (CLAUDE.md rule 5 isn't materials-specific; it's a general
  upload-security rule applied here too).
- **Upload transport**: a route handler (`export const runtime = "nodejs"`), same
  reason materials' upload is a route handler and not a Server Action — avoids the
  Server Action body-size limit.
- **No separate `SiteImage`/`Asset` Prisma model.** A block's `data` JSON stores
  the image's storage key directly (e.g. `imageKey: "<uuid>.jpg"`), resolved to
  `/api/site-images/<key>` at render time. There's no need to track per-image
  title/visibility/audit history the way `Material` does — these are decorative
  assets embedded in a block's own data, not independently-managed library items.
- **Orphan cleanup**: when a block's image is replaced (edited to a new image) or
  the block itself is deleted, the previously-referenced file is unlinked from
  disk — same cleanup pattern already used for material file replacement
  (`deleteUploadedFile`, called after the DB write that stops referencing the old
  key succeeds).

## 3. Public rendering

- `lib/queries/content.ts` (new): `getPageBlocks(page: SitePage): Promise<ContentBlock[]>`
  — fetches that page's blocks ordered by `sortOrder`. No visibility scoping of any
  kind needed (this is public content, not department-restricted materials).
- A `BlockRenderer` component (new, e.g. `components/content/block-renderer.tsx`)
  takes `blocks: ContentBlock[]` and dispatches each one, by `type`, to its
  matching presentational component: `HeroBlock`, `TextBlock`, `CardGridBlock`,
  `CtaBandBlock` (new, under `components/content/`). Each takes that block's
  already-shaped `data` as typed props and renders using the same Tailwind
  classes/visual style the current hardcoded pages already use (no visual
  redesign — this spec replaces *where the content comes from*, not how it looks).
- `app/(marketing)/page.tsx`, `about/page.tsx`, `services/page.tsx` become async
  Server Components: fetch `getPageBlocks("HOME")` (etc.) and render
  `<BlockRenderer blocks={blocks} />` in place of today's hardcoded JSX.
  `contact/page.tsx` does the same for its one `TEXT` block, then still renders the
  fixed `<ContactForm />` below it exactly as today — the form is untouched by this
  spec.
- **Trust boundary**: `data` is only ever written by an admin through the validated
  editor (§5) — never user-submitted from the public internet. The public render
  path trusts the stored shape and does not re-validate on every page view;
  validation happens once, at save time. (This mirrors how every other
  already-validated, admin-written row in this app is read back without
  re-validation.)
- **The schema migration's SQL file itself seeds the current placeholder copy** as
  each page's initial `ContentBlock` rows, matching today's hardcoded text/layout
  exactly, so the public site looks identical the moment this ships. Concretely:
  generate the migration with `prisma migrate dev --create-only`, then hand-append
  plain `INSERT INTO ContentBlock (...) VALUES (...)` statements (one per block,
  JSON-encoded `data`) to the generated `migration.sql` before applying it. This
  guarantees the seed data lands exactly once, in both dev (`migrate dev`) and
  production (`migrate deploy`) — a separate script would need a second manual step
  that's easy to forget in production. This is unrelated to, and must not modify,
  `prisma/seed.ts`'s existing dev-only sample-employee seeding.

## 4. Admin UI

New **Site Content** entry in the admin sidebar nav, alongside Categories/
Departments/Users/Enquiries.

- **`/admin/content`** (new page): lists the four pages (Home, About, Services,
  Contact) as simple tiles, each showing its current block count, linking to
  `/admin/content/[page]`.
- **`/admin/content/[page]`** (new page, `page` is the lowercase `SitePage` value
  as a URL segment, e.g. `/admin/content/home`): shows that page's blocks in
  `sortOrder`, each as a compact row:
  - A type badge (Hero / Text / Card grid / CTA band).
  - A short preview (the block's heading, or the first line of its body for a
    `TEXT` block with no heading).
  - **Edit** — opens a dialog with that block's type-specific fields (same
    Dialog-based create/edit pattern already built for categories:
    `app/(app)/admin/categories/category-form-dialog.tsx`), pre-filled from the
    block's current `data`.
  - **Delete** — the existing shared `DeleteConfirmButton` component. No
    "has children" guard needed (blocks don't nest); any block can always be
    deleted.
  - **Move up / Move down** — a small Server Action that swaps this block's
    `sortOrder` with the adjacent block's, disabled at the top/bottom of the list.
  - **"+ Add block"** button at the top of the list: opens a dialog that first
    asks which type to add, then shows that type's fields inline in the same
    dialog once chosen.
- **Per-type field forms**:
  - **Hero**: heading (input), subtext (textarea), buttons (a small repeatable
    list of label+href row pairs, with an "+ Add button" / per-row remove
    control, same repeatable-row UX already built for the materials upload form's
    department checkboxes — not a new pattern), image (optional file input).
  - **Text**: heading (optional input), body (one textarea — paragraph breaks are
    literal blank lines, per §1).
  - **Card grid**: heading (optional input), subtext (optional input), cards (a
    repeatable list of title+body+optional-image rows, add/remove per row).
  - **CTA band**: heading (input), subtext (textarea), button (one label+href
    row).
- All block mutations (create, update, delete, reorder) are Server Actions in a
  new `app/(app)/admin/content/actions.ts`, following this project's existing
  convention (Zod-validated at the boundary, `writeAuditLog` on every mutation,
  `revalidatePath` on the affected admin page *and* the corresponding public page
  so an edit is visible immediately both in the admin list and on the live site).
  Image upload is the one exception, routed through `POST /api/site-images/upload`
  (a route handler, per §2) exactly the way material upload already works.

## 5. Validation & security

- Each block type gets its own Zod object schema (`heroBlockSchema`,
  `textBlockSchema`, `cardGridBlockSchema`, `ctaBandBlockSchema`); a Zod
  discriminated union keyed by `type` validates a block's `data` on every
  create/update Server Action. A `HERO` block can never be saved missing its
  heading; a `CARD_GRID` card can never be saved without a title; an `href` on any
  button is validated as a non-empty string (internal relative paths like `/about`
  and external absolute URLs both need to work, so this is a plain non-empty-string
  check, not a strict URL-format validator that would reject a relative path).
- Every `/admin/content*` page and Server Action calls `requireAdmin()` directly in
  the route/action itself (CLAUDE.md rule 2/4) — never relies on the admin layout
  alone to gate access.
- `GET /api/site-images/[filename]` has no auth check by design (§2) — these are
  public assets — but does apply the filename-pattern check in §2 before any
  filesystem access, and the `POST /api/site-images/upload` route requires
  `requireAdmin()` same as every other admin-only mutation endpoint.
- Image upload magic-byte validation and size cap as specified in §2.
- Orphaned image cleanup on replace/delete as specified in §2.

## What's explicitly unchanged / out of scope

- Header and footer navigation link structure (`MarketingHeader`'s `NAV_LINKS`,
  `MarketingFooter`'s `NAV_LINKS`) and the footer logo/wordmark — these stay
  fixed, code-defined, not part of this content system. (The footer's placeholder
  address/phone/email block is visually part of the footer, not a page's content
  block — out of scope for this spec; if the client wants that editable too, it's
  a separate, small follow-up, not assumed here.)
- The Contact page's `ContactForm` component and `submitContactForm` Server Action
  — entirely untouched.
- Creating new routable pages — the set of four pages is fixed by this spec.
- Draft/preview/publish workflow — explicitly deferred; all edits are live
  immediately.
- Drag-and-drop block reordering — explicitly deferred in favor of Move up/down
  buttons.
- Changing a block's `type` after creation.
- Any visual/design change to how the pages look — this spec moves *where the
  content comes from*, not the page layouts or Tailwind styling, which stay as
  they are today (rendered by the new block components using the same classes the
  current hardcoded JSX already uses).
- `prisma/seed.ts`'s existing sample-employee dev seeding — unrelated, untouched.

## Testing

No automated test framework in this project (per `CLAUDE.md`'s own workflow):
`npx tsc --noEmit`, `npm run lint`, `npm run build`, plus direct manual/scripted
verification. Manual pass after implementation:
- Confirm all four public pages render identically (or near-identically — same
  copy, same structure) to their pre-migration hardcoded versions immediately
  after the seed runs.
- As admin, open `/admin/content`, confirm all four pages list with correct block
  counts.
- Add a new block of each of the four types to a test page, confirm it appears
  correctly on the public page afterward.
- Edit an existing block's text, confirm the public page reflects the change
  immediately (no caching/staleness).
- Upload an image to a Hero block and a Card grid card, confirm both render
  correctly on the public page and the file is reachable at
  `/api/site-images/<key>` with no login.
- Replace a block's image with a different one, confirm the old file is removed
  from `STORAGE_DIR/site-images/` and the new one renders.
- Delete a block, confirm it disappears from both the admin list and the public
  page, and any image file it referenced is removed from disk.
- Reorder blocks with Move up/down, confirm the public page's rendering order
  updates to match.
- Attempt to request `/api/site-images/../../../../etc/passwd` (or similar) and
  confirm it 404s rather than reading anything outside the images directory.
- Confirm the Contact page's form still submits correctly and is visually
  unaffected by this change.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass.
