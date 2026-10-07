# Category Hierarchy + Upload-From-Category Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the flat `Category` list into an unlimited-depth tree with drill-down
navigation, move material upload inline into the category a material belongs to, and
add DOC/DOCX as a new allowed upload type.

**Architecture:** A self-referential `Category.parentId` relation backs two new
drill-down route trees (`/admin/categories/[id]`, `/portal/materials/category/[id]`)
built on a small shared query module (`lib/queries/categories.ts`) that computes
breadcrumbs and (on the employee side) a whole-subtree visibility check in memory from
one cheap "fetch every category" query, since the tree is small (dozens of rows) and
never re-parented after creation. Upload moves from a standalone page into an inline
form embedded on each category page, with no category picker — `categoryId` is fixed
by the page you're on.

**Tech Stack:** Next.js 16.3.6 (App Router), React 19.2.8, TypeScript, Prisma 6.19.3 +
MySQL, Tailwind v4, shadcn/ui on `@base-ui/react`, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-07-category-hierarchy-design.md`

## Global Constraints

- Every protected page/route re-checks the session itself via `requireUser()` /
  `requireAdmin()` — there is no `proxy.ts` auth boundary (CLAUDE.md rule 2).
- Never trust role/department/id from the client — always read from the session row
  (CLAUDE.md rule 3). Admin-only routes check `role === "ADMIN"` in the route itself,
  not just the layout (CLAUDE.md rule 4).
- Mutations use Server Actions, except file upload, which stays a route handler
  (`export const runtime = "nodejs"`) to avoid the Server Action body-size limit.
- Validate every input with Zod at the server boundary (CLAUDE.md working
  conventions) — this does not apply to a value like `parentId`/`id` that is a bound
  function parameter supplied by trusted server code reading its own DB query, not raw
  `FormData`; the existing `updateCategory`/`deleteCategory` actions already treat `id`
  this way.
- Keep database access in `lib/db/` or `lib/queries/` — components don't call Prisma
  directly except server components fetching their own data.
- One shadcn component per import; do not hand-roll a button, dialog, or table shadcn
  already provides. No Tooltip component exists in this project's shadcn registry and
  none is added for this work — disabled-button explanations use the native HTML
  `title` attribute instead (see Task 5).
- Disk filenames are random UUIDs, never a user-supplied name (CLAUDE.md rule 5).
  Uploads are validated by magic bytes, never the declared MIME type alone (CLAUDE.md
  rule 6), max 25 MB.
- `Category.name` and `Category.slug` stay **globally** unique across the whole tree,
  not per-parent — a name like "Forms" can only exist once anywhere.
- Deleting a category is blocked if it has any sub-categories or materials directly
  under it — no cascade, no auto-reparenting. A category's page shows only materials
  assigned **directly** to it — no rollup of descendants' materials.
- No new npm dependencies without asking (none are needed for this plan).
- Before ending any task: `npx tsc --noEmit`, `npm run lint`, and `npm run build` must
  all pass.
- This project has no automated test framework — verification is `tsc`/`lint`/`build`
  plus direct manual/scripted checks (Node scripts against Prisma, curl, and browser
  steps via the claude-in-chrome extension where real interaction needs confirming).

## Review Focus

- **Blocked delete isn't actually blocked:** deleting a category with sub-categories
  or direct materials must fail with a clear message, never silently cascade or
  orphan data. Pinned in Task 6/9.
- **`.docx` false-negatives/positives:** a `.docx` must be accepted, but a plain
  `.zip`, `.xlsx`, or `.pptx` (same outer ZIP signature) must be rejected, since the
  bare `PK\x03\x04` signature alone doesn't distinguish them. Pinned in Task 3.
- **Visibility leaks through the tree:** a department-restricted employee must never
  see a category tile whose *entire subtree* has nothing visible to them, even if a
  sub-category three levels down is the only place anything visible actually lives.
  Pinned in Task 2 (pure logic) and Task 11/13 (end-to-end).
- **Direct-URL probing leaks existence:** an employee navigating straight to a
  category id with nothing visible to them must get the same 404 as a nonexistent id
  — never confirm a category exists to someone who can't see anything in it. Pinned
  in Task 11/13.
- **Upload lands in the wrong category:** uploading from deep inside a 3-level-deep
  sub-category's inline form must set that exact category, not silently fall back to
  "uncategorised" or a wrong ancestor. Pinned in Task 7/9.

---

## Task 1: Schema — category hierarchy + DOCUMENT kind

**Files:**
- Modify: `prisma/schema.prisma:15-18` (MaterialKind enum), `prisma/schema.prisma:115-121` (Category model)
- Create: a new Prisma migration under `prisma/migrations/`

**Interfaces:**
- Produces: `Category.parentId: string | null`, `Category.parent`, `Category.children: Category[]`, `MaterialKind.DOCUMENT` — every later task depends on these existing in the generated Prisma client.

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, change the `MaterialKind` enum:

```prisma
enum MaterialKind {
  PDF
  IMAGE
  DOCUMENT
}
```

And the `Category` model:

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

- [ ] **Step 2: Create and run the migration**

Run: `npx prisma migrate dev --name add_category_hierarchy_and_document_kind`

Expected: Prisma prints a new migration folder name, applies it to the dev database
with no errors, and regenerates `@prisma/client`. If it reports data loss warnings,
stop and report them — there should be none here (both changes are additive: a new
nullable column and a new enum value).

- [ ] **Step 3: Verify the client picked up the new types**

Run: `npx tsc --noEmit`

Expected: no errors. (This alone won't reference the new fields yet, but it confirms
the generated client built cleanly.)

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add category hierarchy (parentId self-relation) and DOCUMENT material kind

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Category tree pure helpers

**Files:**
- Create: `lib/queries/categories.ts`
- Test: a throwaway Node script in the scratchpad directory (no project test framework)

**Interfaces:**
- Consumes: nothing from earlier tasks besides the `Category` type existing (Task 1).
- Produces: `CategoryNode` (`{id, name, slug, parentId}`), `getAllCategoryNodes(): Promise<CategoryNode[]>`, `buildBreadcrumbTrail(nodes: CategoryNode[], categoryId: string): CategoryNode[]`, `computeVisibleSubtreeMap(nodes: CategoryNode[], directVisibleCounts: Map<string, number>): Map<string, boolean>` — Tasks 7 and 11 both build on these.

- [ ] **Step 1: Write the pure helpers**

Create `lib/queries/categories.ts`:

```ts
import { prisma } from "@/lib/db/prisma";

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

/** Every category in the tree, cheap at this scale (dozens of rows, not thousands) —
 * fetched once and used to build breadcrumbs and subtree-visibility in memory rather
 * than walking parent pointers with one query per level. */
export async function getAllCategoryNodes(): Promise<CategoryNode[]> {
  return prisma.category.findMany({
    select: { id: true, name: true, slug: true, parentId: true },
    orderBy: { sortOrder: "asc" },
  });
}

/** Walks `parentId` pointers from `categoryId` up to the root, root-first. Categories
 * are never re-parented after creation, so this can never loop. */
export function buildBreadcrumbTrail(nodes: CategoryNode[], categoryId: string): CategoryNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const trail: CategoryNode[] = [];
  let current = byId.get(categoryId);
  while (current) {
    trail.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return trail;
}

/**
 * For each category, whether anything is visible to the current user anywhere in its
 * subtree — its own direct materials, or recursively any descendant's. `directVisibleCounts`
 * maps categoryId -> count of materials *directly* in that category that this user can
 * see (callers compute this with `visibleMaterialsWhere`, lib/queries/materials.ts).
 * Used to decide whether a category tile should render at all for an employee — a
 * category with zero visible materials and zero non-empty descendants must not appear
 * as a navigable dead end.
 */
export function computeVisibleSubtreeMap(
  nodes: CategoryNode[],
  directVisibleCounts: Map<string, number>,
): Map<string, boolean> {
  const childrenOf = new Map<string, CategoryNode[]>();
  for (const node of nodes) {
    if (node.parentId === null) continue;
    childrenOf.set(node.parentId, [...(childrenOf.get(node.parentId) ?? []), node]);
  }

  const result = new Map<string, boolean>();

  function hasVisible(node: CategoryNode): boolean {
    const cached = result.get(node.id);
    if (cached !== undefined) return cached;
    const ownCount = directVisibleCounts.get(node.id) ?? 0;
    const children = childrenOf.get(node.id) ?? [];
    const visible = ownCount > 0 || children.some(hasVisible);
    result.set(node.id, visible);
    return visible;
  }

  for (const node of nodes) hasVisible(node);
  return result;
}
```

- [ ] **Step 2: Sanity-check the algorithm with a standalone script**

There's no test runner in this project, so verify the tree-walking logic itself (not
the Prisma-dependent parts) with a plain JS script that mirrors the same algorithm
against hand-built sample data. Create
`C:\Users\Darshit\AppData\Local\Temp\claude\D--d-drive-employee-portal\2c805f95-bffa-444d-beb6-6cec55a61d13\scratchpad\check-category-tree.js`:

```js
function buildBreadcrumbTrail(nodes, categoryId) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const trail = [];
  let current = byId.get(categoryId);
  while (current) {
    trail.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return trail;
}

function computeVisibleSubtreeMap(nodes, directVisibleCounts) {
  const childrenOf = new Map();
  for (const node of nodes) {
    if (node.parentId === null) continue;
    childrenOf.set(node.parentId, [...(childrenOf.get(node.parentId) ?? []), node]);
  }
  const result = new Map();
  function hasVisible(node) {
    const cached = result.get(node.id);
    if (cached !== undefined) return cached;
    const ownCount = directVisibleCounts.get(node.id) ?? 0;
    const children = childrenOf.get(node.id) ?? [];
    const visible = ownCount > 0 || children.some(hasVisible);
    result.set(node.id, visible);
    return visible;
  }
  for (const node of nodes) hasVisible(node);
  return result;
}

// A -> B -> C (three levels). Only C has a visible material.
const nodes = [
  { id: "A", name: "A", slug: "a", parentId: null },
  { id: "B", name: "B", slug: "b", parentId: "A" },
  { id: "C", name: "C", slug: "c", parentId: "B" },
  { id: "D", name: "D", slug: "d", parentId: null }, // sibling, nothing visible anywhere
];

function assert(condition, message) {
  if (!condition) {
    throw new Error("ASSERTION FAILED: " + message);
  }
}

const trail = buildBreadcrumbTrail(nodes, "C");
assert(trail.map((n) => n.id).join(",") === "A,B,C", "breadcrumb trail wrong: " + JSON.stringify(trail));

const visible = computeVisibleSubtreeMap(nodes, new Map([["C", 1]]));
assert(visible.get("A") === true, "A should be visible (C is 3 levels down)");
assert(visible.get("B") === true, "B should be visible (C is its child)");
assert(visible.get("C") === true, "C should be visible (direct material)");
assert(visible.get("D") === false, "D should NOT be visible (empty subtree)");

console.log("All category-tree assertions passed.");
```

Run: `node "C:\Users\Darshit\AppData\Local\Temp\claude\D--d-drive-employee-portal\2c805f95-bffa-444d-beb6-6cec55a61d13\scratchpad\check-category-tree.js"`

Expected: `All category-tree assertions passed.` and exit code 0. A failed assertion
throws, so the script exits non-zero with an `ASSERTION FAILED: ...` message instead
— if that happens, the algorithm (not the test) is wrong; fix it before moving on.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/queries/categories.ts
git commit -m "Add category tree helpers: breadcrumb trail + whole-subtree visibility

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: DOC/DOCX magic-byte detection

**Files:**
- Modify: `lib/materials/upload.ts:8-51` (`SniffedType`, `sniffFileType`)
- Modify: `app/api/materials/upload/route.ts:58-61` (error message)
- Modify: `CLAUDE.md:50-51` (rule 6 allowed-types text)

**Interfaces:**
- Consumes: `MaterialKind.DOCUMENT` (Task 1).
- Produces: `SniffedType.kind: "PDF" | "IMAGE" | "DOCUMENT"` — Task 4's icon map and every later upload-form task rely on this union.

- [ ] **Step 1: Widen `SniffedType` and add detection**

In `lib/materials/upload.ts`, change the interface:

```ts
export interface SniffedType {
  mime: string;
  ext: string;
  kind: "PDF" | "IMAGE" | "DOCUMENT";
}
```

Add these two checks inside `sniffFileType`, after the existing WebP check and before
the final `return null;`:

```ts
  // Legacy .doc (OLE Compound File Binary Format signature).
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1
  ) {
    return { mime: "application/msword", ext: "doc", kind: "DOCUMENT" };
  }

  // .docx is a ZIP archive — the bare ZIP signature (PK\x03\x04) also matches .xlsx,
  // .pptx, and a generic .zip, so this additionally requires a Word-specific internal
  // entry name before accepting it as a .docx, rather than trusting the ZIP signature
  // alone.
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04 &&
    buffer.includes(Buffer.from("word/document.xml"))
  ) {
    return {
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ext: "docx",
      kind: "DOCUMENT",
    };
  }
```

- [ ] **Step 2: Update the upload route's error message**

In `app/api/materials/upload/route.ts`, change:

```ts
      { error: "Unrecognised file type. Allowed: PDF, PNG, JPEG, WebP." },
```

to:

```ts
      { error: "Unrecognised file type. Allowed: PDF, PNG, JPEG, WebP, DOC, DOCX." },
```

- [ ] **Step 3: Update CLAUDE.md rule 6**

In `CLAUDE.md`, change:

```
6. **Validate uploads by magic bytes, not just the declared MIME type.** Allowed: PDF,
   PNG, JPEG, WebP. Max 25 MB.
```

to:

```
6. **Validate uploads by magic bytes, not just the declared MIME type.** Allowed: PDF,
   PNG, JPEG, WebP, DOC, DOCX. Max 25 MB.
```

- [ ] **Step 4: Verify detection against real files**

There's no test framework, so exercise this with real sample files. Create a scratch
`.docx` and a plain `.zip` to prove the entry-name check actually discriminates
between them (a bare ZIP signature check would wrongly accept both):

Run (PowerShell, since it has a built-in zip writer):
```powershell
$dir = "$env:TEMP\claude\D--d-drive-employee-portal\category-hierarchy-check"
New-Item -ItemType Directory -Force -Path "$dir\word" | Out-Null
Set-Content -Path "$dir\word\document.xml" -Value "<root/>"
Set-Content -Path "$dir\plain.txt" -Value "just a zip, not a docx"
Compress-Archive -Path "$dir\word" -DestinationPath "$dir\fake.docx.zip" -Force
Compress-Archive -Path "$dir\plain.txt" -DestinationPath "$dir\plain.zip" -Force
Rename-Item "$dir\fake.docx.zip" "fake.docx" -Force
```

A plain `node` script can't `import` the project's `.ts` source directly, so this
script inlines the same two byte checks from Step 1 (kept identical on purpose) and
runs them against the two generated files — confirming the *algorithm* discriminates
correctly, the same way Task 2 verified its algorithm standalone. Write it to
`C:\Users\Darshit\AppData\Local\Temp\claude\D--d-drive-employee-portal\2c805f95-bffa-444d-beb6-6cec55a61d13\scratchpad\check-docx-sniff.mjs`:

```js
import { readFileSync } from "node:fs";

function sniff(buffer) {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 && buffer[5] === 0xb1 && buffer[6] === 0x1a && buffer[7] === 0xe1
  ) {
    return "doc";
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04 &&
    buffer.includes(Buffer.from("word/document.xml"))
  ) {
    return "docx";
  }
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return "zip-but-not-docx";
  }
  return null;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error("ASSERTION FAILED: " + message);
  }
}

const dir = process.env.TEMP + "\\claude\\D--d-drive-employee-portal\\category-hierarchy-check";
const docx = readFileSync(dir + "\\fake.docx");
const zip = readFileSync(dir + "\\plain.zip");

assert(sniff(docx) === "docx", "fake.docx should sniff as docx");
assert(sniff(zip) === "zip-but-not-docx", "plain.zip must NOT sniff as docx");
console.log("DOC/DOCX discrimination check passed.");
```

Run: `node check-docx-sniff.mjs` (from the scratchpad directory)

Expected: `DOC/DOCX discrimination check passed.` and exit code 0. A failed
assertion throws instead of printing that line — if that happens, the detection
logic in Step 1 is wrong; fix it before moving on.

- [ ] **Step 5: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all three pass clean.

- [ ] **Step 6: Commit**

```bash
git add lib/materials/upload.ts app/api/materials/upload/route.ts CLAUDE.md
git commit -m "Add DOC/DOCX magic-byte detection to the upload pipeline

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: DOCUMENT kind everywhere — icons, preview, filters

**Files:**
- Create: `lib/materials/kind-icon.ts`
- Modify: `app/(app)/portal/materials/[id]/page.tsx:68-74` (preview branch)
- Modify: `app/(app)/portal/materials/page.tsx:3,83-87` (icon)
- Modify: `app/(app)/portal/page.tsx:3,64-68` (icon)
- Modify: `app/(app)/admin/materials/page.tsx:43` (kind filter parsing)
- Modify: `lib/queries/materials.ts:26` (`MaterialListFilters.kind`)
- Modify: `lib/queries/admin.ts:95` (`AdminMaterialListFilters.kind`)
- Modify: `app/(app)/portal/materials/page.tsx:44` (kind filter parsing — same file as above)

**Interfaces:**
- Consumes: `MaterialKind` from Task 1, `SniffedType.kind` union from Task 3.
- Produces: `MATERIAL_KIND_ICON: Record<MaterialKind, ComponentType>` — Task 7 and 11's `MaterialRow` component both import this.

- [ ] **Step 1: Create the shared icon map**

Create `lib/materials/kind-icon.ts`:

```ts
import { FileText, Image as ImageIcon, FileType } from "lucide-react";
import type { MaterialKind } from "@prisma/client";

export const MATERIAL_KIND_ICON = {
  PDF: FileText,
  IMAGE: ImageIcon,
  DOCUMENT: FileType,
} as const satisfies Record<MaterialKind, typeof FileText>;
```

- [ ] **Step 2: Three-way preview branch on the material detail page**

In `app/(app)/portal/materials/[id]/page.tsx`, replace the preview block:

```tsx
      <div className="overflow-hidden rounded-lg border">
        {material.kind === "PDF" ? (
          <iframe src={fileUrl} title={material.title} className="h-[80vh] w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- served through our own auth-checked route, not a static asset next/image can optimize
          <img src={fileUrl} alt={material.title} className="mx-auto max-h-[80vh] w-full object-contain" />
        )}
      </div>
```

with:

```tsx
      <div className="overflow-hidden rounded-lg border">
        {material.kind === "PDF" ? (
          <iframe src={fileUrl} title={material.title} className="h-[80vh] w-full" />
        ) : material.kind === "IMAGE" ? (
          // eslint-disable-next-line @next/next/no-img-element -- served through our own auth-checked route, not a static asset next/image can optimize
          <img src={fileUrl} alt={material.title} className="mx-auto max-h-[80vh] w-full object-contain" />
        ) : (
          <div className="flex h-48 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            No preview available for this file type — use Download above to view it.
          </div>
        )}
      </div>
```

- [ ] **Step 3: Use the shared icon map in the three material-row ternaries**

In `app/(app)/portal/materials/page.tsx`, replace the import:

```ts
import { FileText, Image as ImageIcon } from "lucide-react";
```

with:

```ts
import { MATERIAL_KIND_ICON } from "@/lib/materials/kind-icon";
```

And replace the icon ternary:

```tsx
              {material.kind === "PDF" ? (
                <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : (
                <ImageIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
```

with:

```tsx
              {(() => {
                const Icon = MATERIAL_KIND_ICON[material.kind];
                return <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />;
              })()}
```

Do the exact same two edits (import + ternary) in `app/(app)/portal/page.tsx` for its
`recent.map(...)` block.

- [ ] **Step 4: Widen the `kind` filter types**

In `lib/queries/materials.ts`, change:

```ts
export interface MaterialListFilters {
  categoryId?: string;
  kind?: "PDF" | "IMAGE";
  search?: string;
  page?: number;
}
```

to:

```ts
export interface MaterialListFilters {
  categoryId?: string;
  kind?: "PDF" | "IMAGE" | "DOCUMENT";
  search?: string;
  page?: number;
}
```

In `lib/queries/admin.ts`, make the identical change to `AdminMaterialListFilters.kind`.

- [ ] **Step 5: Widen the page-level kind parsing**

In `app/(app)/admin/materials/page.tsx`, change:

```ts
  const kind = params.kind === "PDF" || params.kind === "IMAGE" ? params.kind : undefined;
```

to:

```ts
  const kind =
    params.kind === "PDF" || params.kind === "IMAGE" || params.kind === "DOCUMENT"
      ? params.kind
      : undefined;
```

Make the identical change to the same line in `app/(app)/portal/materials/page.tsx`
(Task 12 will rewrite this file's surrounding structure, but land the correct 3-way
check now so this task is independently complete).

- [ ] **Step 6: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all three pass clean.

- [ ] **Step 7: Manual check — upload a .docx and view its detail page**

This needs a real admin session, so use the existing `/admin/materials/new` upload
flow (not yet removed — that happens in Task 10) to upload the `fake.docx` created in
Task 3 Step 4, with any category. Then open its detail page
(`/admin/materials/[id]` doesn't preview; use the portal detail page as the same
admin user: `/portal/materials/[id]`) and confirm: the icon in any list view is the
`FileType` icon (not the PDF/image ones), and the detail page shows "No preview
available for this file type — use Download above to view it." instead of an iframe
or broken image. Confirm Download still works (streams the file).

- [ ] **Step 8: Commit**

```bash
git add lib/materials/kind-icon.ts "app/(app)/portal/materials/[id]/page.tsx" "app/(app)/portal/materials/page.tsx" "app/(app)/portal/page.tsx" "app/(app)/admin/materials/page.tsx" lib/queries/materials.ts lib/queries/admin.ts
git commit -m "Treat DOCUMENT as a first-class material kind: icon, preview, filters

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `DeleteConfirmButton` — optional disabled state

**Files:**
- Modify: `components/admin/delete-confirm-button.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `DeleteConfirmButton` gains optional `disabled?: boolean` and
  `disabledReason?: string` props. Every existing call site (departments, employees,
  materials) is unaffected since both are optional and default to the current
  behavior. Task 9 is the only consumer of the new props.

This is a shared component used by every destructive admin action in the app — the
change must be strictly additive so none of the other call sites change behavior.
There's no Tooltip component in this project's shadcn registry (confirmed: only
`alert-dialog`, `badge`, `button`, `card`, `checkbox`, `dialog`, `dropdown-menu`,
`input`, `label`, `select`, `separator`, `skeleton`, `sonner`, `table`, `tabs`,
`textarea` exist under `components/ui/`), and CLAUDE.md says not to add dependencies
without asking — so "explanatory tooltip" is implemented with the native HTML `title`
attribute, not a new component.

- [ ] **Step 1: Add the optional props**

Replace the full contents of `components/admin/delete-confirm-button.tsx`:

```tsx
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

/**
 * Every destructive admin action goes through this (BUILD-PLAN §9): names the thing
 * being deleted, requires an explicit confirm. `action` is a Server Action (typically
 * pre-bound to the row's id via `.bind(null, id)`) that should `redirect()` when done
 * — that navigation is what actually closes this dialog, since it unmounts the tree.
 *
 * `disabled` renders a plain disabled button instead of the dialog trigger — used
 * when the caller already knows the delete would fail (e.g. a category with
 * children) and wants to say so up front rather than let the user open the dialog
 * and hit a server-side rejection. `disabledReason` becomes the button's native
 * `title` attribute (a hover tooltip) explaining why.
 */
export function DeleteConfirmButton({
  action,
  title,
  description,
  triggerLabel = "Delete",
  triggerClassName,
  disabled = false,
  disabledReason,
}: {
  action: () => Promise<void>;
  title: string;
  description: string;
  triggerLabel?: string;
  triggerClassName?: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title={disabledReason}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm", className: "text-destructive" }),
          "cursor-not-allowed opacity-50",
          triggerClassName,
        )}
      >
        {triggerLabel}
      </button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm", className: "text-destructive" }),
          triggerClassName,
        )}
      >
        {triggerLabel}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={action}>
            <AlertDialogAction type="submit" variant="destructive" className="w-full">
              {triggerLabel}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all three pass clean.

- [ ] **Step 3: Manual regression check — an existing delete flow still works**

Open `/admin/departments` (or `/admin/employees`) as an admin in the browser via the
claude-in-chrome extension, and confirm a delete button there still opens the
confirm dialog and deletes normally — this component is unchanged for every caller
that doesn't pass the new props, so this should look identical to before the edit.

- [ ] **Step 4: Commit**

```bash
git add components/admin/delete-confirm-button.tsx
git commit -m "Add optional disabled state to DeleteConfirmButton

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Category Server Actions — parentId + blocked delete

**Files:**
- Modify: `app/(app)/admin/categories/actions.ts`

**Interfaces:**
- Consumes: `Category.parentId`, `Category._count.children` (Task 1).
- Produces: `createCategory(parentId: string | null, prevState, formData)` (signature
  change — every caller must now bind a `parentId`), `deleteCategory(id: string): Promise<void>`
  (same signature, new behavior: redirects to `?error=has-children` instead of
  deleting when blocked). Tasks 8 and 9 both call these.

- [ ] **Step 1: Update `createCategory`**

In `app/(app)/admin/categories/actions.ts`, replace the `createCategory` function:

```ts
export async function createCategory(
  parentId: string | null,
  _prevState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const admin = await requireAdmin("/admin/categories");
  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a name." };
  }

  const existing = await prisma.category.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return { error: "A category with this name already exists." };
  }

  const count = await prisma.category.count({ where: { parentId } });
  const category = await prisma.category.create({
    data: { name: parsed.data.name, slug: slugify(parsed.data.name), sortOrder: count, parentId },
  });

  await writeAuditLog({
    actor: admin,
    action: "category.create",
    entity: "Category",
    entityId: category.id,
    meta: { name: category.name, parentId: category.parentId },
    ip: getClientIp(await headers()),
  });

  revalidatePath("/admin/categories");
  if (parentId) revalidatePath(`/admin/categories/${parentId}`);
  return {};
}
```

- [ ] **Step 2: Update `deleteCategory`**

Replace the `deleteCategory` function:

```ts
export async function deleteCategory(id: string): Promise<void> {
  const admin = await requireAdmin("/admin/categories");
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { children: true, materials: true } } },
  });

  if (!category) {
    redirect("/admin/categories");
  }

  if (category._count.children > 0 || category._count.materials > 0) {
    redirect(`/admin/categories/${id}?error=has-children`);
  }

  await prisma.category.delete({ where: { id } });

  await writeAuditLog({
    actor: admin,
    action: "category.delete",
    entity: "Category",
    entityId: id,
    meta: { name: category.name },
    ip: getClientIp(await headers()),
  });

  redirect(category.parentId ? `/admin/categories/${category.parentId}` : "/admin/categories");
}
```

`updateCategory` is unchanged — its existing global-uniqueness check already works
unchanged for a renamed sub-category.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: errors ONLY in files that still call `createCategory` with the old
2-argument signature (`new-category-form.tsx`, fixed in Task 8) — confirm the error
is specifically an arity mismatch on `createCategory`, not something else.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/admin/categories/actions.ts"
git commit -m "Add parentId support and blocked-delete-with-children to category actions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(The `tsc` error from Step 3 is expected to persist until Task 8 lands — that's fine,
these are sequential tasks in the same plan, not independently shippable in
isolation. Do not try to make this one compile standalone.)

---

## Task 7: Admin shared category-page pieces

**Files:**
- Create: `components/category-tile.tsx`
- Create: `components/material-row.tsx`
- Create: `app/(app)/admin/categories/category-upload-form.tsx`
- Modify: `lib/queries/categories.ts` (add admin composed queries)

**Interfaces:**
- Consumes: `MATERIAL_KIND_ICON` (Task 4), `CategoryNode`/`getAllCategoryNodes`/`buildBreadcrumbTrail` (Task 2).
- Produces: `CategoryTile({href, name, materialCount, childCount})`,
  `MaterialRow({href, material: {title, kind}})`,
  `CategoryUploadForm({categoryId, departments})`,
  `getAdminCategoryRoot(): Promise<{topLevel: CategoryTileData[], uncategorised: CategoryMaterialRow[]}>`,
  `getAdminCategoryPage(id): Promise<CategoryPageData | null>` — Tasks 8, 9, 11, 12, 13
  all consume these (the two components are shared across admin and employee UI; the
  two queries are admin-only).

- [ ] **Step 1: `CategoryTile` (shared — admin and employee both use this)**

Create `components/category-tile.tsx`:

```tsx
import Link from "next/link";

export function CategoryTile({
  href,
  name,
  materialCount,
  childCount,
}: {
  href: string;
  name: string;
  materialCount: number;
  childCount: number;
}) {
  return (
    <Link href={href} className="rounded-lg border p-4 transition-colors hover:bg-muted/50">
      <p className="font-medium">{name}</p>
      <p className="text-sm text-muted-foreground">
        {childCount} sub-categor{childCount === 1 ? "y" : "ies"} · {materialCount} material
        {materialCount === 1 ? "" : "s"}
      </p>
    </Link>
  );
}
```

- [ ] **Step 2: `MaterialRow` (shared — admin and employee both use this)**

Create `components/material-row.tsx`:

```tsx
import Link from "next/link";
import type { MaterialKind } from "@prisma/client";
import { MATERIAL_KIND_ICON } from "@/lib/materials/kind-icon";

export function MaterialRow({
  href,
  material,
}: {
  href: string;
  material: { title: string; kind: MaterialKind };
}) {
  const Icon = MATERIAL_KIND_ICON[material.kind];
  return (
    <Link href={href} className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/50">
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate font-medium">{material.title}</span>
    </Link>
  );
}
```

- [ ] **Step 3: `CategoryUploadForm` (admin-only — adapted from `new-material-form.tsx`)**

Create `app/(app)/admin/categories/category-upload-form.tsx`. This is the existing
`new-material-form.tsx` with the category `<Select>` removed (`categoryId` is now a
fixed hidden input), the DOC/DOCX accept added, and `router.refresh()` instead of
`router.push()` on success so the admin stays on the category page and sees the new
material appear in the list below, instead of navigating away:

```tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

// File upload goes through this route handler via fetch, not a Server Action
// (BUILD-PLAN "Working conventions" — Server Actions have a smaller body-size limit).
export function CategoryUploadForm({
  categoryId,
  departments,
}: {
  categoryId: string | null;
  departments: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [restricted, setRestricted] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function toggleDepartment(id: string, checked: boolean) {
    setSelectedDepartments((prev) => (checked ? [...prev, id] : prev.filter((d) => d !== id)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const fileInput = form.querySelector<HTMLInputElement>('input[name="file"]');
    if (!fileInput?.files?.[0]) {
      setError("Choose a file to upload.");
      return;
    }

    const formData = new FormData(form);
    formData.set("visibility", restricted ? "DEPARTMENTS" : "ALL");

    if (restricted && selectedDepartments.length === 0) {
      setError("Pick at least one department, or leave it unrestricted.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/materials/upload", { method: "POST", body: formData });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }

      formRef.current?.reset();
      setRestricted(false);
      setSelectedDepartments([]);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      method="post"
      action="/api/materials/upload"
      encType="multipart/form-data"
      className="max-w-xl space-y-4"
    >
      <input type="hidden" name="categoryId" value={categoryId ?? ""} />

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">File (PDF, PNG, JPEG, WebP, DOC or DOCX — max 25 MB)</Label>
        <Input
          id="file"
          name="file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
          required
        />
      </div>

      <input type="hidden" name="visibility" value={restricted ? "DEPARTMENTS" : "ALL"} />
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="restrict"
            checked={restricted}
            onCheckedChange={(checked) => setRestricted(checked)}
          />
          <Label htmlFor="restrict">Restrict to specific departments</Label>
        </div>

        {restricted ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {departments.map((department) => (
              <div key={department.id} className="flex items-center gap-2">
                <Checkbox
                  id={`dept-${department.id}`}
                  name="departmentIds"
                  value={department.id}
                  checked={selectedDepartments.includes(department.id)}
                  onCheckedChange={(checked) => toggleDepartment(department.id, checked)}
                />
                <Label htmlFor={`dept-${department.id}`}>{department.name}</Label>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Visible to every signed-in user, including self-registered accounts.
          </p>
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Admin composed queries in `lib/queries/categories.ts`**

Add `import type { MaterialKind } from "@prisma/client";` to the top of
`lib/queries/categories.ts`, alongside its existing imports, then append the
following below the Task 2 helpers:

```ts
export interface CategoryTileData {
  id: string;
  name: string;
  slug: string;
  materialCount: number;
  childCount: number;
}

export interface CategoryMaterialRow {
  id: string;
  title: string;
  kind: MaterialKind;
}

export interface CategoryPageData {
  category: { id: string; name: string };
  breadcrumbs: CategoryNode[];
  children: CategoryTileData[];
  materials: CategoryMaterialRow[];
}

/** Admin: every top-level category's direct material + child counts, regardless of
 * visibility — admins see everything. */
export async function getAdminCategoryRoot(): Promise<{
  topLevel: CategoryTileData[];
  uncategorised: CategoryMaterialRow[];
}> {
  const [categories, uncategorised] = await Promise.all([
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { materials: true, children: true } } },
    }),
    prisma.material.findMany({
      where: { categoryId: null },
      select: { id: true, title: true, kind: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    topLevel: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      materialCount: c._count.materials,
      childCount: c._count.children,
    })),
    uncategorised,
  };
}

/** Admin: one category's breadcrumbs, direct sub-categories, and direct materials.
 * Returns null only if the category id doesn't exist. */
export async function getAdminCategoryPage(id: string): Promise<CategoryPageData | null> {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) return null;

  const [nodes, children, materials] = await Promise.all([
    getAllCategoryNodes(),
    prisma.category.findMany({
      where: { parentId: id },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { materials: true, children: true } } },
    }),
    prisma.material.findMany({
      where: { categoryId: id },
      select: { id: true, title: true, kind: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    category: { id: category.id, name: category.name },
    breadcrumbs: buildBreadcrumbTrail(nodes, id),
    children: children.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      materialCount: c._count.materials,
      childCount: c._count.children,
    })),
    materials,
  };
}
```

- [ ] **Step 5: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all three pass clean.

- [ ] **Step 6: Commit**

```bash
git add components/category-tile.tsx components/material-row.tsx "app/(app)/admin/categories/category-upload-form.tsx" lib/queries/categories.ts
git commit -m "Add shared category tile/row components and admin category queries

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Admin `/admin/categories` root page rewrite

**Files:**
- Modify: `app/(app)/admin/categories/new-category-form.tsx`
- Modify: `app/(app)/admin/categories/page.tsx`

**Interfaces:**
- Consumes: `createCategory(parentId, ...)` (Task 6), `getAdminCategoryRoot`,
  `CategoryTile`, `CategoryUploadForm`, `MaterialRow` (Task 7).
- Produces: `NewCategoryForm({parentId}: {parentId: string | null})` — Task 9 also
  renders this (bound to a specific category's id as `parentId`).

- [ ] **Step 1: Add `parentId` to `NewCategoryForm`**

Replace `app/(app)/admin/categories/new-category-form.tsx`:

```tsx
"use client";

import { useActionState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCategory, type CategoryFormState } from "./actions";

const initialState: CategoryFormState = {};

export function NewCategoryForm({ parentId }: { parentId: string | null }) {
  const [state, formAction, pending] = useActionState(createCategory.bind(null, parentId), initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
    }
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="space-y-2">
        <label htmlFor="new-category-name" className="text-sm font-medium">
          {parentId ? "New sub-category" : "New category"}
        </label>
        <Input id="new-category-name" name="name" placeholder="e.g. Announcements" className="w-56" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
```

- [ ] **Step 2: Rewrite the root page**

Replace `app/(app)/admin/categories/page.tsx`:

```tsx
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminCategoryRoot } from "@/lib/queries/categories";
import { prisma } from "@/lib/db/prisma";
import { NewCategoryForm } from "./new-category-form";
import { CategoryUploadForm } from "./category-upload-form";
import { CategoryTile } from "@/components/category-tile";
import { MaterialRow } from "@/components/material-row";

export const metadata: Metadata = {
  title: "Categories",
};

export default async function AdminCategoriesPage() {
  await requireAdmin("/admin/categories");

  const [{ topLevel, uncategorised }, departments] = await Promise.all([
    getAdminCategoryRoot(),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Categories</h1>
        <p className="text-sm text-muted-foreground">
          Click into a category to rename it, add sub-categories, or upload materials
          directly into it.
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <NewCategoryForm parentId={null} />
      </div>

      {topLevel.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No categories yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {topLevel.map((category) => (
            <CategoryTile
              key={category.id}
              href={`/admin/categories/${category.id}`}
              name={category.name}
              materialCount={category.materialCount}
              childCount={category.childCount}
            />
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Uncategorised materials</h2>
        {uncategorised.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every material has a category.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {uncategorised.map((material) => (
              <MaterialRow
                key={material.id}
                href={`/admin/materials/${material.id}`}
                material={material}
              />
            ))}
          </div>
        )}
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">Upload an uncategorised material</h3>
          <CategoryUploadForm categoryId={null} departments={departments} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all three pass clean (the Task 6 arity error is now resolved since
`NewCategoryForm` passes `parentId`).

- [ ] **Step 4: Manual check in the browser**

As an admin, open `/admin/categories`. Confirm: the page shows tiles (not the old
row list), "New category" creates a top-level category and it appears as a new tile,
and the "Uncategorised materials" section lists any materials with no category and
lets you upload one into "no category" successfully (confirm it appears in the list
after upload without a page navigation).

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/admin/categories/new-category-form.tsx" "app/(app)/admin/categories/page.tsx"
git commit -m "Rewrite /admin/categories as the top-level drill-down root

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Admin `/admin/categories/[id]` page (new)

**Files:**
- Create: `app/(app)/admin/categories/category-header-actions.tsx`
- Create: `app/(app)/admin/categories/[id]/page.tsx`
- Delete: `app/(app)/admin/categories/category-row.tsx` (no longer used — the root
  page shows read-only tiles now; rename/delete only happens on this new page)

**Interfaces:**
- Consumes: `updateCategory`, `deleteCategory` (Task 6), `getAdminCategoryPage`,
  `CategoryTile`, `MaterialRow`, `CategoryUploadForm` (Task 7), `NewCategoryForm`
  (Task 8), `DeleteConfirmButton` with `disabled`/`disabledReason` (Task 5).
- Produces: nothing consumed by later tasks (this is the leaf of the admin-side work).

- [ ] **Step 1: Delete the now-unused row component**

Run: `git rm "app/(app)/admin/categories/category-row.tsx"`

- [ ] **Step 2: Create the rename+delete header component**

Create `app/(app)/admin/categories/category-header-actions.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DeleteConfirmButton } from "@/components/admin/delete-confirm-button";
import { updateCategory, deleteCategory, type CategoryFormState } from "./actions";

const initialState: CategoryFormState = {};

export function CategoryHeaderActions({
  category,
  canDelete,
}: {
  category: { id: string; name: string };
  canDelete: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateCategory.bind(null, category.id),
    initialState,
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action={formAction} className="flex flex-1 flex-wrap items-center gap-2">
        {/* Keyed on name so a successful rename remounts this uncontrolled input with
            the new defaultValue, instead of mutating it in place post-revalidation. */}
        <Input key={category.name} name="name" defaultValue={category.name} className="max-w-xs" />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>

      <DeleteConfirmButton
        action={deleteCategory.bind(null, category.id)}
        title={`Delete "${category.name}"?`}
        description="This category has no sub-categories or materials in it."
        disabled={!canDelete}
        disabledReason={
          canDelete ? undefined : "Delete the sub-categories and materials in this category first."
        }
      />
    </div>
  );
}
```

- [ ] **Step 3: Create the `[id]` page**

Create `app/(app)/admin/categories/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminCategoryPage } from "@/lib/queries/categories";
import { prisma } from "@/lib/db/prisma";
import { NewCategoryForm } from "@/app/(app)/admin/categories/new-category-form";
import { CategoryUploadForm } from "@/app/(app)/admin/categories/category-upload-form";
import { CategoryHeaderActions } from "@/app/(app)/admin/categories/category-header-actions";
import { CategoryTile } from "@/components/category-tile";
import { MaterialRow } from "@/components/material-row";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getAdminCategoryPage(id);
  return { title: data?.category.name ?? "Category" };
}

export default async function AdminCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin("/admin/categories");
  const { id } = await params;
  const { error } = await searchParams;

  const [data, departments] = await Promise.all([
    getAdminCategoryPage(id),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!data) {
    notFound();
  }

  const { category, breadcrumbs, children, materials } = data;
  const canDelete = children.length === 0 && materials.length === 0;

  return (
    <div className="space-y-8">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin/categories" className="hover:text-foreground">
          Categories
        </Link>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <span aria-hidden="true">/</span>
            {crumb.id === id ? (
              <span className="text-foreground">{crumb.name}</span>
            ) : (
              <Link href={`/admin/categories/${crumb.id}`} className="hover:text-foreground">
                {crumb.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {error === "has-children" ? (
        <p className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          Delete the sub-categories and materials in this category first.
        </p>
      ) : null}

      <CategoryHeaderActions category={category} canDelete={canDelete} />

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Sub-categories</h2>
        {children.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {children.map((child) => (
              <CategoryTile
                key={child.id}
                href={`/admin/categories/${child.id}`}
                name={child.name}
                materialCount={child.materialCount}
                childCount={child.childCount}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No sub-categories yet.</p>
        )}
        <div className="rounded-lg border p-4">
          <NewCategoryForm parentId={category.id} />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Materials in this category</h2>
        {materials.length === 0 ? (
          <p className="text-sm text-muted-foreground">No materials in this category yet.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {materials.map((material) => (
              <MaterialRow
                key={material.id}
                href={`/admin/materials/${material.id}`}
                material={material}
              />
            ))}
          </div>
        )}
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">Upload a material into this category</h3>
          <CategoryUploadForm categoryId={category.id} departments={departments} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all three pass clean.

- [ ] **Step 5: Manual check — the full hierarchy + blocked delete + upload-into-deep-category**

As an admin, in the browser:
1. From `/admin/categories`, create a top-level category "Policies". Click into it.
2. From inside "Policies", create a sub-category "HR". Click into it.
3. From inside "HR", create a sub-sub-category "2026". Click into it. Confirm the
   breadcrumb reads `Categories / Policies / HR / 2026`.
4. From inside "2026", use the inline upload form to upload a PDF. Confirm it appears
   in "Materials in this category" on the **2026** page specifically — not on
   "Policies" or "HR" (this is Review Focus item 5: upload must land in the exact
   category, not a wrong ancestor or "uncategorised").
5. Go back to "HR" and try to delete it. Confirm the delete button is disabled (with
   a hover tooltip) because it has a sub-category ("2026") — this is Review Focus
   item 1.
6. Go to "2026" and delete its one material via the admin materials page, then come
   back and delete "2026" itself — confirm it now succeeds and redirects to "HR".

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/admin/categories/category-header-actions.tsx" "app/(app)/admin/categories/[id]/page.tsx" "app/(app)/admin/categories/category-row.tsx"
git commit -m "Add /admin/categories/[id] drill-down page with rename, delete-guard, and inline upload

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Remove the standalone material-upload page

**Files:**
- Delete: `app/(app)/admin/materials/new/page.tsx`
- Delete: `app/(app)/admin/materials/new/new-material-form.tsx`
- Modify: `app/(app)/admin/materials/page.tsx:63-65` (remove the "Upload material" link)

**Interfaces:**
- Consumes: nothing (this only removes dead UI now that Tasks 8/9 provide the
  replacement entry points).
- Produces: nothing new.

- [ ] **Step 1: Delete the old upload page and form**

Run: `git rm -r "app/(app)/admin/materials/new"`

- [ ] **Step 2: Remove the "Upload material" link**

In `app/(app)/admin/materials/page.tsx`, remove the `Link` import if it becomes
otherwise unused (it is still used elsewhere in this file for material title links
and pagination, so keep the import) and change:

```tsx
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Materials</h1>
          <p className="text-sm text-muted-foreground">
            {total} item{total === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/admin/materials/new" className={cn(buttonVariants())}>
          Upload material
        </Link>
      </div>
```

to:

```tsx
      <div>
        <h1 className="text-xl font-semibold">Materials</h1>
        <p className="text-sm text-muted-foreground">
          {total} item{total === 1 ? "" : "s"}. Upload new materials from inside a
          category on the{" "}
          <Link href="/admin/categories" className="underline underline-offset-4">
            Categories
          </Link>{" "}
          page.
        </p>
      </div>
```

`buttonVariants` becomes unused in this file after this edit if nothing else in it
calls `buttonVariants()` directly — check the rest of the file (the pagination links
still use `buttonVariants`, at `cn(buttonVariants({ variant: ... }))`), so the import
stays.

- [ ] **Step 3: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all three pass clean.

- [ ] **Step 4: Manual check**

Confirm `/admin/materials/new` now 404s, and `/admin/materials` no longer shows an
"Upload material" button but does show the pointer to `/admin/categories` instead.

- [ ] **Step 5: Commit**

The Step 1 `git rm -r` already staged the deletion.

```bash
git add "app/(app)/admin/materials/page.tsx"
git commit -m "Remove the standalone material-upload page — upload now happens from a category

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Employee composed queries

**Files:**
- Modify: `lib/queries/categories.ts` (add employee composed queries)

**Interfaces:**
- Consumes: `visibleMaterialsWhere` (existing, `lib/queries/materials.ts`),
  `getAllCategoryNodes`, `computeVisibleSubtreeMap` (Task 2), `CategoryTileData`,
  `CategoryMaterialRow`, `CategoryPageData` (Task 7).
- Produces: `getVisibleCategoryRoot(user): Promise<{topLevel, uncategorised}>`,
  `getVisibleCategoryPage(user, id): Promise<CategoryPageData | null>` — Tasks 12 and
  13 consume these.

- [ ] **Step 1: Add the employee composed queries**

Add these two imports to the top of `lib/queries/categories.ts`, alongside its
existing imports:

```ts
import type { SessionUser } from "@/lib/auth/session";
import { visibleMaterialsWhere } from "@/lib/queries/materials";
```

Then append the following below everything already in the file:

```ts
/** Direct-visible material count per category, for the whole tree at once — one
 * grouped query rather than one count query per category. */
async function getDirectVisibleCounts(user: SessionUser): Promise<Map<string, number>> {
  const grouped = await prisma.material.groupBy({
    by: ["categoryId"],
    where: { AND: [visibleMaterialsWhere(user), { categoryId: { not: null } }] },
    _count: true,
  });
  return new Map(grouped.map((g) => [g.categoryId as string, g._count]));
}

/** Employee: top-level categories that have something visible to `user` anywhere in
 * their subtree, plus directly-uncategorised materials visible to them. A category
 * with nothing visible anywhere underneath it is omitted entirely — it must never
 * render as a dead-end tile (see lib/queries/categories.ts's computeVisibleSubtreeMap). */
export async function getVisibleCategoryRoot(user: SessionUser): Promise<{
  topLevel: CategoryTileData[];
  uncategorised: CategoryMaterialRow[];
}> {
  const [nodes, directCounts, uncategorised] = await Promise.all([
    getAllCategoryNodes(),
    getDirectVisibleCounts(user),
    prisma.material.findMany({
      where: { AND: [visibleMaterialsWhere(user), { categoryId: null }] },
      select: { id: true, title: true, kind: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const visibleSubtree = computeVisibleSubtreeMap(nodes, directCounts);
  const childrenOf = new Map<string | null, CategoryNode[]>();
  for (const node of nodes) {
    childrenOf.set(node.parentId, [...(childrenOf.get(node.parentId) ?? []), node]);
  }

  const topLevel = (childrenOf.get(null) ?? [])
    .filter((node) => visibleSubtree.get(node.id))
    .map((node) => ({
      id: node.id,
      name: node.name,
      slug: node.slug,
      materialCount: directCounts.get(node.id) ?? 0,
      childCount: (childrenOf.get(node.id) ?? []).filter((child) => visibleSubtree.get(child.id))
        .length,
    }));

  return { topLevel, uncategorised };
}

/** Employee: one category's breadcrumbs, visible sub-categories, and directly-visible
 * materials. Returns null both when the id doesn't exist AND when nothing in its
 * subtree is visible to `user` — the same 404 either way, so a guesser can't tell
 * "wrong id" from "exists but you can't see anything in it" (BUILD-PLAN §7, same
 * principle as getVisibleMaterialById in lib/queries/materials.ts). */
export async function getVisibleCategoryPage(
  user: SessionUser,
  id: string,
): Promise<CategoryPageData | null> {
  const [nodes, directCounts] = await Promise.all([getAllCategoryNodes(), getDirectVisibleCounts(user)]);
  const visibleSubtree = computeVisibleSubtreeMap(nodes, directCounts);

  if (!visibleSubtree.get(id)) return null;

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const category = byId.get(id);
  if (!category) return null;

  const childrenOf = new Map<string | null, CategoryNode[]>();
  for (const node of nodes) {
    childrenOf.set(node.parentId, [...(childrenOf.get(node.parentId) ?? []), node]);
  }

  const materials = await prisma.material.findMany({
    where: { AND: [visibleMaterialsWhere(user), { categoryId: id }] },
    select: { id: true, title: true, kind: true },
    orderBy: { createdAt: "desc" },
  });

  const children = (childrenOf.get(id) ?? [])
    .filter((node) => visibleSubtree.get(node.id))
    .map((node) => ({
      id: node.id,
      name: node.name,
      slug: node.slug,
      materialCount: directCounts.get(node.id) ?? 0,
      childCount: (childrenOf.get(node.id) ?? []).filter((child) => visibleSubtree.get(child.id))
        .length,
    }));

  return {
    category: { id: category.id, name: category.name },
    breadcrumbs: buildBreadcrumbTrail(nodes, id),
    children,
    materials,
  };
}
```

- [ ] **Step 2: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all three pass clean. (Nothing calls these two new exports yet — that's
Tasks 12/13 — so there should be no "unused" lint warnings since they're exported,
not local.)

- [ ] **Step 3: Scripted check against the real dev database**

Using the "Policies / HR / 2026" hierarchy created in Task 9's manual check (re-create
it if it was cleaned up), verify the whole-subtree visibility logic against real data
with a one-off Node script. Create
`C:\Users\Darshit\AppData\Local\Temp\claude\D--d-drive-employee-portal\2c805f95-bffa-444d-beb6-6cec55a61d13\scratchpad\check-visible-categories.mjs`:

```js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const policies = await prisma.category.findUnique({ where: { name: "Policies" } });
if (!policies) {
  console.error("Run the Task 9 manual-check hierarchy first (Policies/HR/2026).");
  process.exit(1);
}

// Find a department-restricted employee with no visibility into whatever is under
// Policies (adjust the email to a real seeded employee for this project).
const materialsUnderPolicies = await prisma.material.findMany({
  where: {
    category: { OR: [{ id: policies.id }, { parent: { id: policies.id } }, { parent: { parentId: policies.id } }] },
  },
  select: { id: true, title: true, visibility: true, departments: true },
});

console.log("Materials somewhere under Policies:", materialsUnderPolicies);
console.log(
  "Confirm by hand: every material above should be visibility=ALL or restricted to a department the test employee is NOT in, so /portal/materials for that employee should NOT show a 'Policies' tile.",
);

await prisma.$disconnect();
```

Run: `node check-visible-categories.mjs` (from the scratchpad directory, with the
project's `.env` loaded — run it via `npx dotenv -e "D:\d drive\employee_portal\.env" -- node check-visible-categories.mjs` if `DATABASE_URL` isn't already in the shell
environment)

Expected: the script prints the materials under "Policies" and their visibility —
use this to pick (or set up) a test employee account genuinely excluded from all of
them, for the end-to-end browser check in Task 13.

- [ ] **Step 4: Commit**

```bash
git add lib/queries/categories.ts
git commit -m "Add employee-side whole-subtree-visibility category queries

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Employee `/portal/materials` root page rewrite

**Files:**
- Modify: `components/materials-filter-bar.tsx`
- Modify: `app/(app)/portal/materials/page.tsx`

**Interfaces:**
- Consumes: `getVisibleCategoryRoot` (Task 11), `listVisibleMaterials` (existing),
  `CategoryTile`, `MaterialRow` (Task 7).
- Produces: nothing new consumed elsewhere — `MaterialsFilterBar`'s `categories` prop
  becomes optional, which Task 10's admin materials page (still passing `categories`)
  is unaffected by.

The admin materials page (`/admin/materials`, untouched by this feature per spec §5)
also uses `MaterialsFilterBar` and must keep its category dropdown. Making
`categories` optional — shown only when passed — satisfies both: admin keeps passing
it, the portal page stops.

- [ ] **Step 1: Make the category dropdown optional in `MaterialsFilterBar`**

Replace `components/materials-filter-bar.tsx`:

```tsx
"use client";

import type { Category } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function MaterialsFilterBar({
  categories,
  selectedCategorySlug,
  selectedKind,
  search,
}: {
  categories?: Category[];
  selectedCategorySlug?: string;
  selectedKind?: "PDF" | "IMAGE" | "DOCUMENT";
  search?: string;
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-4 rounded-lg border p-4">
      {categories ? (
        <div className="space-y-2">
          <Label htmlFor="category-trigger">Category</Label>
          <Select name="category" defaultValue={selectedCategorySlug ?? ""}>
            <SelectTrigger id="category-trigger" className="w-44">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.slug}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="kind-trigger">Type</Label>
        <Select name="kind" defaultValue={selectedKind ?? ""}>
          <SelectTrigger id="kind-trigger" className="w-36">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All types</SelectItem>
            <SelectItem value="PDF">PDF</SelectItem>
            <SelectItem value="IMAGE">Image</SelectItem>
            <SelectItem value="DOCUMENT">Document</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="q">Search</Label>
        <Input
          id="q"
          name="q"
          defaultValue={search ?? ""}
          placeholder="Title or description"
          className="w-56"
        />
      </div>

      <Button type="submit">Apply</Button>
    </form>
  );
}
```

- [ ] **Step 2: Rewrite the portal materials root page**

Replace `app/(app)/portal/materials/page.tsx`. When neither a kind filter nor a
search term is active, show the category-browsing tiles; the moment either filter is
used, show a flat cross-category result list (this is the "global search stays
available across everything" behavior from the spec):

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listVisibleMaterials } from "@/lib/queries/materials";
import { getVisibleCategoryRoot } from "@/lib/queries/categories";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { MaterialsFilterBar } from "@/components/materials-filter-bar";
import { CategoryTile } from "@/components/category-tile";
import { MaterialRow } from "@/components/material-row";

export const metadata: Metadata = {
  title: "Materials",
};

interface MaterialsSearchParams {
  kind?: string;
  q?: string;
  page?: string;
}

function buildMaterialsUrl(params: MaterialsSearchParams): string {
  const sp = new URLSearchParams();
  if (params.kind) sp.set("kind", params.kind);
  if (params.q) sp.set("q", params.q);
  if (params.page && params.page !== "1") sp.set("page", params.page);
  const qs = sp.toString();
  return qs ? `/portal/materials?${qs}` : "/portal/materials";
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<MaterialsSearchParams>;
}) {
  const user = await requireUser("/portal/materials");
  const params = await searchParams;

  const kind =
    params.kind === "PDF" || params.kind === "IMAGE" || params.kind === "DOCUMENT"
      ? params.kind
      : undefined;
  const requestedPage = params.page ? Number(params.page) : 1;
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const isBrowsing = !kind && !params.q;

  const [{ topLevel, uncategorised }, listResult] = await Promise.all([
    isBrowsing ? getVisibleCategoryRoot(user) : Promise.resolve({ topLevel: [], uncategorised: [] }),
    listVisibleMaterials(user, { kind, search: params.q, page }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Materials</h1>
        <p className="text-sm text-muted-foreground">
          Browse by category, or search across everything.
        </p>
      </div>

      <MaterialsFilterBar selectedKind={kind} search={params.q} />

      {isBrowsing ? (
        <>
          {topLevel.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {topLevel.map((category) => (
                <CategoryTile
                  key={category.id}
                  href={`/portal/materials/category/${category.id}`}
                  name={category.name}
                  materialCount={category.materialCount}
                  childCount={category.childCount}
                />
              ))}
            </div>
          ) : null}

          {uncategorised.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-lg font-medium">Uncategorised</h2>
              <div className="divide-y rounded-lg border">
                {uncategorised.map((material) => (
                  <MaterialRow
                    key={material.id}
                    href={`/portal/materials/${material.id}`}
                    material={material}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {topLevel.length === 0 && uncategorised.length === 0 ? (
            <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
              No materials are available to you yet.
            </div>
          ) : null}
        </>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {listResult.total} result{listResult.total === 1 ? "" : "s"}
          </p>
          {listResult.items.length === 0 ? (
            <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
              No materials match your filters.
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {listResult.items.map((material) => (
                <MaterialRow
                  key={material.id}
                  href={`/portal/materials/${material.id}`}
                  material={material}
                />
              ))}
            </div>
          )}

          {listResult.pageCount > 1 ? (
            <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
              {Array.from({ length: listResult.pageCount }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={buildMaterialsUrl({ ...params, page: String(p) })}
                  aria-current={p === page ? "page" : undefined}
                  className={cn(
                    buttonVariants({ variant: p === page ? "default" : "outline", size: "sm" }),
                  )}
                >
                  {p}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all three pass clean.

- [ ] **Step 4: Manual check**

As an employee, open `/portal/materials`. Confirm top-level category tiles render,
clicking one is not yet wired (Task 13 adds that destination page — expect a 404
until then, which is fine at this point in the plan), and typing something into
Search or picking a Type switches the page to the flat cross-category result list
instead of tiles.

- [ ] **Step 5: Commit**

```bash
git add components/materials-filter-bar.tsx "app/(app)/portal/materials/page.tsx"
git commit -m "Rewrite /portal/materials as a category-browsing root with global search

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: Employee `/portal/materials/category/[id]` page (new)

**Files:**
- Create: `app/(app)/portal/materials/category/[id]/page.tsx`

**Interfaces:**
- Consumes: `getVisibleCategoryPage` (Task 11), `CategoryTile`, `MaterialRow`
  (Task 7).
- Produces: nothing new consumed elsewhere.

The static `category` path segment means this route coexists with the existing
`/portal/materials/[id]` material-detail route without ambiguity — Next.js resolves
the static segment first, so `/portal/materials/category/anything` can never be
captured by the `[id]` material-detail route.

- [ ] **Step 1: Create the page**

Create `app/(app)/portal/materials/category/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getVisibleCategoryPage } from "@/lib/queries/categories";
import { CategoryTile } from "@/components/category-tile";
import { MaterialRow } from "@/components/material-row";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser(`/portal/materials/category/${id}`);
  const data = await getVisibleCategoryPage(user, id);
  return { title: data?.category.name ?? "Category" };
}

export default async function PortalCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/portal/materials/category/${id}`);
  const data = await getVisibleCategoryPage(user, id);

  // Same 404 whether the category doesn't exist or has nothing visible to this user
  // anywhere in its subtree (lib/queries/categories.ts) — never confirm existence to
  // someone who can't see it (BUILD-PLAN §7).
  if (!data) {
    notFound();
  }

  const { category, breadcrumbs, children, materials } = data;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/portal/materials" className="hover:text-foreground">
          Materials
        </Link>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <span aria-hidden="true">/</span>
            {crumb.id === id ? (
              <span className="text-foreground">{crumb.name}</span>
            ) : (
              <Link href={`/portal/materials/category/${crumb.id}`} className="hover:text-foreground">
                {crumb.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <h1 className="text-xl font-semibold">{category.name}</h1>

      {children.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {children.map((child) => (
            <CategoryTile
              key={child.id}
              href={`/portal/materials/category/${child.id}`}
              name={child.name}
              materialCount={child.materialCount}
              childCount={child.childCount}
            />
          ))}
        </div>
      ) : null}

      {materials.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No materials directly in this category.
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {materials.map((material) => (
            <MaterialRow
              key={material.id}
              href={`/portal/materials/${material.id}`}
              material={material}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all three pass clean.

- [ ] **Step 3: Manual check — visibility scoping end-to-end (Review Focus items 3 & 4)**

Using the test employee identified in Task 11 Step 3 (one genuinely excluded from
every material under "Policies"):
1. Log in as that employee, open `/portal/materials`. Confirm **no "Policies" tile
   renders at all** — not grayed out, not present with a "0 items" label, simply
   absent from the grid.
2. Still as that employee, navigate directly to `/portal/materials/category/<the
   Policies category's id>` by typing the URL. Confirm this 404s exactly like a
   made-up id would — it must not reveal that "Policies" exists.
3. Log in as an employee (or admin) who CAN see at least one material under
   "Policies" (set one material's visibility to `ALL`, or restrict it to that
   employee's department, if nothing qualifies yet). Confirm the "Policies" tile now
   renders, clicking through the full "Policies / HR / 2026" chain works with correct
   breadcrumbs, and only the materials actually visible to that user appear at each
   level.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/portal/materials/category/[id]/page.tsx"
git commit -m "Add /portal/materials/category/[id] drill-down page with visibility scoping

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 14: Portal home — top-level-only category tiles

**Files:**
- Modify: `lib/queries/materials.ts:127-130` (`getPortalSummary`'s category query)
- Modify: `app/(app)/portal/page.tsx:29` (tile link href)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed elsewhere (this is the last piece touching the browse
  entry points).

- [ ] **Step 1: Scope `getPortalSummary` to top-level categories**

In `lib/queries/materials.ts`, inside `getPortalSummary`, change:

```ts
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { materials: { where } } } },
    }),
```

to:

```ts
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { materials: { where } } } },
    }),
```

- [ ] **Step 2: Update the portal home tile link**

In `app/(app)/portal/page.tsx`, change:

```tsx
              href={`/portal/materials?category=${category.slug}`}
```

to:

```tsx
              href={`/portal/materials/category/${category.id}`}
```

- [ ] **Step 3: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all three pass clean.

- [ ] **Step 4: Manual check**

Open `/portal` as an employee. Confirm the category tiles shown are only top-level
categories (a sub-category like "HR" from the Task 9 hierarchy must not appear here
even though it has materials), and clicking one navigates to the correct
`/portal/materials/category/[id]` page.

- [ ] **Step 5: Commit**

```bash
git add lib/queries/materials.ts "app/(app)/portal/page.tsx"
git commit -m "Scope portal home's category tiles to top-level categories only

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 15: Whole-feature verification pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Full type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all three pass clean with zero warnings introduced by this feature.

- [ ] **Step 2: Confirm the removed route is gone**

Run (with the dev server running, `npm run dev`): `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/admin/materials/new`

Expected: `404` (after following the admin-session redirect dance — if this returns a
redirect-to-login code instead because the curl has no session cookie, that's fine
too; the point is it's not a live `200` upload page anymore). If in doubt, confirm
visually in the browser as a logged-in admin instead.

- [ ] **Step 3: End-to-end admin flow in the browser**

As an admin: create a 3-level category tree (reuse "Policies / HR / 2026" from
Task 9 if still present, or build a fresh one), upload a PDF, an image, and the
`fake.docx` from Task 3 Step 4 each into a different level of the tree via each
page's inline form, and confirm:
- Each material shows up only in the exact category it was uploaded into.
- `/admin/materials` (the flat list, untouched by this feature) still lists, searches,
  and filters all of them regardless of depth, with working edit/delete/replace-file
  on each, and no "Upload material" button.
- The `.docx` material's detail page (via `/portal/materials/[id]` as the admin user)
  shows the no-preview message and a working Download.

- [ ] **Step 4: End-to-end employee flow in the browser**

As a department-restricted employee with no visibility into part of the tree
(reusing the setup from Task 13 Step 3): confirm the portal home page, the
`/portal/materials` root, and the drill-down pages all consistently hide exactly the
same branches, the global search box at the root finds a visible material by title
regardless of which category it's in, and a direct URL guess at a category with
nothing visible to this employee 404s.

- [ ] **Step 5: Confirm an unrelated admin delete flow still works**

As an admin, delete a test department or employee (create a disposable one first if
none exists purely for this check) via its existing `DeleteConfirmButton` flow, to
confirm Task 5's change to that shared component didn't regress anything outside
categories.

- [ ] **Step 6: Final commit (if any cleanup was needed)**

If Steps 1-5 required any fixes, commit them now with a message describing what was
fixed. If everything passed with no changes needed, there is nothing to commit here
— the feature's commits already landed task-by-task.
