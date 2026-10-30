# Admin Content Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Article categories, three more public pages' text, and site-wide
contact/photo content out of hardcoded TypeScript/JSX and into `/admin`, so the
client can edit all of it themselves without a developer.

**Architecture:** Three independent slices, each following a pattern the
codebase already uses elsewhere: (1) a new `SiteSettings` singleton table +
`/admin/settings` form, mirroring the existing read-only `/admin/newsletter`
page's shape but writable; (2) three new `SitePage` enum values that plug
into the existing `/admin/content` ContentBlock system with zero new admin
concept; (3) `ArticleCategory` converted from a hardcoded Prisma enum into a
real table with `/admin/article-categories` CRUD, mirroring the existing
Materials `/admin/categories` CRUD. Slice 3 is the largest because the old
enum is threaded through ~15 files — admin and public, content and articles.

**Tech Stack:** Next.js 16.3.6 App Router, Prisma 6.19.3 + MySQL, Zod,
react-hook-form is not used here (plain Server Actions + `useActionState`,
matching every existing admin form in this codebase). No test framework is
installed in this project and none of its ~250 existing files have unit
tests — the established QA convention (CLAUDE.md) is `npx tsc --noEmit` +
`npm run lint` + `npm run build`, plus manual browser verification for UI.
Each task below follows that convention instead of introducing a test
framework (CLAUDE.md: no new dependencies without asking).

**Spec:** `docs/superpowers/specs/2026-10-19-admin-content-expansion-design.md`

## Global Constraints

- Every mutation is a Server Action; file upload stays on the existing
  route-handler pattern (`/api/site-images/upload`, already built — reused,
  not changed).
- Every input is validated with Zod at the server boundary (`lib/validation/`).
- Database access stays in `lib/db/` / `lib/queries/`; components don't call
  Prisma directly except Server Components fetching their own data.
- One shadcn component per import; no hand-rolled button/dialog/table.
- Admin-only routes call `requireAdmin()` in the route/page itself, not just
  the layout (CLAUDE.md rule 4).
- Never trust client-supplied role/department/id — not relevant to this
  plan's mutations, which only ever check `role === 'ADMIN'`.
- Passwords/secrets: not touched by this plan.
- Before ending any task: the full repo's `npx tsc --noEmit`, `npm run
  lint`, and `npm run build` must stay clean. Fix what broke; don't suppress.
- No icon picker for categories — new categories always get the fixed
  default icon key (spec, "no picker").
- Header utility bar text stays hardcoded — out of scope (spec).
- No layout/restructuring of any page — content-source changes only (spec).

## Review Focus

1. Deleting an `ArticleCategory` that a `SLIDER` `ContentBlock` slide still
   references must be blocked — this reference has no database foreign key
   (it's a slug inside a JSON blob), so only an explicit application-level
   check catches it; missing this breaks the live homepage slider. (Task 9)
2. A stale or unrecognized category value in `?category=` (an old enum-style
   value like `GR_CIRCULARS` from a bookmark made before this migration, or
   any slug that doesn't match a current row) must fall back to showing all
   articles, never crash the Articles list or detail page. (Task 14)
3. Editing an existing category's `name` must never silently change its
   `slug` — the slug only changes if the admin explicitly edits that field
   too, or a live `/articles?category=<slug>` link breaks on every rename.
   (Task 9)
4. Creating or renaming a category to a `name` or `slug` that collides with
   another existing row must surface a clear form error, not a raw database
   constraint crash — same existing-row check the Materials `Category`
   actions already do. (Task 9)
5. Every page that renders the live category list (Home's services grid,
   the Services page, the footer) must render a sane empty state if
   `ArticleCategory` has zero rows, not crash or show a broken grid. (Task 12)

---

## Slice A — Site-wide settings (contact details, About/Contact images)

### Task 1: `SiteSettings` schema, migration, query, validation

**Files:**
- Modify: `prisma/schema.prisma` (add `SiteSettings` model; add
  `User.updatedSiteSettings SiteSettings[]` back-relation, named
  `@relation("SiteSettingsUpdatedBy")` on both sides — this schema's own
  convention explicitly names every `User` relation even where Prisma
  wouldn't strictly require it, e.g. `"ContentBlockUpdatedBy"`,
  `"ArticleUpdatedBy"`)
- Create: `prisma/migrations/<timestamp>_add_site_settings/migration.sql`
- Create: `lib/queries/site-settings.ts`
- Create: `lib/validation/site-settings.ts`

**Interfaces:**
- Produces:
  - `model SiteSettings { id, contactEmail, contactPhone, contactHours, contactAddress, aboutPhotoKey: String?, aboutDisclaimer, contactMapImageKey: String?, updatedAt, updatedById: String?, updatedBy: User? @relation("SiteSettingsUpdatedBy", ...) }`
    exactly as specified in the design doc §4.
  - `getSiteSettings(): Promise<SiteSettings>` in `lib/queries/site-settings.ts`,
    wrapped in React `cache()` (same convention as `getArticleById`). Reads
    `prisma.siteSettings.findFirst()` — never returns `null`/`undefined`
    because the seed migration guarantees exactly one row; if the query
    somehow returns nothing, throw rather than let a caller dereference
    `undefined` (Review Focus is about zero *categories*, not zero
    settings rows — this one row's existence is a migration invariant, not
    a runtime case any page needs to handle).
  - `siteSettingsInputSchema` in `lib/validation/site-settings.ts`: Zod
    object with `contactEmail: z.string().trim().email().max(200)`,
    `contactPhone: z.string().trim().min(1).max(60)`,
    `contactHours: z.string().trim().min(1).max(120)`,
    `contactAddress: z.string().trim().min(1).max(300)`,
    `aboutDisclaimer: z.string().trim().min(1).max(2000)`, plus
    `aboutPhotoKey` / `contactMapImageKey` each reusing the same
    `imageKeySchema` pattern already defined in `lib/validation/content.ts`
    (regex against `SITE_IMAGE_FILENAME_PATTERN`, nullable) — duplicate the
    two-line schema rather than importing a private const from
    `content.ts`.

- [ ] **Step 1: Add the `SiteSettings` model to `prisma/schema.prisma`**, with the exact fields above, placed near `ContentBlock`. Add the `User` back-relation field.

- [ ] **Step 2: Generate and hand-edit the migration**

Run `npx prisma migrate dev --create-only --name add_site_settings` to scaffold the `CREATE TABLE` statement, then append an `INSERT` seeding exactly one row with today's real current copy (read verbatim from `app/(marketing)/_components/marketing-footer.tsx` and `app/(marketing)/contact/_components/contact-details.tsx`'s current hardcoded values: email `help@talatisutra.in`, phone `+91 98250 00000`, hours `Mon–Sat, 10am–6pm`, address `Gandhinagar, Gujarat`; and `app/(marketing)/about/page.tsx`'s current disclaimer paragraph), with `aboutPhotoKey`/`contactMapImageKey` both `NULL`, `id` a hand-written readable string (e.g. `site-settings-default`) since this is seeded directly by SQL, not through Prisma Client.

- [ ] **Step 3: Apply the migration** — `npx prisma migrate dev`. Verify: query the new table directly (e.g. `npx prisma studio` or a one-off `SELECT * FROM sitesettings;`) and confirm exactly one row with the seeded values.

- [ ] **Step 4: Write `getSiteSettings()` in `lib/queries/site-settings.ts`** per the signature above.

- [ ] **Step 5: Write `siteSettingsInputSchema` in `lib/validation/site-settings.ts`** per the fields above.

- [ ] **Step 6: Verify** — `npx tsc --noEmit` clean.

- [ ] **Step 7: Commit.**

### Task 2: `/admin/settings` page

**Files:**
- Create: `app/(app)/admin/settings/actions.ts`
- Create: `app/(app)/admin/settings/page.tsx`
- Create: `app/(app)/admin/settings/settings-form.tsx`

**Interfaces:**
- Consumes: `getSiteSettings()`, `siteSettingsInputSchema` (Task 1);
  `SiteImageUploadField` from `@/app/(app)/admin/content/site-image-upload-field`
  (existing component, imported across route segments — reused, not moved);
  `writeAuditLog` (`lib/audit.ts`); `requireAdmin` (`lib/auth/session.ts`).
- Produces: `updateSiteSettings(_prevState: SettingsFormState, formData: FormData): Promise<SettingsFormState>` where `interface SettingsFormState { error?: string }`.

- [ ] **Step 1: Write `updateSiteSettings` in `actions.ts`** — `requireAdmin("/admin/settings")`, parse `formData` against `siteSettingsInputSchema` (fields: `contactEmail`, `contactPhone`, `contactHours`, `contactAddress`, `aboutDisclaimer`, plus `aboutPhotoKey`/`contactMapImageKey` read as hidden-input strings the same way `ContentBlockFormDialog`'s image fields already round-trip), `prisma.siteSettings.update({ where: { id: <the single row's id> }, data: {...} })` — look the row up via `getSiteSettings()` first to get its `id` rather than hardcoding the seeded id string. Write an audit log entry (`action: "site-settings.update"`, `entity: "SiteSettings"`). `revalidatePath("/")`, `revalidatePath("/about")`, `revalidatePath("/contact")` (the three public consumers from Task 3). Return `{}` on success, `{ error }` on Zod failure.

- [ ] **Step 2: Write `page.tsx`** — `requireAdmin("/admin/settings")`, fetch `getSiteSettings()`, render `<SettingsFormDialog settings={settings} />`... no dialog needed here, this is a single always-visible form (not a dialog, matching the design doc's "/admin/newsletter shape, writable" call) — render `<SettingsForm settings={settings} />` directly on the page.

- [ ] **Step 3: Write `settings-form.tsx`** (`"use client"`) — one `useActionState(updateSiteSettings, {})` form with the 4 text fields (`Input`/`Textarea` + `Label`, same pattern as `category-form-dialog.tsx`) and two `SiteImageUploadField`s (About photo, Contact map), each holding its key in local `useState` and a hidden input, same wiring `ContentBlockFormDialog`'s `HeroFields` already uses for its one image field. A single `Button type="submit"` at the bottom, no dialog footer.

- [ ] **Step 4: Verify in the browser.** Start the dev server (confirm MySQL/XAMPP is running first), sign in as an admin, open `/admin/settings`, change one text field and upload an image for About's photo, save, confirm the page reloads with the new values persisted.

- [ ] **Step 5: Verify** — `npx tsc --noEmit`, `npm run lint` clean.

- [ ] **Step 6: Commit.**

### Task 3: Public consumers read `SiteSettings`

**Files:**
- Modify: `app/(marketing)/_components/marketing-footer.tsx`
- Modify: `app/(marketing)/contact/_components/contact-details.tsx`
- Modify: `app/(marketing)/contact/page.tsx`
- Modify: `app/(marketing)/about/page.tsx`

**Interfaces:**
- Consumes: `getSiteSettings()` (Task 1).

- [ ] **Step 1: Make `MarketingFooter` an `async` Server Component** that calls `getSiteSettings()` itself and renders its existing 3-field Contact block (email, phone, address only — no Hours line, per the design doc's explicit call) from the fetched record instead of the hardcoded `help@talatisutra.in` / `+91 98250 00000` / `Gandhinagar, Gujarat` strings. No change to any other part of the footer.

- [ ] **Step 2: Give `ContactDetails` a `settings: { contactEmail: string; contactPhone: string; contactHours: string; contactAddress: string; contactMapImageKey: string | null }` prop** and build its `ROWS` array from it instead of the hardcoded literals; replace the static "Map coming soon" box with: if `settings.contactMapImageKey` is set, an `<img src={`/api/site-images/${settings.contactMapImageKey}`} ... />` filling the same `aspect-square` box; otherwise keep today's "Map coming soon" placeholder box unchanged.

- [ ] **Step 3: In `contact/page.tsx`, call `getSiteSettings()` and pass it to `<ContactDetails settings={settings} />`.**

- [ ] **Step 4: In `about/page.tsx`, call `getSiteSettings()`.** Replace the static "Photograph coming soon" box: if `settings.aboutPhotoKey` is set, render `<img src={`/api/site-images/${settings.aboutPhotoKey}`} ... />` inside the existing `.plate`-style `aspect-video` wrapper; otherwise keep the placeholder box. Replace the hardcoded closing disclaimer paragraph's text with `settings.aboutDisclaimer`.

- [ ] **Step 5: Verify in the browser** — visit `/`, `/about`, `/contact` and confirm the footer, About page and Contact sidebar all show the same values just edited via `/admin/settings` in Task 2, and that an unedited placeholder (no image uploaded yet) still shows the original "coming soon" text, not a broken image.

- [ ] **Step 6: Verify** — `npx tsc --noEmit`, `npm run lint`, `npm run build` clean.

- [ ] **Step 7: Commit.**

---

## Slice B — Articles/Privacy/Disclaimer join the Site Content system

### Task 4: Extend `SitePage`; seed three `ContentBlock` rows

**Files:**
- Modify: `prisma/schema.prisma` (`SitePage` enum gains `ARTICLES`, `PRIVACY`, `DISCLAIMER`)
- Modify: `lib/queries/content.ts` (`SITE_PAGE_PATH`, `SITE_PAGE_LABEL`)
- Create: `prisma/migrations/<timestamp>_add_site_pages_articles_privacy_disclaimer/migration.sql`

**Interfaces:**
- Produces: `SITE_PAGE_PATH` gains `ARTICLES: "/articles"`, `PRIVACY: "/privacy"`, `DISCLAIMER: "/disclaimer"`. `SITE_PAGE_LABEL` gains `ARTICLES: "Articles"`, `PRIVACY: "Privacy"`, `DISCLAIMER: "Disclaimer"`. (`parseSitePageSegment` needs no change — it already derives from `SitePage` membership generically.)

- [ ] **Step 1: Add the three values to the `SitePage` enum** in `prisma/schema.prisma`.

- [ ] **Step 2: Generate and hand-edit the migration** — `npx prisma migrate dev --create-only --name add_site_pages_articles_privacy_disclaimer`, then append three `INSERT INTO contentblock` statements, one `TEXT`-type block per new page, `sortOrder = 0`, hand-written cuid-shaped `id`s, `data` as a JSON string matching `textBlockDataSchema`'s shape (`{"heading": ..., "body": ...}`), `updatedById = NULL`:
  - `ARTICLES`: heading `"Articles"`, body `"GRs, circulars, land record guides, exam preparation and forms, organised by subject and date."` (today's real intro, from `app/(marketing)/articles/page.tsx`).
  - `PRIVACY`: heading `"Privacy"`, body today's real placeholder sentence from `app/(marketing)/privacy/page.tsx` (`"This page is coming soon. Talatisutra is an independent information resource and is not an official website of the Government of Gujarat or the Government of India."`).
  - `DISCLAIMER`: heading `"Disclaimer"`, body the equivalent current sentence from `app/(marketing)/disclaimer/page.tsx` (read that file first — carry its exact current text forward verbatim).

- [ ] **Step 3: Add the three entries to `SITE_PAGE_PATH` and `SITE_PAGE_LABEL`** in `lib/queries/content.ts`.

- [ ] **Step 4: Apply the migration** — `npx prisma migrate dev`.

- [ ] **Step 5: Verify in the browser** — `/admin/content` now lists 7 pages including Articles/Privacy/Disclaimer, each showing "1 block".

- [ ] **Step 6: Verify** — `npx tsc --noEmit` clean (this surfaces every `Record<SitePage, ...>` that still needs the 3 new keys — fix any the compiler flags beyond the two files above).

- [ ] **Step 7: Commit.**

### Task 5: Public pages render their `ContentBlock` instead of static JSX

**Files:**
- Modify: `app/(marketing)/privacy/page.tsx`
- Modify: `app/(marketing)/disclaimer/page.tsx`
- Modify: `app/(marketing)/articles/page.tsx`

**Interfaces:**
- Consumes: `getPageBlocks("PRIVACY" | "DISCLAIMER" | "ARTICLES")` (`lib/queries/content.ts`); `BlockRenderer` (`components/content/block-renderer.tsx`); `TextBlockData` (`lib/validation/content.ts`).

- [ ] **Step 1: Rewrite `privacy/page.tsx` and `disclaimer/page.tsx`** to each `await getPageBlocks(...)` and render `<BlockRenderer blocks={blocks} />` as the page's entire body (no extra wrapper div — `TextBlock` already supplies its own centered, padded `<section>`, matching how `about/page.tsx` renders its own TEXT block today). Keep each page's `metadata` (`title`, `robots: { index: true, follow: true }`) unchanged.

- [ ] **Step 2: In `articles/page.tsx`, fetch the ARTICLES page's TEXT block** alongside the existing `getArticles`/`getArticleCategoryCounts`/`getLatestArticles` calls, and replace the hardcoded `<h1>Articles</h1>` / intro `<p>` with a local inline render of that block's `heading`/`body` — same `TextBlockNoPadding`-style approach already used on `app/(marketing)/page.tsx` for Home's intro (a small local function, not `BlockRenderer`, since this heading sits inline inside the page's own `mx-auto max-w-5xl` wrapper alongside the category pills and article list, not in its own section). If the ARTICLES block is somehow missing, fall back to the current hardcoded strings rather than rendering nothing.

- [ ] **Step 3: Verify in the browser** — `/privacy`, `/disclaimer`, `/articles` all render unchanged visually from before this task; edit each via `/admin/content` and confirm the public page updates.

- [ ] **Step 4: Verify** — `npx tsc --noEmit`, `npm run lint`, `npm run build` clean.

- [ ] **Step 5: Commit.**

---

## Slice C — Article categories: enum → admin-managed table

### Task 6: Schema + migration (`ArticleCategory` enum → table, `Article.categoryId`, SLIDER JSON rewrite)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_article_categories_table/migration.sql`

**Interfaces:**
- Produces: `model ArticleCategory { id, name (unique), slug (unique), icon, shortDescription (Text), servicesDescription (Text), tags (Json), sortOrder (Int, default 0), createdAt, articles: Article[] }` and `Article.categoryId: String` + `category: ArticleCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)`, replacing `Article.category: ArticleCategory` (enum field) and the `ArticleCategory` enum itself — exact shape per design doc §2.

- [ ] **Step 1: Edit `prisma/schema.prisma`** — delete the `ArticleCategory` enum block; add the `ArticleCategory` model (name reused) per the signature above, placed near `Category`; change `Article.category ArticleCategory` to `Article.categoryId String` + `category ArticleCategory @relation(...)`; add `@@index([categoryId, publishedAt])` on `Article` replacing the old `@@index([category, publishedAt])`.

- [ ] **Step 2: Write the migration by hand** (don't trust the auto-diff's statement ordering for this one — an enum-to-relation conversion needs backfill between the column-add and the NOT-NULL/FK steps). In this exact order:
  1. `CREATE TABLE articlecategory (...)` matching the model, with `UNIQUE` on `name` and `slug`.
  2. `INSERT INTO articlecategory` — 6 rows, hand-written ids (`cat-gr-circulars`, `cat-land-records`, `cat-panchayat-administration`, `cat-exam-preparation`, `cat-salary-service-rules`, `cat-forms-downloads`), each row's `name`/`icon`/`shortDescription`/`servicesDescription`/`tags`/`sortOrder` copied verbatim from the current `CATEGORY_META` in `lib/articles/categories.ts` (read it for the exact label/description/tag text — do not paraphrase), `slug` values exactly `gr-circulars`, `land-records`, `panchayat-administration`, `exam-preparation`, `salary-service-rules`, `forms-downloads` (in that order, `sortOrder` 0–5), `tags` as a JSON array string.
  3. `ALTER TABLE article ADD COLUMN categoryId VARCHAR(191) NULL;`
  4. Six `UPDATE article SET categoryId = '<matching cat-… id>' WHERE category = '<OLD_ENUM_VALUE>';` statements, one per category.
  5. `ALTER TABLE article MODIFY categoryId VARCHAR(191) NOT NULL;` then add the FK constraint (`RESTRICT` on delete) and drop the old `category` column.
  6. `UPDATE contentblock SET data = JSON_SET(data, '$.slides[0].category', 'gr-circulars', '$.slides[1].category', 'land-records', ...) WHERE page = 'HOME' AND type = 'SLIDER';` — read the HOME slider block's current seeded `data` first (via `npx prisma studio` or a `SELECT`) to see exactly how many slides it has and which enum value each one currently holds, then write the `JSON_SET` path list to match that actual row rather than assuming a fixed slide count.

- [ ] **Step 3: Apply the migration** — `npx prisma migrate dev`. Verify: `SELECT * FROM articlecategory;` returns 6 rows; `SELECT id, categoryId FROM article;` shows every article's `categoryId` populated (no NULLs); `SELECT data FROM contentblock WHERE page='HOME' AND type='SLIDER';` shows slug strings, not the old enum values.

- [ ] **Step 4: Verify** — `npx prisma generate` runs clean (regenerates the client types for the new model/relation).

- [ ] **Step 5: Commit.**

### Task 7: Category queries, validation, icon lookup; update the two schemas that reference the old enum

**Files:**
- Create: `lib/queries/article-categories.ts`
- Create: `lib/validation/article-categories.ts`
- Create: `lib/articles/icons.ts`
- Delete: `lib/articles/categories.ts`
- Modify: `lib/validation/content.ts`
- Modify: `lib/validation/articles.ts`

**Interfaces:**
- Produces:
  - `lib/articles/icons.ts`: `ICON_OPTIONS: Record<string, LucideIcon>` with at least the 6 keys already in use (`FileText`, `Map`, `Landmark`, `GraduationCap`, `Scale`, `Download`) plus `Tag`, `Folder`, `BookOpen`, `Archive`, `FileCheck`, `Newspaper`; `DEFAULT_ICON_KEY = "Tag"`; `resolveIcon(key: string): LucideIcon` returns `ICON_OPTIONS[key] ?? ICON_OPTIONS[DEFAULT_ICON_KEY]`.
  - `lib/queries/article-categories.ts`: `getArticleCategories(): Promise<ArticleCategory[]>`, wrapped in React `cache()` (same convention as `getArticleById` — several tasks below call this more than once per request, e.g. `getArticleCategoryCounts()` and the page component that also renders the list) — `prisma.articleCategory.findMany({ orderBy: { sortOrder: "asc" } })`; `isCategoryDeletable(categoryId: string): Promise<{ deletable: boolean; reason?: string }>` — `true` only if `prisma.article.count({ where: { categoryId } }) === 0` AND no `SLIDER`-type `ContentBlock`'s `data.slides` array contains an entry whose `category` equals this category's `slug` (fetch all `SLIDER` blocks via `prisma.contentBlock.findMany({ where: { type: "SLIDER" } })`, parse each with `sliderBlockDataSchema`, check `slides.some(s => s.category === category.slug)` after first loading the category's own `slug` via its `id`); on failure, `reason` is `"This category still has articles in it."` or `"This category is still used by the homepage slider."` respectively (the first one checked that fails wins).
  - `lib/validation/article-categories.ts`: `articleCategorySchema = z.object({ name: z.string().trim().min(1).max(100), slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only."), shortDescription: z.string().trim().min(1).max(500), servicesDescription: z.string().trim().min(1).max(500), tags: z.array(z.string().trim().min(1).max(40)).max(3) })`.
  - `lib/validation/content.ts`: `sliderSlideSchema.category` changes from `z.nativeEnum(ArticleCategory)` to `z.string().trim().min(1)` (existence against the live category list is checked where it's used — Task 11 — not inside this generic schema, which has no DB access); drop the now-unused `import { ArticleCategory } from "@prisma/client"`.
  - `lib/validation/articles.ts`: `articleInputSchema.category: z.nativeEnum(ArticleCategory)` renamed to `categoryId: z.string().min(1, "Choose a category.")`; drop the `ArticleCategory` import.

- [ ] **Step 1: Write `lib/articles/icons.ts`** per the signature above — import all 12 icons from `lucide-react`.

- [ ] **Step 2: Write `lib/queries/article-categories.ts`** per the signature above.

- [ ] **Step 3: Write `lib/validation/article-categories.ts`** per the signature above.

- [ ] **Step 4: Update `lib/validation/content.ts` and `lib/validation/articles.ts`** per the signatures above.

- [ ] **Step 5: Delete `lib/articles/categories.ts`.**

- [ ] **Step 6: Verify** — `npx tsc --noEmit`. This will surface every remaining import of `lib/articles/categories.ts` across the codebase as a compile error — that list is exactly the consumer set Tasks 9–14 fix; don't fix them here, just confirm the error list matches the files named in those tasks (no surprises).

- [ ] **Step 7: Commit.**

### Task 8: Rewrite `lib/queries/articles.ts` for the FK relation

**Files:**
- Modify: `lib/queries/articles.ts`

**Interfaces:**
- Consumes: `getArticleCategories()` (Task 7).
- Produces:
  - `getLatestArticles(limit: number)`: unchanged signature, now `include: { category: true }`.
  - `getLatestArticlesByCategory(categorySlug: string, limit: number)`: `prisma.article.findMany({ where: { category: { slug: categorySlug } }, include: { category: true }, orderBy: { publishedAt: "desc" }, take: limit })`.
  - `getArticles(categoryId?: string)`: `prisma.article.findMany({ where: categoryId ? { categoryId } : undefined, include: { category: true }, orderBy: { publishedAt: "desc" } })`.
  - `getArticleById(id: string)`: unchanged signature/`cache()` wrapping, now `include: { category: true }`.
  - `getArticleCategoryCounts(): Promise<Record<string, number>>` keyed by category **`slug`** (not `id`, and not the old enum) — public pages only ever have a slug in hand from the URL, so keying by slug avoids every caller juggling both; `prisma.article.groupBy({ by: ["categoryId"], _count: true })`, then map each count onto its category's `slug` by cross-referencing `getArticleCategories()`, ensuring a `0` entry exists for every category with no articles (replacing the old `CATEGORY_ORDER` loop).

- [ ] **Step 1: Rewrite each function** per the signatures above. `getArticleCategoryCounts` needs `getArticleCategories()` to build the zero-filled result — call it inside this function.

- [ ] **Step 2: Verify** — `npx tsc --noEmit` (this file's own errors should now be gone; its callers still error until Tasks 9–14).

- [ ] **Step 3: Commit.**

### Task 9: `/admin/article-categories` — new CRUD section

**Files:**
- Create: `app/(app)/admin/article-categories/actions.ts`
- Create: `app/(app)/admin/article-categories/page.tsx`
- Create: `app/(app)/admin/article-categories/category-form-dialog.tsx`

**Interfaces:**
- Consumes: `getArticleCategories()`, `isCategoryDeletable()` (Task 7); `articleCategorySchema` (Task 7); `DEFAULT_ICON_KEY`, `resolveIcon()` (Task 7); `DeleteConfirmButton` (`components/admin/delete-confirm-button.tsx`); `slugify()` (`lib/slugify.ts`).
- Produces:
  - `interface CategoryFormState { error?: string }`
  - `createArticleCategory(_prevState: CategoryFormState, formData: FormData): Promise<CategoryFormState>`
  - `updateArticleCategory(id: string, _prevState: CategoryFormState, formData: FormData): Promise<CategoryFormState>`
  - `deleteArticleCategory(id: string): Promise<void>`
  - `moveArticleCategory(id: string, direction: "up" | "down"): Promise<void>`

- [ ] **Step 1: Write `createArticleCategory`** — `requireAdmin("/admin/article-categories")`; read `name`, `slug`, `shortDescription`, `servicesDescription`, and up to 3 `tags` fields from `formData` (if the form submits a client-edited `slug` field, use it; otherwise it's fine for the form to always send a slug — see Step 5 below, the form derives it client-side via `slugify(name)` unless the admin has touched the slug field, same UX as the Materials category form's name field but with an extra editable slug input, per the design doc's "slug auto-derived from name, editable"); parse with `articleCategorySchema`; reject with `"A category with this name already exists."` / `"A category with this slug already exists."` if `prisma.articleCategory.findFirst({ where: { OR: [{ name }, { slug }] } })` finds a different row (Review Focus #4); `icon: DEFAULT_ICON_KEY` always (no picker — Review Focus n/a, spec is explicit); `sortOrder` = current count; write an audit log (`action: "article-category.create"`); `revalidatePath` on `/admin/article-categories`, `/`, `/services`.

- [ ] **Step 2: Write `updateArticleCategory`** — same validation/collision check as create but excluding the row's own id (mirrors `updateCategory` in the Materials actions file); updates `name`/`slug`/`shortDescription`/`servicesDescription`/`tags` only — never touches `icon`. Audit log `"article-category.update"`. Revalidate the same three paths plus `/articles` (category labels appear there too).

- [ ] **Step 3: Write `deleteArticleCategory`** — `requireAdmin`; call `isCategoryDeletable(id)` (Task 7); if not deletable, `redirect("/admin/article-categories?error=" + encodeURIComponent(reason))` (mirrors the Materials `?error=has-children` pattern); otherwise delete, audit log `"article-category.delete"`, revalidate, redirect to `/admin/article-categories`.

- [ ] **Step 4: Write `moveArticleCategory`** — swap `sortOrder` with the adjacent row in the fetched-ordered list (same algorithm as `moveContentBlock` in `app/(app)/admin/content/actions.ts` — read that function for the exact swap approach), revalidate `/admin/article-categories`.

- [ ] **Step 5: Write `category-form-dialog.tsx`** (`"use client"`) — mirrors `app/(app)/admin/categories/category-form-dialog.tsx`'s structure exactly (same `useActionState`/open-close/reset pattern), fields: Name (`Input`), Slug (`Input`, placeholder "auto from name"; client-side, update it to `slugify(name)` on every Name change *unless* the admin has already typed into the Slug field directly — track a `slugTouched` boolean in local state, same idea as any "auto-slug unless edited" field), Short description (`Textarea`), Services description (`Textarea`), up to 3 Tags (3 `Input`s, labeled "Tag 1"/"Tag 2"/"Tag 3", empty ones omitted on submit). No icon field.

- [ ] **Step 6: Write `page.tsx`** — `requireAdmin`; fetch `getArticleCategories()`; for each, also compute `canDelete` via `isCategoryDeletable(category.id)` (a few extra queries is fine at this list's size — 6-ish rows); render a table (reuse `Table`/`TableBody`/etc. from `@/components/ui/table`) with columns Icon (via `resolveIcon(category.icon)`), Name, Slug, Articles count, up/down reorder buttons (same `ArrowUp`/`ArrowDown` form-per-button pattern as `app/(app)/admin/content/[page]/page.tsx`), `CategoryFormDialog mode="edit"`, and `DeleteConfirmButton` with `disabled={!canDelete}` / `disabledReason` set to the `isCategoryDeletable` reason when blocked (Review Focus #1). Read the `?error=` search param (same shape as the Materials categories `[id]/page.tsx`) and show it as a dismissable banner if present. A `CategoryFormDialog mode="create"` trigger in the header.

- [ ] **Step 7: Verify in the browser** — visit `/admin/article-categories`: all 6 seeded categories appear with their original icons/order; create a 7th with no icon field and confirm it gets the default icon; attempt to delete one of the 6 that has articles and confirm the button is disabled with a reason; delete the new 7th (no articles, no slider reference) and confirm it succeeds; reorder two rows and confirm the public Services page order changes to match (cross-check after Task 12). The SLIDER-only guard (Review Focus #1 — a category with zero articles but still picked in a HOME slider slide) can't be exercised yet here, since the admin UI to assign a slide's category doesn't exist until Task 11; it's exercised in Task 15's final pass instead.

- [ ] **Step 8: Verify** — `npx tsc --noEmit`, `npm run lint` clean for this task's files.

- [ ] **Step 9: Commit.**

### Task 10: Admin Articles section consumers

This is an internal `/admin` filter, not the public URL the design doc's
slug decision is about — it keys off `categoryId` directly (matching
`Article.categoryId`'s own FK value), not `slug`. Task 14's public Articles
page uses `slug` in its own `?category=` query param; the two are
unrelated query strings on different routes and never need to match.

**Files:**
- Modify: `app/(app)/admin/articles/actions.ts`
- Modify: `app/(app)/admin/articles/article-form-dialog.tsx`
- Modify: `app/(app)/admin/articles/article-category-filter.tsx`
- Modify: `app/(app)/admin/articles/page.tsx`

**Interfaces:**
- Consumes: `getArticleCategories()` (Task 7); `getArticles(categoryId?)` (Task 8); `articleInputSchema` (now `categoryId`, Task 7).

- [ ] **Step 1: In `actions.ts`**, change `parseArticleInput`'s `category: formData.get("category")` to `categoryId: formData.get("categoryId")`; everywhere `meta: { category: article.category }` is logged in `writeAuditLog` calls, change to `meta: { categoryId: ... }` (the id is what's actually known here now; no need to look up the name for an audit log).

- [ ] **Step 2: In `article-form-dialog.tsx`**, add a `categories: ArticleCategory[]` prop to `Props` (both `mode` variants); replace the `CATEGORY_META`/`CATEGORY_ORDER` import and usage: the `Select` becomes `name="categoryId"`, `defaultValue={props.mode === "edit" ? props.article.categoryId : undefined}`, its `SelectValue` function-child becomes `(value: string | undefined) => value ? categories.find(c => c.id === value)?.name : undefined` (keep the existing `undefined`-safe handling from the earlier crash fix), and `SelectContent` maps `categories` instead of `CATEGORY_ORDER`.

- [ ] **Step 3: In `article-category-filter.tsx`**, add a `categories: ArticleCategory[]` prop; same `CATEGORY_META`/`CATEGORY_ORDER` → `categories` swap as Step 2, filter value becomes the category's `id` (matching `getArticles(categoryId?)`'s new parameter).

- [ ] **Step 4: In `page.tsx`**, fetch `const categories = await getArticleCategories();` alongside the existing `getArticles` call; replace `isArticleCategory`'s enum-membership check with "is this a valid id" — simplest correct check: `const category = categories.some(c => c.id === rawCategory) ? rawCategory : undefined;` (no need for a separate type-guard function); pass `categories` into both `ArticleFormDialog` and `ArticleCategoryFilter`; replace `CATEGORY_META[article.category].label` in the table row with `article.category.name` (now the included relation object, from Task 8's `getArticles`).

- [ ] **Step 5: Verify in the browser** — `/admin/articles`: category filter dropdown lists the live categories; create a new article choosing a category; edit an existing article's category; confirm the table's Category column still shows the right name.

- [ ] **Step 6: Verify** — `npx tsc --noEmit`, `npm run lint` clean for this task's files.

- [ ] **Step 7: Commit.**

### Task 11: Admin Site Content's SLIDER editor consumers

**Files:**
- Modify: `app/(app)/admin/content/block-type-fields.tsx` (`SliderFields` only)
- Modify: `app/(app)/admin/content/content-block-form-dialog.tsx`
- Modify: `app/(app)/admin/content/[page]/page.tsx`

**Interfaces:**
- Consumes: `getArticleCategories()` (Task 7).

- [ ] **Step 1: In `block-type-fields.tsx`**, give `SliderFields` a `categories: ArticleCategory[]` prop; replace the `CATEGORY_META`/`CATEGORY_ORDER` import/usage: the per-slide `Select`'s `value`/`onValueChange` carry the category's `slug` (unchanged shape, since `slide.category` is already typed as the slug string per Task 7's schema change), its `SelectValue` function-child becomes `(value: string) => categories.find(c => c.slug === value)?.name`, `SelectContent` maps `categories` with `value={c.slug}`; the "Add slide" button's new-slide default becomes `category: categories[0]?.slug ?? ""`.

- [ ] **Step 2: In `content-block-form-dialog.tsx`**, add a `categories: ArticleCategory[]` prop to the component (both `mode` branches of `Props`), pass it straight through to `<SliderFields value={...} categories={categories} onChange={setData} />`. (`EMPTY_DATA.SLIDER` stays `{ slides: [] }` — unaffected.)

- [ ] **Step 3: In `[page]/page.tsx`**, fetch `const categories = await getArticleCategories();` alongside `getPageBlocks(page)`; pass `categories={categories}` to both the create-mode and edit-mode `ContentBlockFormDialog` elements (even on pages that never show a SLIDER option — the prop is required by the component's new signature regardless of which block type ends up rendered, same as `hasSlider` is already passed unconditionally today).

- [ ] **Step 4: Verify in the browser** — `/admin/content/home`, edit the existing SLIDER block, confirm each slide's Category dropdown shows live category names and saves correctly.

- [ ] **Step 5: Verify** — `npx tsc --noEmit`, `npm run lint` clean for this task's files.

- [ ] **Step 6: Commit.**

### Task 12: Public consumers — Home page, services grid, slider

**Files:**
- Modify: `app/(marketing)/page.tsx`
- Modify: `app/(marketing)/_components/home-services-section.tsx`
- Modify: `components/content/slider-block.tsx`

**Interfaces:**
- Consumes: `getArticleCategories()` (Task 7); `getLatestArticlesByCategory(categorySlug, limit)` (Task 8); `resolveIcon()` (Task 7).

- [ ] **Step 1: In `page.tsx`**, fetch `const categories = await getArticleCategories();` alongside the existing `Promise.all`; change `enrichedSlides`'s `.map()` to also attach the matching category object: `const categoryInfo = categories.find(c => c.slug === slide.category); return { ...slide, articles: await getLatestArticlesByCategory(slide.category, 3), categoryInfo };` — skip (filter out) any slide whose `categoryInfo` comes back `undefined` (a stale slug with no matching row) rather than letting it reach `SliderBlock` broken. Pass `categories={categories}` to `<HomeServicesSection categories={categories} />`.

- [ ] **Step 2: In `home-services-section.tsx`**, add a `categories: ArticleCategory[]` prop; replace `CATEGORY_ORDER.map(...)` with `categories.map(...)`, `meta.icon` → `resolveIcon(category.icon)`, `meta.label` → `category.name`, `meta.shortDescription` → `category.shortDescription`, `meta.path` → `` `/articles?category=${category.slug}` ``. If `categories.length === 0`, render nothing in the grid but keep the heading/intro and the "All services" link (Review Focus #5) — the simplest sane empty state for a page that otherwise assumes at least one tile.

- [ ] **Step 3: In `slider-block.tsx`**, change `EnrichedSlide` to `SliderBlockData["slides"][number] & { articles: Article[]; categoryInfo: ArticleCategory }`; drop the `CATEGORY_META` import; replace `const category = CATEGORY_META[slide.category];` with using `slide.categoryInfo` directly (`.name` for display text, `` `/articles?category=${slide.categoryInfo.slug}` `` everywhere `category.path` was used).

- [ ] **Step 4: Verify in the browser** — `/`: services grid shows live categories with correct icons; slider still shows its slides with working "Browse the full collection" links; temporarily set `ArticleCategory` to zero rows in a scratch DB check only if easy, otherwise reason through Step 2's empty-state branch by inspection.

- [ ] **Step 5: Verify** — `npx tsc --noEmit`, `npm run lint`, `npm run build` clean.

- [ ] **Step 6: Commit.**

### Task 13: Public consumers — Services page, footer

**Files:**
- Modify: `app/(marketing)/services/page.tsx`
- Modify: `app/(marketing)/_components/marketing-footer.tsx`

**Interfaces:**
- Consumes: `getArticleCategories()` (Task 7); `resolveIcon()` (Task 7).

- [ ] **Step 1: In `services/page.tsx`**, fetch `const categories = await getArticleCategories();`; replace `CATEGORY_ORDER.map(...)` with `categories.map(...)`, same field swaps as Task 12 Step 2 (`meta.icon` → `resolveIcon(category.icon)`, `.label` → `.name`, `.servicesDescription` → `.servicesDescription` (unchanged field name), `.tags` → `.tags` (now `Json` — cast/validate as `string[]` when mapping, or `(category.tags as string[])`), `.path` → `` `/articles?category=${category.slug}` ``). Empty state: if `categories.length === 0`, render nothing below the `BlockRenderer` rather than an empty `divide-y` wrapper (Review Focus #5).

- [ ] **Step 2: In `marketing-footer.tsx`** (already made `async` in Task 3), also fetch `getArticleCategories()` and replace the Categories column's `CATEGORY_ORDER.map(...)` the same way (`.name`, `` `/articles?category=${category.slug}` ``). Empty state: if zero categories, omit the whole "Categories" column `<div>` (Review Focus #5).

- [ ] **Step 3: Verify in the browser** — `/services` shows all categories with correct icons/tags/links; footer's Categories column matches.

- [ ] **Step 4: Verify** — `npx tsc --noEmit`, `npm run lint`, `npm run build` clean.

- [ ] **Step 5: Commit.**

### Task 14: Public consumers — Articles list, detail, sidebar

**Files:**
- Modify: `app/(marketing)/articles/page.tsx`
- Modify: `app/(marketing)/articles/[id]/page.tsx`
- Modify: `app/(marketing)/articles/_components/article-sidebar.tsx`

**Interfaces:**
- Consumes: `getArticleCategories()` (Task 7); `getArticles(categoryId?)`, `getArticleCategoryCounts()`, `getArticleById()`, `getLatestArticles()` (Task 8).

- [ ] **Step 1: In `articles/page.tsx`**, fetch `const categories = await getArticleCategories();`; the `category` search param is now matched against live **slugs** instead of `z.nativeEnum(ArticleCategory)` (per the design doc's public-URL decision: `/articles?category=gr-circulars`) — replace `categoryParamSchema`'s parse with `const matched = categories.find(c => c.slug === rawCategory); const categoryId = matched?.id;` (Review Focus #2: an unrecognized or stale `?category=` value simply finds nothing and `categoryId` stays `undefined`, i.e. "show all" — no schema-parse failure, no crash), then call `getArticles(categoryId)`; the category-pills `.map()` iterates `categories` instead of `CATEGORY_ORDER`, each pill's `href` is `` `/articles?category=${category.slug}` ``, its "active" check compares `matched?.slug === category.slug`, and its count/label come from `category.name` / `counts[category.slug]` (Task 8's slug-keyed `getArticleCategoryCounts()`); each article row's `CATEGORY_META[article.category].label` becomes `article.category.name` (the included relation, from Task 8).

- [ ] **Step 2: In `article-sidebar.tsx`**, replace the `counts: Record<ArticleCategory, number>` / `activeCategory?: ArticleCategory` props with `counts: Record<string, number>` (keyed by **slug**, per Task 8's `getArticleCategoryCounts()`), `categories: ArticleCategory[]` (new prop), `activeCategory?: string` (a slug); the `CATEGORY_ORDER.map(...)` becomes `categories.map(...)` using `` `/articles?category=${category.slug}` `` for the link, `category.name` for the label, and `activeCategory === category.slug` for the active state.

- [ ] **Step 3: In `articles/[id]/page.tsx`**, drop the `CATEGORY_META` import entirely; `article.category` is now the included relation object (Task 8's `getArticleById`) — replace every `meta.label`/`meta.path` usage with `article.category.name` / `` `/articles?category=${article.category.slug}` ``; pass `categories={await getArticleCategories()}` to `<ArticleSidebar>` alongside the existing `counts`/`latest`/`activeCategory={article.category.slug}`.

- [ ] **Step 4: Verify in the browser** — `/articles`, filter by each category pill, confirm counts and filtering work and the URL shows a readable slug; visit a stale `/articles?category=GR_CIRCULARS` (old enum-style) and `/articles?category=nonexistent-slug` and confirm both show all articles rather than erroring; open an article detail page and confirm the category breadcrumb/link and sidebar both work.

- [ ] **Step 5: Verify** — `npx tsc --noEmit`, `npm run lint`, `npm run build` clean across the **entire repo** — this is the last consumer of the old enum, so a clean `tsc` here confirms nothing was missed.

- [ ] **Step 6: Commit.**

### Task 15: Final verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run `npx tsc --noEmit`** across the repo. Expected: 0 errors.

- [ ] **Step 2: Run `npm run lint`.** Expected: 0 errors/warnings introduced by this plan.

- [ ] **Step 3: Run `npm run build`.** Expected: succeeds.

- [ ] **Step 4: Browser walkthrough of every Review Focus item**, confirming each one by hand:
  1. In `/admin/article-categories`, try deleting a category a HOME slider slide references but that has zero articles — confirm it's blocked with the slider-specific reason.
  2. Visit `/articles?category=GR_CIRCULARS` (the old enum-style value) and `/articles?category=does-not-exist` — both show all articles, no crash.
  3. Rename a category's `name` in `/admin/article-categories` without touching its Slug field — confirm the public `/articles?category=<slug>` link for it still works.
  4. Try creating a category with a name that collides with an existing one — confirm a clear inline error, not a crash.
  5. (Already exercised by inspection in Tasks 12–13; re-confirm the empty-state branches read correctly.)

- [ ] **Step 5: Commit** (if Step 1–3 required any fixes) or confirm there's nothing left to commit.
