# Admin content expansion — design

Status: draft design, builder check complete.

## Context and why

The client is going to log into `/admin` and update the public site's content
themselves, day to day, without a developer. Two things prompted this piece of
work directly:

- While using the admin panel, the client hit a crash trying to create a new
  Article (fixed separately, same session, unrelated to this design) and found
  there was no way to add or remove an Article category — the 6 categories
  (GR & Circulars, Land Records, Panchayat Administration, Exam Preparation,
  Salary & Service Rules, Forms & Downloads) are a hardcoded TypeScript lookup
  (`lib/articles/categories.ts`), not something `/admin` can touch.
- A broader request: several pages' content is still hardcoded in JSX —
  Services' category rows (inherited from the same lookup), the footer and
  Contact page's contact details (duplicated in two places), the About page's
  closing disclaimer and photo placeholder, the Contact page's map image, and
  the Articles list / Privacy / Disclaimer pages' heading and body text.

Settled directly with the user (asked because each one changes what gets
built, not something a builder should guess):

- **Header utility bar text stays hardcoded.** Explicitly out of scope —
  "leave the header changes."
- **The 6 existing category *tiles'* content (icon/description/tags) were
  first discussed as "leave as code" to avoid the 3-page drift problem the
  current design deliberately prevents — but the client also needs to add and
  remove categories entirely**, which the "leave as code" framing didn't
  cover. Resolved by converting categories from a hardcoded enum into a real,
  admin-managed table (see §2) — this still prevents drift, since Home,
  Services and the footer all read the same row instead of each carrying
  their own copy, while also making the category *list itself* editable.
- **New categories get a single, fixed default icon — no icon picker.** The
  user chose "plain default icon" explicitly over a picker, to keep the admin
  form simple. The 6 existing categories keep their current distinct icons
  (Map, Landmark, GraduationCap, Scale, Download, FileText) when migrated into
  the new table.
- **Deleting a category with articles in it is blocked**, not reassigned to a
  fallback — same pattern already used for Materials categories with
  children (`onDelete: Restrict`), surfaced to the admin as an error rather
  than silently orphaning or reassigning articles.
- **Images**: yes, the client uploads them too (About's photo, Contact's
  map) — not a future developer task.

## Goals

- Article categories (add/edit/delete/reorder) are fully admin-managed.
- Services page, Home's services grid, and the footer's category list all
  read from the same admin-managed source — no duplicate copy to drift.
- Articles list page, Privacy page, and Disclaimer page get real, editable
  heading/body content via the *existing* Site Content system (`/admin/content`)
  — not a new concept for the admin to learn.
- Site-wide contact details (email, phone, hours, address) become one
  editable record, read by both the footer and the Contact page sidebar.
- About's photo, About's closing disclaimer line, and Contact's map image
  become editable (image upload / text field) instead of fixed placeholders.
- The crash reported while adding a new Article is fixed (tracked and
  resolved outside this design, same root cause family — a `SelectValue`
  function-child assumed a value always existed).

## Non-goals / explicitly out of scope

- Header utility bar text (stays hardcoded, per the user).
- An icon picker for categories (stays a single fixed default icon for new
  categories, per the user).
- Multi-language, SEO/sitemap work, bulk email — all already out of scope
  per `CLAUDE.md` and unaffected by this piece.
- Reskinning or restructuring any page's layout — this is a content-source
  change (hardcoded → admin-editable), not a visual redesign.
- Rich text / WYSIWYG editing anywhere — every text field here follows the
  project's existing convention (plain textarea, `\n\n` splits paragraphs,
  same as every current `TEXT` block).

## 1. The crash (tracked, not part of this plan)

Already found and fixed in this session: `article-form-dialog.tsx`'s category
`SelectValue` function-child indexed `CATEGORY_META[value]` without handling
`value` being `undefined` (create mode starts with nothing selected). Noted
here only so the builder doesn't rediscover it as part of this work — the fix
already landed on `master`.

## 2. Article categories: enum → admin-managed table

**Schema.** Replace the `ArticleCategory` Prisma *enum* with an `ArticleCategory`
*model*, mirroring the existing `Category` model's shape (used today for
Materials — same codebase, same conventions, already proven):

```prisma
model ArticleCategory {
  id                  String    @id @default(cuid())
  name                String    @unique
  slug                String    @unique
  icon                String    // a key into a small, fixed code-side icon lookup — see below
  shortDescription    String    @db.Text // shown on Home's services grid
  servicesDescription String    @db.Text // shown on the Services page (today these two are identical per category, per spec; admin can diverge them later if they choose — same two fields, two labeled textareas)
  tags                Json      // string[], up to 3 — the chips shown on the Services page
  sortOrder           Int       @default(0)
  createdAt           DateTime  @default(now())
  articles            Article[]

  @@index([sortOrder])
}
```

`Article.category: ArticleCategory` (enum field) becomes
`Article.categoryId: String` + a relation to the new model, `onDelete:
Restrict` — deleting a category that any `Article` still references fails at
the database level, which the delete action surfaces as a normal form error
(same shape as every other admin delete-with-dependents check in this
codebase).

**Icon storage.** `icon` is a string key (e.g. `"FileText"`, `"Map"`), not a
serialized component — Lucide icon *components* aren't something you can put
in a database. A small fixed lookup in code
(`ICON_OPTIONS: Record<string, LucideIcon>`, maybe a dozen generic options:
FileText, Map, Landmark, GraduationCap, Scale, Download, Tag, Folder, …) maps
a stored key to the actual component at render time. New categories created
via `/admin` get a fixed default key (e.g. `"FileText"`) — there's no picker
in the create/edit form, per the user's choice. If `icon` ever holds a key
that isn't in the lookup (shouldn't happen, but defensively), fall back to
the same default rather than crashing a public page.

**Seed migration.** A data migration (SQL, same hand-appended-to-generated-
migration convention already used throughout this project) that:
1. Creates the `ArticleCategory` table.
2. Inserts 6 rows — `name` is today's existing visible label text verbatim
   (e.g. `"GR & Circular archive"`, `"Land record guides"`) so Services
   headings, footer links and the slider CTA show exactly what they show
   today — genuinely "no content change." `slug` is hand-written short and
   clean for each row (`gr-circulars`, `land-records`, …) rather than derived
   from `name` — the two don't have to match for a one-time seed inserted
   directly by SQL; `slugify(name)` only matters as the *admin form's* normal
   behavior for categories created from here on. Icon/descriptions/tags/order
   carry over unchanged.
3. Adds `Article.categoryId`, backfills it from the old enum column by
   matching each article's old category value to the new row's slug, then
   drops the old enum column and the `ArticleCategory` *enum* type (not the
   new model of the same name — Prisma allows the rename once the enum is
   gone).
4. Rewrites the HOME page's seeded `SLIDER` `ContentBlock`'s `data` JSON,
   replacing each slide's raw enum-string `category` (e.g. `"GR_CIRCULARS"`)
   with the matching new row's `slug` (e.g. `"gr-circulars"`) — this JSON
   blob has no foreign key, so nothing enforces it automatically; it has to
   be rewritten explicitly in the same migration or the homepage slider
   starts pointing at categories that no longer resolve.

**Public URLs.** Category filtering moves from the raw enum value
(`/articles?category=GR_CIRCULARS`) to the category's `slug`
(`/articles?category=gr-circulars`) — same pattern Materials categories
already use for their own filtering, and more stable than an opaque `cuid`
if a client ever wants a readable link. This is a URL shape change but there
are no external backlinks to the old shape yet (the site just shipped), so
it's low-risk; the builder's call, not something to re-ask the user.

**`lib/articles/categories.ts`** stops exporting a hardcoded `CATEGORY_META`
constant and `CATEGORY_ORDER` array. In their place: `getArticleCategories()`
(all rows, `sortOrder` ascending) and `getArticleCategoryBySlug(slug)` in
`lib/queries/`, following the same convention as every other query module in
this codebase. Every current consumer of the hardcoded constant — Home's
services grid, the Services page, the footer, the SliderFields admin editor,
the Article admin dialog and its category filter, the public Articles list/
detail/sidebar — switches from `import { CATEGORY_META }` to receiving the
fetched list as a prop from whichever Server Component renders it (Select
options can't be fetched client-side without introducing a loading state
these components don't currently have, and don't need).

**The SLIDER content block also references categories and has to move too.**
`sliderSlideSchema`'s `category: z.nativeEnum(ArticleCategory)` stops
compiling the moment `ArticleCategory` is a model instead of an enum — it
becomes `category: z.string()` validated against the live category list
(same `slug` identifier as the public URL, for consistency: one stable,
readable key used everywhere a category is referenced outside its own
table). The HOME page's seeded slider data is rewritten to the new slugs as
part of the migration above (step 4).

This reference has no database foreign key (it's a slug sitting inside a
`ContentBlock.data` JSON blob), so nothing stops an admin from deleting a
category a slide still points at unless the delete action checks for it
explicitly — **the category-delete guard checks both**: any `Article` row
(enforced at the database level via `onDelete: Restrict`, as above) *and*
any `SLIDER`-type `ContentBlock` whose `data.slides` references the
category's slug (an application-level check in the delete action itself,
since the database can't enforce a reference buried in JSON) — blocked with
a clear error either way, never a dangling reference the public homepage
has to render around.

**New admin section**, `/admin/article-categories` — list + create/edit
dialog + delete, following the *exact* existing conventions
`/admin/categories` (Materials) already establishes: a `DeleteConfirmButton`
disabled with an explanatory reason when the category still has articles
(not just a bare 500 if the restrict-delete fires), up/down reorder matching
`ContentBlock`'s existing reorder pattern. Fields: name, slug (auto-derived
from name, editable), short description, services description, 3 tags.
No icon field (see above).

## 3. Three more pages join the existing Site Content system

`SitePage` gains three values: `ARTICLES`, `PRIVACY`, `DISCLAIMER`. Each gets
one seeded `TEXT` `ContentBlock` row (heading + body, exactly the same shape
already used by every other page) via a data migration, carrying today's
real copy forward as the seed:

- **ARTICLES**: heading "Articles", body the current intro sentence ("GRs,
  circulars, land record guides, exam preparation and forms, organised by
  subject and date.").
- **PRIVACY** / **DISCLAIMER**: heading "Privacy" / "Disclaimer", body the
  current "This page is coming soon…" sentence — still a placeholder in
  content, but now the client can replace it with real policy text the
  moment they have it, with no developer involved.

The three public pages switch from static JSX heading/paragraph text to
`getPageBlocks(page)` + `BlockRenderer`, identical to how Home/About/
Services/Contact already render their heading blocks. `/admin/content` gains
three more entries in its page list — no new admin concept, no new
component.

The Articles list page's category-filter pills and the detail page's PDF
download card are **not** `ContentBlock` content — they stay exactly as they
are, driven by real article/category data, same as today.

## 4. Site-wide settings: contact details + About/Contact page furniture

A new singleton model — one row, holds a handful of named fields rather than
a generic key-value store (consistent with how the rest of this codebase
prefers explicit typed columns over a JSON blob when the field set is small
and known):

```prisma
model SiteSettings {
  id                 String   @id @default(cuid())
  contactEmail       String
  contactPhone       String
  contactHours       String
  contactAddress     String
  aboutPhotoKey      String?  // site-images storage key, same convention as every other imageKey
  aboutDisclaimer    String   @db.Text
  contactMapImageKey String?  // site-images storage key
  updatedAt          DateTime @updatedAt
  updatedById        String?
  updatedBy          User?    @relation(fields: [updatedById], references: [id], onDelete: SetNull)
}
```

Seeded with exactly one row (today's current placeholder values — the
existing footer/contact-details text, the existing About disclaimer
sentence) in a data migration, so there's never a "no settings row exists
yet" case any reader has to handle defensively — `getSiteSettings()` always
returns a real row.

New admin page, `/admin/settings` — one form, no list/create/delete (same
shape as the existing read-only `/admin/newsletter` page, except this one is
writable): the 4 contact fields, the About disclaimer textarea, and two
image-upload fields for the About photo and Contact map, reusing the
*existing* `SiteImageUploadField` client component and `/api/site-images/*`
routes exactly as `ContentBlock`'s own image fields already do — no new
upload mechanism.

Consumers: the footer and the Contact page's `ContactDetails` sidebar both
call `getSiteSettings()` instead of each hardcoding their own copy — but
they don't necessarily show the same subset today. `ContactDetails` shows
all 4 fields (adds an Hours row the footer has never had). The footer keeps
rendering exactly the 3 fields it renders today (email, phone, address) —
same layout as now, just sourced from the shared record instead of its own
hardcoded copy. Adding a new Hours line to the footer would be a small
layout change this design's own non-goals rule out ("no layout/restructuring
— this is a content-source change"); if the client wants Hours on the footer
too later, that's a one-line follow-up, not part of this piece. The About page renders `aboutPhotoKey` through the `.plate`
wrapper (replacing the static "Photograph coming soon" box) and
`aboutDisclaimer` as its closing paragraph (replacing the static sentence).
The Contact page renders `contactMapImageKey` the same way (replacing the
static "Map coming soon" box) — when a key is null (nothing uploaded yet),
each still shows today's "coming soon" placeholder text, so the pages never
look broken before the client uploads anything.

## What's left to the builder

- Exact Tailwind/markup for the new `/admin/article-categories` and
  `/admin/settings` pages — conventions are decided above (mirror
  `/admin/categories` and `/admin/newsletter` respectively); the pixel-level
  detail is the builder's.
- The precise set of default icon-lookup options beyond the 6 already in use
  (a dozen or so sensible generic Lucide icons is enough — this isn't a
  user-facing choice since there's no picker).
- Where exactly in the task sequence the `ArticleCategory` enum→table
  migration happens relative to the three new `SitePage` values and the new
  `SiteSettings` model — these are independent pieces of work and can be
  ordered however minimizes risk; the plan decides.
