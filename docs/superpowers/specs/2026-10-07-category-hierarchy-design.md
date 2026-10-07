# Category hierarchy + upload-from-category

Status: approved design, ready for implementation plan.

## Context

Categories are currently a flat list (`id`, `name`, `slug`, `sortOrder`, no parent/child
relation). The client wants unlimited-depth sub-categories, and wants uploading a new
material to happen from inside the category it belongs to — not from a separate
Materials page with a category dropdown. This also adds Word document (`.doc`/`.docx`)
as a new allowed upload type, alongside the existing PDF/PNG/JPEG/WebP.

This is the third of three pieces decomposed from a single larger request earlier in
this session; pieces 1-2 (rebrand to "TalatiSutra", blue theme, employee-only public
shell) are already built and committed. A fourth piece (admin-editable public page
content) was explicitly deferred by the user and is not part of this work.

Decisions settled with the user before this spec was written:
- One category per material (no multi-category tagging) — the existing
  `Material.categoryId` nullable FK shape stays, it just now points into a tree instead
  of a flat list.
- Deleting a category is **blocked** if it has any sub-categories or materials directly
  under it anywhere in that subtree — no cascade, no auto-reparenting.
- A category's page shows only materials assigned **directly** to it, plus its
  sub-categories to navigate into — no recursive rollup of descendants' materials.
- The existing flat `/admin/materials` list (search/edit/delete/replace-file across
  everything) **stays** — only its "New material" upload entry point goes away.
- Both admin and employee hierarchy navigation use **drill-down with breadcrumbs** (one
  level of children shown at a time), not an expandable tree widget.
- DOC/DOCX support is added now, not deferred. `.docx` is a ZIP archive internally, so
  detection needs more than a plain signature match (see §3). DOC files get a
  download-only treatment — no inline browser preview, unlike PDFs.

## 1. Data model

**`Category`** (`prisma/schema.prisma:115-121`) gains a self-referential parent
relation:

```prisma
model Category {
  id        String     @id @default(cuid())
  name      String     @unique
  slug      String     @unique
  sortOrder Int        @default(0)
  parentId  String?
  parent    Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id], onDelete: Restrict)
  children  Category[] @relation("CategoryHierarchy")
  materials Material[]

  @@index([parentId])
}
```

`name` and `slug` stay globally unique (as today) — a name like "Forms" can only exist
once anywhere in the tree, not once per parent. This is a deliberate simplification: it
keeps the existing uniqueness checks in `createCategory`/`updateCategory`
(`app/(app)/admin/categories/actions.ts:27,61`) working unchanged, and avoids any
"which Forms did you mean" ambiguity in search/breadcrumbs.

`onDelete: Restrict` on the parent relation is a **database-level backstop** for the
"block delete with children" rule — the application code (§2) checks and returns a
friendly error before ever attempting the delete, so a real user should never actually
hit the raw FK constraint error; it's there so the rule holds even if application code
has a bug.

No migration is needed for re-parenting/cycle prevention logic: there is no "move a
category" feature in this spec (only create-under-a-chosen-parent, rename, delete), so
a category's parent is set once at creation and never changes — a cycle is structurally
impossible.

**`MaterialKind`** (`prisma/schema.prisma:15-18`) gains a third value:

```prisma
enum MaterialKind {
  PDF
  IMAGE
  DOCUMENT
}
```

## 2. Admin hierarchy UI

`/admin/categories` (rewrite of `app/(app)/admin/categories/page.tsx`) becomes the
**root** view:
- Top-level categories (`parentId: null`) shown as clickable tiles (name + a count of
  direct materials + a count of sub-categories), each linking to
  `/admin/categories/[id]`.
- The existing `NewCategoryForm` stays, unchanged in behavior, but now only ever
  creates a top-level category (no parent field) — matches today's form exactly.
- A new "Uncategorised" section below the tiles: materials with `categoryId: null`,
  shown the same compact way materials are shown on a category page (§ below), with its
  own inline upload form (categoryId omitted/null) so uploading an uncategorised
  material is still possible.

`/admin/categories/[id]` (new route, new page) is a single category's page:
- Breadcrumb trail: fetch every category in one query
  (`prisma.category.findMany({ select: { id: true, name: true, parentId: true } })`
  — cheap at this scale, likely dozens of rows, not thousands), build an
  `id → {name, parentId}` map in memory, then walk `parentId` pointers from the
  current category up to the root to produce the breadcrumb array. One query
  regardless of depth; no materialized path column needed, since categories are never
  re-parented after creation (§1).
- An inline rename form and `DeleteConfirmButton`, reusing the exact pattern already in
  `category-row.tsx` (key on name for remount, same delete-confirmation copy
  convention) — but the delete button is **disabled with an explanatory tooltip**
  (rather than hidden) when this category has children, so the admin understands why
  without guessing. The actual enforcement is server-side regardless (§ Server Actions
  below); the disabled button is a UX nicety, not the security boundary.
- Its direct sub-categories as tiles (same tile component as the root view), plus a
  "+ New sub-category" form (same `NewCategoryForm`, parameterized with this category's
  id as the new category's `parentId`).
- Its direct materials as a compact list (icon + title, linking to the existing
  `/admin/materials/[id]` edit page for full editing — this page does not duplicate
  edit/delete/replace-file functionality, which stays centralized on the Materials
  page).
- An inline upload form (adapted from `new-material-form.tsx`, see §3) with no category
  picker — `categoryId` is fixed to this page's category.

`app/(app)/admin/materials/new/` (page + form) is **deleted** — its upload
functionality moves into the category page's inline form. `app/(app)/admin/materials/
page.tsx:63`'s "New material" link/button is removed; the page's existing list/filter/
search stays exactly as-is otherwise.

### Server Actions (new, in `app/(app)/admin/categories/actions.ts`)

- `createCategory` (existing) gains an optional `parentId` parameter: `createCategory(parentId: string | null, prevState, formData)`, bound via `.bind(null, parentId)` the same way other per-row actions in this codebase already are (e.g. `updateCategory.bind(null, category.id)` in `category-row.tsx:17`). Validation and the create call both pass `parentId` through.
- `deleteCategory` (existing, `actions.ts:84-104`) gains the block-on-children check:
  before deleting, fetch the category with both counts in one query —
  `prisma.category.findUnique({ where: { id }, include: { _count: { select: { children: true, materials: true } } } })`
  (the same `_count` pattern the root page already uses for `materials`, now also
  covering `children`). `DeleteConfirmButton` (`components/admin/delete-confirm-
  button.tsx`) is shared by every destructive admin action in the app (departments,
  employees, materials, categories) and its contract — `action: () => Promise<void>`,
  always ending in a `redirect()` — stays **unchanged** here; widening it to support an
  inline error for this one caller would ripple into all the others for no benefit to
  them. Instead, on the blocked case `deleteCategory` still redirects (keeping the
  dialog-closing behavior `DeleteConfirmButton`'s own doc comment describes), but back
  to `/admin/categories/${id}?error=has-children` instead of to the parent/root; the
  category page reads that query param and renders a plain error banner above the
  delete button ("Delete the N sub-categories and M materials in this category
  first."). On the clean case (`_count.children === 0 && _count.materials === 0`), it
  behaves exactly as today: delete, then `redirect()` to the parent category (or
  `/admin/categories` if this was a top-level category).

## 3. File-type validation (`lib/materials/upload.ts`)

`sniffFileType` gains DOC/DOCX detection, added after the existing WebP check
(`upload.ts:42-48`):

```ts
// Legacy .doc (OLE Compound File Binary Format).
if (
  buffer.length >= 8 &&
  buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0 &&
  buffer[4] === 0xa1 && buffer[5] === 0xb1 && buffer[6] === 0x1a && buffer[7] === 0xe1
) {
  return { mime: "application/msword", ext: "doc", kind: "DOCUMENT" };
}

// .docx is a ZIP archive — the plain ZIP signature (PK\x03\x04) also matches .xlsx,
// .pptx, and generic .zip files, so this additionally checks for a Word-specific
// internal entry name before accepting it as a .docx, rather than trusting the ZIP
// signature alone.
if (
  buffer.length >= 4 &&
  buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04 &&
  buffer.includes(Buffer.from("word/document.xml"))
) {
  return {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: "docx",
    kind: "DOCUMENT",
  };
}
```

`buffer.includes(...)` is a plain byte-sequence search across the whole uploaded
buffer — ZIP entry names are stored close to the start of the central directory and
local file headers, so this reliably finds the entry name without needing a real ZIP
parser; good enough for an admin-only upload path that's already gated by
`requireAdmin()` and a 25 MB size cap.

`SniffedType`'s `kind` type widens from `"PDF" | "IMAGE"` to `"PDF" | "IMAGE" |
"DOCUMENT"`. `declaredMimeMatchesSniffed` needs no change — it already does a generic
string comparison against whatever `sniffed.mime` is.

The upload route handler's error message (`app/api/materials/upload/route.ts:59`,
`"Unrecognised file type. Allowed: PDF, PNG, JPEG, WebP."`) updates to list DOC/DOCX
too. `new-material-form.tsx`'s (and its category-page replacement's) file input
`accept` attribute and label text (`new-material-form.tsx:120-121`) add
`.doc,.docx` / "PDF, PNG, JPEG, WebP, DOC or DOCX".

**CLAUDE.md rule 6** updates from `Allowed: PDF, PNG, JPEG, WebP.` to `Allowed: PDF,
PNG, JPEG, WebP, DOC, DOCX.`

### Preview handling

`app/(app)/portal/materials/[id]/page.tsx:68-74` currently branches
`material.kind === "PDF"` (iframe) vs. else (img). This becomes a three-way branch:
PDF → iframe (unchanged), IMAGE → img (unchanged), DOCUMENT → a plain message ("No
preview available for this file type — use Download to view it.") instead of an
embed, since browsers can't render Word documents inline the way they can PDFs/images.
The existing Download button/link above the preview area already works unchanged for
all three kinds (it just streams the file via `/api/materials/[id]/file`).

Materials-list icons (`portal/materials/page.tsx:83-87`, and any admin equivalent) gain
a third icon (e.g. `FileType` from `lucide-react`, already a dependency) for
`kind === "DOCUMENT"`, alongside the existing `FileText` (PDF) and `ImageIcon` (image)
branches.

## 4. Employee hierarchy UI

`/portal/materials` (rewrite of `app/(app)/portal/materials/page.tsx`) becomes the
**root** browse view:
- Top-level categories (`parentId: null`, scoped the same way `getPortalSummary`
  already scopes category counts — i.e. a category tile's count reflects only
  materials this specific user can see) as tiles, each linking to
  `/portal/materials/category/[id]`.
- The existing search (`q`) and kind (`PDF`/`IMAGE`/now also `DOCUMENT`) filters stay
  at this root level, searching/filtering across **all** visible materials regardless
  of category — this is the "global search stays available" behavior agreed on. The
  category filter dropdown in `MaterialsFilterBar` is removed (superseded by clicking
  into a category tile); kind and search stay.
- An "Uncategorised" section for `categoryId: null` materials this user can see,
  listed the same compact way as a category's materials.

`/portal/materials/category/[id]` (new route) — the static `category` path segment
means this coexists with the existing `/portal/materials/[id]` material-detail route
without ambiguity (Next.js resolves the static segment first). This page:
- Requires `requireUser()` same as every protected page (CLAUDE.md rule 2), and the
  category's own materials/sub-category counts are computed using the same
  `visibleMaterialsWhere(user)` scoping `listVisibleMaterials`/`getPortalSummary`
  already use — an employee must never see a material (or a non-zero count hinting at
  one) they're not allowed to see, even indirectly through a category tile.
- Breadcrumb trail (same parent-walk approach as the admin page).
- Sub-category tiles (only showing categories that have *something visible to this
  user* underneath — see note below).
- This category's direct materials, filtered through `visibleMaterialsWhere`, in the
  same list style as today's flat `portal/materials/page.tsx` list (title, kind icon,
  category name replaced by nothing extra needed here since you're already inside the
  category).

**Visibility note:** an employee drilling through the tree should never see an empty
dead-end that exists only because of other departments' restricted materials. A
category tile only renders if there's something visible to the *current* user
somewhere in its subtree — which genuinely requires checking the whole subtree under
each candidate tile, not just its direct contents, since a sub-category three levels
down might be the only place anything visible actually lives. Computed in two queries,
reused from the same category list fetched for breadcrumbs: (1) all categories
(`id`, `parentId`) already fetched above, and (2) a single grouped count of materials
visible to this user per category —
`prisma.material.groupBy({ by: ["categoryId"], where: { AND: [visibleMaterialsWhere(user), { categoryId: { not: null } }] }, _count: true })`.
With both in memory, a bottom-up pass over the tree (each category's "has-visible-
content" = its own visible count > 0, OR any child's "has-visible-content") computes
every category's visibility in one pass, regardless of depth. This is the same
`visibleMaterialsWhere` scoping `getPortalSummary`'s `categoryCounts` already applies
today (it counts with the same `where` the materials list itself uses, not a raw
unscoped count) — just extended to look past direct materials into descendants. No new
stored field; cheap at this scale (dozens of categories, not thousands).

Portal home (`app/(app)/portal/page.tsx`, via `getPortalSummary`) changes its
`categoryCounts` query (`lib/queries/materials.ts:127-130`) to add `where: { parentId:
null }` to the `prisma.category.findMany` call, so the home page's tiles only ever show
top-level categories (today it lists every category flatly). Tiles link to
`/portal/materials/category/[id]` instead of today's `/portal/materials?category=slug`.

## 5. What's explicitly unchanged

- `app/(app)/admin/materials/page.tsx`'s list, search, filter, and every per-material
  action (edit, delete, replace file) on `/admin/materials/[id]`.
- `app/api/materials/[id]/file/route.ts` (the authenticated file-streaming route) —
  works identically regardless of `kind`.
- The materials-by-category admin dashboard chart (`lib/queries/admin.ts:86`) — it
  already lists every category by name with its own direct material count; with
  hierarchy this still works unchanged (categories are still iterated flatly, each
  still only counting its own direct materials, matching the "direct materials only"
  rule this spec already applies everywhere else).
- `MaterialDepartment`, `Visibility`, upload size cap, magic-byte-over-declared-MIME
  validation, audit logging on every mutation — all untouched.

## Out of scope for this work

- Re-parenting/moving an existing category.
- Multi-category tagging for a single material.
- Bulk move/delete across a subtree.
- Admin UI distinguishing "this category is empty because it's genuinely empty" vs.
  "empty because nothing in it is visible to anyone" — not requested.
- Dynamic/admin-editable public page content (explicitly deferred, tracked separately).

## Testing

This project has no automated test framework (`CLAUDE.md`'s own workflow: `npx tsc
--noEmit`, `npm run lint`, `npm run build`, plus manual verification). Manual pass
after implementation:
- Create a top-level category, a sub-category under it, and a sub-sub-category under
  that (three levels) — confirm breadcrumbs are correct at each level, both admin and
  employee sides.
- Upload a PDF, an image, and a `.docx` from inside a sub-category's inline form —
  confirm each appears only in that category, with the right icon, and the `.docx`
  shows the no-preview message + working Download on its detail page.
- Attempt to delete a category that has a sub-category — confirm it's blocked with a
  clear message, both via the disabled-button tooltip and if forced via the server
  action directly. Delete an empty leaf category — confirm it succeeds.
- As a department-restricted employee, confirm a category/sub-category containing only
  materials restricted to a *different* department doesn't appear as a navigable tile
  at all, while a sibling category with an `ALL`-visibility material does.
- Confirm `/admin/materials` still lists, searches, edits, and deletes materials
  regardless of which category (or depth) they're in, with no "New material" button
  present, and `/admin/materials/new` 404s.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass.
