# Dynamic, Admin-Editable Site Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four hardcoded marketing pages (Home, About, Services, Contact)
with a block-based content system the admin can edit directly, and seed it with real
TalatiSutra marketing copy instead of the current lorem-ipsum placeholders.

**Architecture:** A single `ContentBlock` table holds an ordered list of typed, JSON-backed
blocks per page (`HERO`, `TEXT`, `CARD_GRID`, `CTA_BAND`). Public pages become async Server
Components that fetch their page's blocks and hand them to a `BlockRenderer` dispatcher. A
parallel `/api/site-images/*` route pair (public GET, admin-only POST) serves/accepts
marketing images outside the auth-gated materials system, since these are meant to be
public. A new `/admin/content` section edits blocks through Server Actions, reusing the
existing `CategoryFormDialog`/`DeleteConfirmButton` patterns.

**Tech Stack:** Next.js 16.3.6 (App Router), React 19.2.8, TypeScript, Prisma 6.19.3 +
MySQL, Zod 4, Tailwind v4, shadcn/ui on `@base-ui/react`, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-08-dynamic-site-content-design.md`

## Global Constraints

- Every protected page/route re-checks the session itself via `requireAdmin()` — there is
  no `proxy.ts` auth boundary (CLAUDE.md rule 2/4). `GET /api/site-images/[filename]` is the
  one deliberate exception (public by design, per spec §2) — it still validates the
  filename pattern before any filesystem access.
- Mutations use Server Actions, except file upload, which stays a route handler
  (`export const runtime = "nodejs"`) to avoid the Server Action body-size limit.
- Validate every input with Zod at the server boundary (CLAUDE.md working conventions).
  A block's `data` is validated as one JSON blob against a Zod discriminated union keyed
  by `type` — never a rigid per-field FormData parse.
- Keep database access in `lib/db/` or `lib/queries/` — components don't call Prisma
  directly except server components fetching their own data.
- One shadcn component per import; do not hand-roll a button, dialog, select, or badge
  shadcn already provides (`alert-dialog`, `badge`, `button`, `card`, `checkbox`,
  `dialog`, `dropdown-menu`, `input`, `label`, `select`, `separator`, `skeleton`, `sonner`,
  `table`, `tabs`, `textarea` all exist under `components/ui/`).
- Disk filenames are random UUIDs, never a user-supplied name (CLAUDE.md rule 5). Site
  images are validated by magic bytes via the existing `sniffFileType()` /
  `declaredMimeMatchesSniffed()` in `lib/materials/upload.ts` (CLAUDE.md rule 6), max 5 MB
  (smaller than materials' 25 MB), image kinds only.
- `GET /api/site-images/[filename]` validates `filename` against
  `^[0-9a-f-]+\.(png|jpe?g|webp)$` before any path construction — the sole defense against
  path traversal, no DB lookup needed (per spec §2).
- No new npm dependencies without asking (none are needed for this plan — Zod 4 already
  supports `z.discriminatedUnion`).
- Before ending any task: `npx tsc --noEmit`, `npm run lint`, and `npm run build` must all
  pass.
- This project has no automated test framework — verification is `tsc`/`lint`/`build` plus
  direct manual/scripted checks (standalone Node scripts for pure logic, curl/fetch for
  routes, browser steps via the claude-in-chrome extension where real interaction needs
  confirming).
- The raw SQL seed (Task 1) must not contain any apostrophe/contraction in the seeded copy
  (write "do not" not "don't", "we will" not "we'll") — a literal `'` inside a single-quoted
  SQL string literal breaks the migration unless doubled, and doubling it correctly inside
  hand-edited JSON-inside-SQL is an easy mistake to make silently. Avoiding contractions
  entirely removes the risk rather than relying on correct escaping.

## Review Focus

- **Path traversal via a crafted `filename`:** a request for
  `/api/site-images/..%2f..%2f..%2fetc%2fpasswd` or any value outside the regex must 404,
  never read outside `STORAGE_DIR/site-images/`. Pinned in Task 4.
- **Orphaned images accumulate on disk:** replacing a Hero/Card image, or deleting a block
  that referenced one, must unlink the old file — otherwise every edit leaks disk space
  silently with no admin-visible symptom. Pinned in Task 7.
- **A block's `data` shape can drift from its `type`:** saving a `HERO` block with a
  `CARD_GRID`-shaped payload (or a `CARD_GRID` card missing a `title`) must be rejected by
  the discriminated union, never stored as malformed JSON that then crashes the public
  render path. Pinned in Task 2 and Task 7.
- **Reorder at the boundary:** clicking Move up on the first block or Move down on the last
  must no-op safely (the UI disables the buttons, but the Server Action itself must not
  throw or corrupt sibling `sortOrder` values if invoked anyway). Pinned in Task 7.
- **The contact page's form must survive the rewrite untouched:** replacing the hardcoded
  heading/subtext with a fetched `TEXT` block must not touch `ContactForm` or
  `submitContactForm` — a regression here would break a real, functional feature for a
  cosmetic one. Pinned in Task 6.

---

## Task 1: Schema, migration, and real seed content

**Files:**
- Modify: `prisma/schema.prisma` (add `SitePage`, `ContentBlockType` enums, `ContentBlock`
  model, `User.updatedContentBlocks` back-relation)
- Create: a new Prisma migration under `prisma/migrations/`, hand-edited before applying

**Interfaces:**
- Produces: `SitePage` (`HOME | ABOUT | SERVICES | CONTACT`), `ContentBlockType`
  (`HERO | TEXT | CARD_GRID | CTA_BAND`), the `ContentBlock` Prisma model
  (`id, page, type, sortOrder, data: Json, updatedAt, updatedById`) — every later task
  depends on these existing in the generated Prisma client, and on 8 real seeded rows
  existing in the dev database.

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, add after the existing `Visibility` enum:

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
```

Add the model (anywhere after `Category`, e.g. directly below it):

```prisma
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

Add the back-relation to `User`, alongside its existing `uploads` field:

```prisma
  updatedContentBlocks ContentBlock[] @relation("ContentBlockUpdatedBy")
```

- [ ] **Step 2: Generate the migration without applying it**

Run: `npx prisma migrate dev --create-only --name add_site_content_blocks`

Expected: Prisma prints a new migration folder under `prisma/migrations/`, writes a
`migration.sql` containing `CREATE TABLE ContentBlock (...)` plus the `ALTER TABLE User`
adding the (unused until referenced) FK column — and does **not** apply it yet, since
`--create-only` was passed.

- [ ] **Step 3: Hand-append the seed INSERTs to the generated `migration.sql`**

Open the generated `migration.sql` and append the following at the end, exactly as
written (table/column names must match what Prisma generated in Step 2 — confirm
`ContentBlock` and its column names before pasting; adjust casing only if Prisma's output
differs):

```sql
INSERT INTO `ContentBlock` (`id`, `page`, `type`, `sortOrder`, `data`, `updatedAt`) VALUES
('content-home-hero', 'HOME', 'HERO', 0, '{"heading":"TalatiSutra","subtext":"We help organisations manage records, documentation and day-to-day administrative work with accuracy, discretion and care.","buttons":[{"label":"Get in touch","href":"/contact"},{"label":"Our services","href":"/services"}],"imageKey":null}', CURRENT_TIMESTAMP(3)),
('content-home-cardgrid', 'HOME', 'CARD_GRID', 1, '{"heading":null,"subtext":null,"cards":[{"title":"Accurate record-keeping","body":"Every document is organised, categorised and tracked, so nothing important ever gets lost in the shuffle.","imageKey":null},{"title":"Dependable turnaround","body":"We treat deadlines as commitments, not suggestions, so your paperwork moves as fast as it needs to.","imageKey":null},{"title":"Confidential by default","body":"Sensitive material stays restricted to the people who need it, and nobody else.","imageKey":null}]}', CURRENT_TIMESTAMP(3)),
('content-home-ctaband', 'HOME', 'CTA_BAND', 2, '{"heading":"Ready to work with us?","subtext":"Reach out and we will get back to you as soon as we can.","button":{"label":"Contact us","href":"/contact"}}', CURRENT_TIMESTAMP(3)),
('content-about-text', 'ABOUT', 'TEXT', 0, '{"heading":"About us","body":"TalatiSutra was founded to bring order and accountability to the paperwork every organisation depends on but few enjoy dealing with. We work behind the scenes so the people we support can focus on their own work instead of tracking down the right document.\\n\\nOur team manages records, materials and correspondence across departments, keeping everything organised, current and accessible to exactly the people who are meant to see it.\\n\\nWhatever the task is, filing, documentation, or day-to-day administrative support, we aim to do it quietly, correctly, and on time."}', CURRENT_TIMESTAMP(3)),
('content-about-cardgrid', 'ABOUT', 'CARD_GRID', 1, '{"heading":"Our values","subtext":null,"cards":[{"title":"Integrity","body":"We handle other people\\u2019s records the way we would want our own handled, carefully, and without cutting corners.","imageKey":null},{"title":"Quality","body":"Work goes out right the first time. We check it before anyone else has to.","imageKey":null},{"title":"Reliability","body":"If we say it will be ready, it will be ready.","imageKey":null}]}', CURRENT_TIMESTAMP(3)),
('content-services-text', 'SERVICES', 'TEXT', 0, '{"heading":"Our services","body":"We provide a range of administrative, documentation and records-management services, built around accuracy, confidentiality and dependable turnaround."}', CURRENT_TIMESTAMP(3)),
('content-services-cardgrid', 'SERVICES', 'CARD_GRID', 1, '{"heading":null,"subtext":null,"cards":[{"title":"Document management","body":"Organising, categorising and maintaining records so the right file is always easy to find.","imageKey":null},{"title":"Administrative support","body":"Day-to-day paperwork, correspondence and office administration handled reliably and on schedule.","imageKey":null},{"title":"Records compliance","body":"Keeping documentation current, accurate and ready for review whenever it is needed.","imageKey":null},{"title":"Confidential handling","body":"Department-level access controls keep sensitive materials visible only to the people who should see them.","imageKey":null}]}', CURRENT_TIMESTAMP(3)),
('content-contact-text', 'CONTACT', 'TEXT', 0, '{"heading":"Contact us","body":"Have a question or need something handled? Send us a message and we will get back to you."}', CURRENT_TIMESTAMP(3));
```

Note: `updatedById` is omitted from the column list so it defaults to `NULL` — these rows
were never edited by an admin. The `\\u2019` escape in the "values" card is a literal
right-single-quotation-mark Unicode escape *inside the JSON string*, not an apostrophe
character — this sidesteps the SQL single-quote-escaping risk entirely while still
rendering as a typographic apostrophe in "we would want our own". Keep every other seeded
sentence contraction-free per the Global Constraints note.

- [ ] **Step 4: Apply the migration**

Run: `npx prisma migrate dev`

Expected: Prisma detects the already-created migration folder, applies it (running your
hand-edited `migration.sql` verbatim, including the appended INSERTs) to the dev database,
and regenerates `@prisma/client`. If the dev server is running, kill it and restart after
this step (a long-running `next dev` process keeps the pre-migration Prisma Client cached
in memory — this bit twice earlier in this project).

- [ ] **Step 5: Verify the seed landed**

Run a throwaway Node script (plain `.mjs`, since the project has no test runner) in your
scratchpad directory that imports nothing project-specific — just connects with a fresh
`PrismaClient` and asserts counts:

```js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const counts = await prisma.contentBlock.groupBy({ by: ["page"], _count: true });
const byPage = Object.fromEntries(counts.map((c) => [c.page, c._count]));
if (byPage.HOME !== 3) throw new Error("Expected 3 HOME blocks, got " + byPage.HOME);
if (byPage.ABOUT !== 2) throw new Error("Expected 2 ABOUT blocks, got " + byPage.ABOUT);
if (byPage.SERVICES !== 2) throw new Error("Expected 2 SERVICES blocks, got " + byPage.SERVICES);
if (byPage.CONTACT !== 1) throw new Error("Expected 1 CONTACT block, got " + byPage.CONTACT);
console.log("Seed row counts correct:", byPage);
await prisma.$disconnect();
```

Run it from the project root with `node your-script.mjs` (it needs `@prisma/client`
resolvable, so run it from inside the project directory even though the file itself lives
in your scratchpad). Expected: `Seed row counts correct: { HOME: 3, ABOUT: 2, SERVICES: 2,
CONTACT: 1 }` and exit code 0.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add ContentBlock model and seed real TalatiSutra marketing copy

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Content types, Zod schemas, and pure helpers

**Files:**
- Create: `lib/validation/content.ts`

**Interfaces:**
- Consumes: `ContentBlockType` (Task 1, as a TS type only — no DB access in this file).
- Produces: `heroBlockDataSchema`, `textBlockDataSchema`, `cardGridBlockDataSchema`,
  `ctaBandBlockDataSchema`, `contentBlockInputSchema` (the discriminated union),
  `HeroBlockData`, `TextBlockData`, `CardGridBlockData`, `CtaBandBlockData`,
  `ContentBlockInput` (all `z.infer` types), `extractImageKeys(block: ContentBlockInput):
  string[]`, `getBlockPreviewText(type: ContentBlockType, data: unknown): string`,
  `BLOCK_TYPE_LABEL: Record<ContentBlockType, string>` — Tasks 3, 5, 7, 8, and 9 all import
  from this file.

- [ ] **Step 1: Write the schemas and types**

Create `lib/validation/content.ts`:

```ts
import { z } from "zod";
import type { ContentBlockType } from "@prisma/client";

const buttonSchema = z.object({
  label: z.string().trim().min(1, "Button label is required.").max(60),
  href: z.string().trim().min(1, "Button link is required.").max(500),
});

export const heroBlockDataSchema = z.object({
  heading: z.string().trim().min(1, "Heading is required.").max(200),
  subtext: z.string().trim().max(1000),
  buttons: z.array(buttonSchema).max(4),
  imageKey: z.string().nullable(),
});
export type HeroBlockData = z.infer<typeof heroBlockDataSchema>;

export const textBlockDataSchema = z.object({
  heading: z.string().trim().max(200).nullable(),
  body: z.string().trim().min(1, "Body text is required.").max(5000),
});
export type TextBlockData = z.infer<typeof textBlockDataSchema>;

const cardSchema = z.object({
  title: z.string().trim().min(1, "Card title is required.").max(120),
  body: z.string().trim().min(1, "Card body is required.").max(1000),
  imageKey: z.string().nullable(),
});

export const cardGridBlockDataSchema = z.object({
  heading: z.string().trim().max(200).nullable(),
  subtext: z.string().trim().max(1000).nullable(),
  cards: z.array(cardSchema).min(1, "Add at least one card.").max(12),
});
export type CardGridBlockData = z.infer<typeof cardGridBlockDataSchema>;

export const ctaBandBlockDataSchema = z.object({
  heading: z.string().trim().min(1, "Heading is required.").max(200),
  subtext: z.string().trim().max(1000),
  button: buttonSchema,
});
export type CtaBandBlockData = z.infer<typeof ctaBandBlockDataSchema>;

export const contentBlockInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("HERO"), data: heroBlockDataSchema }),
  z.object({ type: z.literal("TEXT"), data: textBlockDataSchema }),
  z.object({ type: z.literal("CARD_GRID"), data: cardGridBlockDataSchema }),
  z.object({ type: z.literal("CTA_BAND"), data: ctaBandBlockDataSchema }),
]);
export type ContentBlockInput = z.infer<typeof contentBlockInputSchema>;

export const BLOCK_TYPE_LABEL: Record<ContentBlockType, string> = {
  HERO: "Hero",
  TEXT: "Text",
  CARD_GRID: "Card grid",
  CTA_BAND: "CTA band",
};

/** Every image key a block's data references, for orphan-cleanup diffing (Task 7) —
 * HERO has at most one, CARD_GRID has one per card, TEXT/CTA_BAND have none. */
export function extractImageKeys(block: ContentBlockInput): string[] {
  switch (block.type) {
    case "HERO":
      return block.data.imageKey ? [block.data.imageKey] : [];
    case "CARD_GRID":
      return block.data.cards
        .map((card) => card.imageKey)
        .filter((key): key is string => key !== null);
    case "TEXT":
    case "CTA_BAND":
      return [];
  }
}

/** A short one-line preview for an admin list row (spec §4): the block's heading, or the
 * first line of its body for a TEXT block with no heading. `data` arrives as `unknown`
 * because callers read it straight off a Prisma `Json` column — this never throws on a
 * shape mismatch, it just falls back to the type label, since it's display-only. */
export function getBlockPreviewText(type: ContentBlockType, data: unknown): string {
  const parsed = contentBlockInputSchema.safeParse({ type, data });
  if (!parsed.success) return BLOCK_TYPE_LABEL[type];

  switch (parsed.data.type) {
    case "HERO":
      return parsed.data.data.heading;
    case "CTA_BAND":
      return parsed.data.data.heading;
    case "CARD_GRID":
      return parsed.data.data.heading ?? `${parsed.data.data.cards.length} card(s)`;
    case "TEXT":
      return parsed.data.data.heading ?? parsed.data.data.body.split("\n")[0];
  }
}
```

- [ ] **Step 2: Sanity-check `extractImageKeys` and `getBlockPreviewText` with a standalone script**

There's no test runner, so verify this pure logic with a plain script mirroring the same
functions against hand-built sample data. Write it to your scratchpad directory as
`check-content-helpers.mjs` — since it can't `import` the project's `.ts` source directly,
inline copies of both functions (kept identical to Step 1 on purpose):

```js
function extractImageKeys(block) {
  if (block.type === "HERO") return block.data.imageKey ? [block.data.imageKey] : [];
  if (block.type === "CARD_GRID")
    return block.data.cards.map((c) => c.imageKey).filter((k) => k !== null);
  return [];
}

function assert(condition, message) {
  if (!condition) throw new Error("ASSERTION FAILED: " + message);
}

const hero = { type: "HERO", data: { imageKey: "abc.png" } };
assert(JSON.stringify(extractImageKeys(hero)) === '["abc.png"]', "hero with image");

const heroNoImage = { type: "HERO", data: { imageKey: null } };
assert(JSON.stringify(extractImageKeys(heroNoImage)) === "[]", "hero without image");

const cardGrid = {
  type: "CARD_GRID",
  data: { cards: [{ imageKey: "a.png" }, { imageKey: null }, { imageKey: "b.png" }] },
};
assert(JSON.stringify(extractImageKeys(cardGrid)) === '["a.png","b.png"]', "card grid mixed images");

const text = { type: "TEXT", data: {} };
assert(JSON.stringify(extractImageKeys(text)) === "[]", "text has no images");

console.log("All content-helper assertions passed.");
```

Run: `node check-content-helpers.mjs` (from wherever you wrote it)

Expected: `All content-helper assertions passed.` and exit code 0.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/validation/content.ts
git commit -m "Add Zod discriminated-union schemas and pure helpers for content blocks

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Content queries and page metadata

**Files:**
- Create: `lib/queries/content.ts`

**Interfaces:**
- Consumes: `prisma` (`lib/db/prisma.ts`), `SitePage`/`ContentBlock` (Task 1).
- Produces: `getPageBlocks(page: SitePage): Promise<ContentBlock[]>`,
  `SITE_PAGE_PATH: Record<SitePage, string>`, `SITE_PAGE_LABEL: Record<SitePage, string>`,
  `parseSitePageSegment(segment: string): SitePage | null` — Tasks 6, 7, and 9 all import
  from this file.

- [ ] **Step 1: Write the module**

Create `lib/queries/content.ts`:

```ts
import { prisma } from "@/lib/db/prisma";
import { SitePage, type ContentBlock } from "@prisma/client";

/** No visibility scoping of any kind — this is public content, not department-restricted
 * materials (spec §3). */
export async function getPageBlocks(page: SitePage): Promise<ContentBlock[]> {
  return prisma.contentBlock.findMany({
    where: { page },
    orderBy: { sortOrder: "asc" },
  });
}

export const SITE_PAGE_PATH: Record<SitePage, string> = {
  HOME: "/",
  ABOUT: "/about",
  SERVICES: "/services",
  CONTACT: "/contact",
};

export const SITE_PAGE_LABEL: Record<SitePage, string> = {
  HOME: "Home",
  ABOUT: "About",
  SERVICES: "Services",
  CONTACT: "Contact",
};

/** Admin URL segments are the lowercase enum value (e.g. "/admin/content/home"). Returns
 * null for anything that doesn't match exactly one of the four pages. */
export function parseSitePageSegment(segment: string): SitePage | null {
  const upper = segment.toUpperCase();
  return upper in SitePage ? (upper as SitePage) : null;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Verify `getPageBlocks` against the Task 1 seed**

Write a scratchpad script `check-page-blocks.mjs` that imports `PrismaClient` directly
(same approach as Task 1 Step 5 — this file can't import the project's path-aliased `.ts`
source, so it re-queries with a raw Prisma call rather than importing `getPageBlocks`
itself):

```js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const blocks = await prisma.contentBlock.findMany({
  where: { page: "HOME" },
  orderBy: { sortOrder: "asc" },
});
if (blocks.length !== 3) throw new Error("Expected 3 HOME blocks, got " + blocks.length);
if (blocks[0].type !== "HERO") throw new Error("Expected first HOME block to be HERO");
if (blocks[0].sortOrder !== 0) throw new Error("Expected first block sortOrder 0");
console.log("getPageBlocks query shape verified.");
await prisma.$disconnect();
```

Run: `node check-page-blocks.mjs` (from the project root)

Expected: `getPageBlocks query shape verified.` and exit code 0.

- [ ] **Step 4: Commit**

```bash
git add lib/queries/content.ts
git commit -m "Add getPageBlocks query and SitePage path/label/segment helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Site-images storage, public serving, and admin upload

**Files:**
- Create: `lib/site-images/storage.ts`
- Create: `app/api/site-images/[filename]/route.ts`
- Create: `app/api/site-images/upload/route.ts`

**Interfaces:**
- Consumes: `sniffFileType`, `declaredMimeMatchesSniffed` (`lib/materials/upload.ts`,
  existing), `env.STORAGE_DIR` (`lib/env.ts`, existing), `requireAdmin` (existing).
- Produces: `SITE_IMAGE_FILENAME_PATTERN: RegExp`, `MAX_SITE_IMAGE_BYTES: number`,
  `siteImageFilePath(key: string): string`, `writeSiteImage(buffer: Buffer, ext: string):
  Promise<string>`, `deleteSiteImage(key: string): Promise<void>` — Task 7 consumes
  `deleteSiteImage` for orphan cleanup; Task 8 consumes the upload route's HTTP contract
  (`POST` multipart `file` -> `{ key: string }` on 201, `{ error: string }` on 4xx).

- [ ] **Step 1: Storage helpers**

Create `lib/site-images/storage.ts`:

```ts
import { randomUUID } from "node:crypto";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

export const MAX_SITE_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB — smaller than materials' 25 MB

// Exactly the shape writeSiteImage produces: a random UUID plus a sniffed extension.
// The public GET route rejects anything that doesn't match this before touching the
// filesystem (spec §2) — the sole defense against path traversal for this route.
export const SITE_IMAGE_FILENAME_PATTERN = /^[0-9a-f-]+\.(png|jpe?g|webp)$/;

export function siteImageFilePath(key: string): string {
  return path.join(env.STORAGE_DIR, "site-images", key);
}

/** Mirrors lib/materials/upload.ts's writeUploadedFile — random UUID filename
 * (CLAUDE.md rule 5), never the browser-supplied name. */
export async function writeSiteImage(buffer: Buffer, ext: string): Promise<string> {
  const key = `${randomUUID()}.${ext}`;
  const dir = path.join(env.STORAGE_DIR, "site-images");
  await mkdir(dir, { recursive: true });
  await writeFile(siteImageFilePath(key), buffer);
  return key;
}

/** A missing file is not an error — same reasoning as deleteUploadedFile in
 * lib/materials/upload.ts (used both for real deletes and to clean up after a failed
 * write). */
export async function deleteSiteImage(key: string): Promise<void> {
  try {
    await unlink(siteImageFilePath(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to delete site image:", error);
    }
  }
}
```

- [ ] **Step 2: Public serving route**

Create `app/api/site-images/[filename]/route.ts`:

```ts
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { SITE_IMAGE_FILENAME_PATTERN, siteImageFilePath } from "@/lib/site-images/storage";

export const runtime = "nodejs";

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

// No auth check — these are public marketing assets by design (spec §2). The filename
// regex is the only defense and must run before any path construction.
export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  if (!SITE_IMAGE_FILENAME_PATTERN.test(filename)) {
    return new Response(null, { status: 404 });
  }

  const filePath = siteImageFilePath(filename);
  let stats;
  try {
    stats = await stat(filePath);
  } catch {
    return new Response(null, { status: 404 });
  }

  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  const nodeStream = createReadStream(filePath);

  return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": EXT_TO_MIME[ext] ?? "application/octet-stream",
      "Content-Length": String(stats.size),
      // Non-sensitive, and each upload gets a brand-new random filename (replacing an
      // image never reuses the old key), so caching this aggressively is safe.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
```

- [ ] **Step 3: Admin upload route**

Create `app/api/site-images/upload/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { sniffFileType, declaredMimeMatchesSniffed } from "@/lib/materials/upload";
import { MAX_SITE_IMAGE_BYTES, writeSiteImage } from "@/lib/site-images/storage";

// Multipart upload goes through a route handler, not a Server Action, same reason
// materials upload does (avoids the Server Action body-size limit).
export const runtime = "nodejs";

export async function POST(request: Request) {
  await requireAdmin();

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }

  if (file.size > MAX_SITE_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large. Maximum size is 5 MB." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffFileType(buffer);

  if (!sniffed || sniffed.kind !== "IMAGE") {
    return NextResponse.json({ error: "Unrecognised image type. Allowed: PNG, JPEG, WebP." }, { status: 400 });
  }
  if (!declaredMimeMatchesSniffed(file.type, sniffed)) {
    return NextResponse.json({ error: "The file's contents don't match its declared type." }, { status: 400 });
  }

  const key = await writeSiteImage(buffer, sniffed.ext);
  return NextResponse.json({ key }, { status: 201 });
}
```

- [ ] **Step 4: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all three pass clean.

- [ ] **Step 5: Manual verification — path traversal and a real upload**

This needs the dev server running and a real admin session cookie (curl can't easily
carry a browser session; use the claude-in-chrome extension, or curl with a manually
copied session cookie if one is already available in this session's context).

Path traversal check (no auth needed, since this route is public by design):
```bash
curl -i "http://localhost:3000/api/site-images/..%2f..%2f..%2fetc%2fpasswd"
curl -i "http://localhost:3000/api/site-images/not-a-valid-name.txt"
```
Expected: both return `404` with an empty body — confirm neither leaks file contents or a
500.

Real upload + fetch round-trip (as admin, via the browser or a session-cookie curl call):
upload any small PNG/JPEG to `/api/site-images/upload`, confirm the response is `201` with
a `{ "key": "<uuid>.<ext>" }` body, then `curl -i http://localhost:3000/api/site-images/<key>`
with no auth header at all and confirm it returns `200` with the image bytes and the
`Cache-Control: public, max-age=31536000, immutable` header.

- [ ] **Step 6: Commit**

```bash
git add lib/site-images/storage.ts "app/api/site-images"
git commit -m "Add public site-image serving and admin upload routes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: BlockRenderer and the four presentational block components

**Files:**
- Create: `components/content/block-renderer.tsx`
- Create: `components/content/hero-block.tsx`
- Create: `components/content/text-block.tsx`
- Create: `components/content/card-grid-block.tsx`
- Create: `components/content/cta-band-block.tsx`

**Interfaces:**
- Consumes: `ContentBlock` (Task 1, Prisma type), `HeroBlockData`/`TextBlockData`/
  `CardGridBlockData`/`CtaBandBlockData` (Task 2).
- Produces: `BlockRenderer({ blocks }: { blocks: ContentBlock[] })` — Task 6 consumes this.

These replace *where the content comes from*, not how it looks — match the Tailwind
classes the current hardcoded `app/(marketing)/page.tsx` / `about/page.tsx` /
`services/page.tsx` already use for each corresponding section (no visual redesign, per
spec §3).

- [ ] **Step 1: `HeroBlock`**

Create `components/content/hero-block.tsx`:

```tsx
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { HeroBlockData } from "@/lib/validation/content";

export function HeroBlock({ data }: { data: HeroBlockData }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{data.heading}</h1>
      <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">{data.subtext}</p>
      {data.buttons.length > 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {data.buttons.map((button, i) => (
            <Link
              key={button.href + i}
              href={button.href}
              className={buttonVariants(i === 0 ? { size: "lg" } : { variant: "outline", size: "lg" })}
            >
              {button.label}
            </Link>
          ))}
        </div>
      ) : null}
      {data.imageKey ? (
        // eslint-disable-next-line @next/next/no-img-element -- public marketing asset served through our own route, not a static asset next/image can optimize
        <img
          src={`/api/site-images/${data.imageKey}`}
          alt=""
          className="mx-auto mt-10 max-h-96 w-full max-w-3xl object-contain"
        />
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: `TextBlock`**

Create `components/content/text-block.tsx`. Paragraph breaks are literal blank lines in
the stored `body` string (per spec §1) — split on `\n\n` and render each as its own `<p>`:

```tsx
import type { TextBlockData } from "@/lib/validation/content";

export function TextBlock({ data }: { data: TextBlockData }) {
  const paragraphs = data.body.split("\n\n").filter((p) => p.trim().length > 0);
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      {data.heading ? <h1 className="text-3xl font-semibold tracking-tight">{data.heading}</h1> : null}
      <div className={data.heading ? "mt-6 space-y-4 text-muted-foreground" : "space-y-4 text-muted-foreground"}>
        {paragraphs.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: `CardGridBlock`**

Create `components/content/card-grid-block.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CardGridBlockData } from "@/lib/validation/content";

export function CardGridBlock({ data }: { data: CardGridBlockData }) {
  return (
    <section className="border-t bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-16">
        {data.heading ? <h2 className="text-2xl font-semibold">{data.heading}</h2> : null}
        {data.subtext ? <p className="mt-2 max-w-2xl text-muted-foreground">{data.subtext}</p> : null}
        <div className="mt-6 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {data.cards.map((card, i) => (
            <Card key={card.title + i}>
              {card.imageKey ? (
                // eslint-disable-next-line @next/next/no-img-element -- public marketing asset served through our own route, not a static asset next/image can optimize
                <img src={`/api/site-images/${card.imageKey}`} alt="" className="h-40 w-full object-cover" />
              ) : null}
              <CardHeader>
                <CardTitle className="text-lg">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{card.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: `CtaBandBlock`**

Create `components/content/cta-band-block.tsx`:

```tsx
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { CtaBandBlockData } from "@/lib/validation/content";

export function CtaBandBlock({ data }: { data: CtaBandBlockData }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 text-center">
      <h2 className="text-2xl font-semibold">{data.heading}</h2>
      <p className="mx-auto mt-2 max-w-xl text-muted-foreground">{data.subtext}</p>
      <Link href={data.button.href} className={buttonVariants({ className: "mt-6" })}>
        {data.button.label}
      </Link>
    </section>
  );
}
```

- [ ] **Step 5: `BlockRenderer`**

Create `components/content/block-renderer.tsx`. `data` on a Prisma `ContentBlock` is typed
`Json` (effectively `unknown` to TypeScript), so each branch casts it to that block type's
shape — this is the one place per spec §3 that trusts the stored shape without
re-validating, since it's only ever written by the validated admin editor (Task 7):

```tsx
import type { ContentBlock } from "@prisma/client";
import { HeroBlock } from "./hero-block";
import { TextBlock } from "./text-block";
import { CardGridBlock } from "./card-grid-block";
import { CtaBandBlock } from "./cta-band-block";
import type {
  HeroBlockData,
  TextBlockData,
  CardGridBlockData,
  CtaBandBlockData,
} from "@/lib/validation/content";

export function BlockRenderer({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <>
      {blocks.map((block) => {
        switch (block.type) {
          case "HERO":
            return <HeroBlock key={block.id} data={block.data as HeroBlockData} />;
          case "TEXT":
            return <TextBlock key={block.id} data={block.data as TextBlockData} />;
          case "CARD_GRID":
            return <CardGridBlock key={block.id} data={block.data as CardGridBlockData} />;
          case "CTA_BAND":
            return <CtaBandBlock key={block.id} data={block.data as CtaBandBlockData} />;
          default:
            return null;
        }
      })}
    </>
  );
}
```

- [ ] **Step 6: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all three pass clean.

- [ ] **Step 7: Commit**

```bash
git add components/content
git commit -m "Add BlockRenderer and the four presentational content-block components

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Wire the four public pages to block-based rendering

**Files:**
- Modify: `app/(marketing)/page.tsx`
- Modify: `app/(marketing)/about/page.tsx`
- Modify: `app/(marketing)/services/page.tsx`
- Modify: `app/(marketing)/contact/page.tsx`

**Interfaces:**
- Consumes: `getPageBlocks` (Task 3), `BlockRenderer` (Task 5).
- Produces: nothing consumed by later tasks (this is the leaf of the public-rendering work).

- [ ] **Step 1: Home page**

Replace the full contents of `app/(marketing)/page.tsx`:

```tsx
import { getPageBlocks } from "@/lib/queries/content";
import { BlockRenderer } from "@/components/content/block-renderer";

export default async function HomePage() {
  const blocks = await getPageBlocks("HOME");
  return <BlockRenderer blocks={blocks} />;
}
```

- [ ] **Step 2: About and Services pages**

Replace the body of `app/(marketing)/about/page.tsx` (keep the existing `metadata` export
unchanged):

```tsx
export default async function AboutPage() {
  const blocks = await getPageBlocks("ABOUT");
  return <BlockRenderer blocks={blocks} />;
}
```

(with the same two imports added as Step 1). Do the identical change to
`app/(marketing)/services/page.tsx`, fetching `getPageBlocks("SERVICES")`, keeping its
existing `metadata` export and removing the now-unused `SERVICES` array and `Card`
imports.

- [ ] **Step 3: Contact page — block above the form, form untouched**

Replace the body of `app/(marketing)/contact/page.tsx` (keep its `metadata` export and the
`ContactForm` import exactly as they are):

```tsx
export default async function ContactPage() {
  const blocks = await getPageBlocks("CONTACT");
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <BlockRenderer blocks={blocks} />
      <div className="mt-10">
        <ContactForm />
      </div>
    </div>
  );
}
```

Note the seeded `CONTACT` `TEXT` block's own wrapper (`components/content/text-block.tsx`)
already applies `mx-auto max-w-3xl px-4 py-16` — rendering it a second time inside this
page's own identically-classed wrapper double-applies that padding. Remove the outer
`<div className="mx-auto max-w-3xl px-4 py-16">` wrapper here and instead wrap only the
form:

```tsx
export default async function ContactPage() {
  const blocks = await getPageBlocks("CONTACT");
  return (
    <>
      <BlockRenderer blocks={blocks} />
      <div className="mx-auto max-w-3xl px-4 pb-16">
        <ContactForm />
      </div>
    </>
  );
}
```

- [ ] **Step 4: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all three pass clean.

- [ ] **Step 5: Manual verification in the browser**

Open `/`, `/about`, `/services`, `/contact` with the dev server running (ask before
starting it if it isn't already running — it was previously stopped by the harness due to
low memory and should not be restarted unprompted). Confirm: each page renders the real
TalatiSutra copy from Task 1's seed, in the same visual layout the old hardcoded pages
had. On `/contact`, confirm the heading/subtext render from the block and the contact form
below it still submits successfully (fill it out and submit, or at minimum confirm no
console errors on render and the form's fields are all present and interactive).

- [ ] **Step 6: Commit**

```bash
git add "app/(marketing)/page.tsx" "app/(marketing)/about/page.tsx" "app/(marketing)/services/page.tsx" "app/(marketing)/contact/page.tsx"
git commit -m "Wire the four public marketing pages to block-based rendering

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Admin Server Actions — create, update, delete, reorder

**Files:**
- Create: `app/(app)/admin/content/actions.ts`

**Interfaces:**
- Consumes: `contentBlockInputSchema`, `extractImageKeys` (Task 2), `getPageBlocks`,
  `SITE_PAGE_PATH` (Task 3), `deleteSiteImage` (Task 4), `requireAdmin`, `writeAuditLog`,
  `getClientIp` (all existing).
- Produces: `ContentBlockFormState` (`{ error?: string }`), `createContentBlock(page:
  SitePage, _prevState: ContentBlockFormState, formData: FormData): Promise<ContentBlockFormState>`,
  `updateContentBlock(id: string, _prevState: ContentBlockFormState, formData: FormData):
  Promise<ContentBlockFormState>`, `deleteContentBlock(id: string): Promise<void>`,
  `moveContentBlock(id: string, direction: "up" | "down"): Promise<void>` — Tasks 8 and 9
  both call these.

Every mutation parses a `data` field off `FormData` as a single JSON string (built
client-side from React state in Task 8's dialog, not as individually-named FormData
fields) — this keeps the per-block-type field complexity entirely in the client component
and reduces every Server Action here to "parse JSON, validate against the discriminated
union, write it."

- [ ] **Step 1: Shared parsing helper and `createContentBlock`**

Create `app/(app)/admin/content/actions.ts`:

```ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/auth/ip";
import { deleteSiteImage } from "@/lib/site-images/storage";
import {
  contentBlockInputSchema,
  extractImageKeys,
  type ContentBlockInput,
} from "@/lib/validation/content";
import { SITE_PAGE_PATH } from "@/lib/queries/content";
import type { SitePage } from "@prisma/client";

export interface ContentBlockFormState {
  error?: string;
}

function parseBlockInput(formData: FormData): { ok: true; value: ContentBlockInput } | { ok: false; error: string } {
  let dataJson: unknown;
  try {
    dataJson = JSON.parse(String(formData.get("data") ?? ""));
  } catch {
    return { ok: false, error: "Invalid form data." };
  }

  const parsed = contentBlockInputSchema.safeParse({ type: formData.get("type"), data: dataJson });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  return { ok: true, value: parsed.data };
}

function revalidateBlockPage(page: SitePage) {
  revalidatePath(`/admin/content/${page.toLowerCase()}`);
  revalidatePath(SITE_PAGE_PATH[page]);
}

export async function createContentBlock(
  page: SitePage,
  _prevState: ContentBlockFormState,
  formData: FormData,
): Promise<ContentBlockFormState> {
  const admin = await requireAdmin("/admin/content");
  const parsed = parseBlockInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const count = await prisma.contentBlock.count({ where: { page } });
  const block = await prisma.contentBlock.create({
    data: {
      page,
      type: parsed.value.type,
      sortOrder: count,
      data: parsed.value.data,
      updatedById: admin.id,
    },
  });

  await writeAuditLog({
    actor: admin,
    action: "content.block.create",
    entity: "ContentBlock",
    entityId: block.id,
    meta: { page, type: block.type },
    ip: getClientIp(await headers()),
  });

  revalidateBlockPage(page);
  return {};
}
```

- [ ] **Step 2: `updateContentBlock` with orphaned-image cleanup**

Append to the same file:

```ts
export async function updateContentBlock(
  id: string,
  _prevState: ContentBlockFormState,
  formData: FormData,
): Promise<ContentBlockFormState> {
  const admin = await requireAdmin("/admin/content");
  const existing = await prisma.contentBlock.findUnique({ where: { id } });
  if (!existing) {
    return { error: "This block no longer exists." };
  }

  const parsed = parseBlockInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  // A block's type is fixed at creation (spec: "no convert this block's type").
  if (parsed.value.type !== existing.type) {
    return { error: "A block's type can't be changed after creation." };
  }

  const oldKeys = extractImageKeys({ type: existing.type, data: existing.data } as ContentBlockInput);
  const newKeys = extractImageKeys(parsed.value);
  const orphaned = oldKeys.filter((key) => !newKeys.includes(key));

  await prisma.contentBlock.update({
    where: { id },
    data: { data: parsed.value.data, updatedById: admin.id },
  });

  await Promise.all(orphaned.map((key) => deleteSiteImage(key)));

  await writeAuditLog({
    actor: admin,
    action: "content.block.update",
    entity: "ContentBlock",
    entityId: id,
    meta: { page: existing.page, type: existing.type },
    ip: getClientIp(await headers()),
  });

  revalidateBlockPage(existing.page);
  return {};
}
```

- [ ] **Step 3: `deleteContentBlock`**

Append:

```ts
export async function deleteContentBlock(id: string): Promise<void> {
  const admin = await requireAdmin("/admin/content");
  const existing = await prisma.contentBlock.findUnique({ where: { id } });
  if (!existing) {
    redirect("/admin/content");
  }

  const keys = extractImageKeys({ type: existing.type, data: existing.data } as ContentBlockInput);

  await prisma.contentBlock.delete({ where: { id } });
  await Promise.all(keys.map((key) => deleteSiteImage(key)));

  await writeAuditLog({
    actor: admin,
    action: "content.block.delete",
    entity: "ContentBlock",
    entityId: id,
    meta: { page: existing.page, type: existing.type },
    ip: getClientIp(await headers()),
  });

  revalidateBlockPage(existing.page);
  redirect(`/admin/content/${existing.page.toLowerCase()}`);
}
```

- [ ] **Step 4: `moveContentBlock`**

Append:

```ts
export async function moveContentBlock(id: string, direction: "up" | "down"): Promise<void> {
  const admin = await requireAdmin("/admin/content");
  const existing = await prisma.contentBlock.findUnique({ where: { id } });
  if (!existing) {
    redirect("/admin/content");
  }

  const siblings = await prisma.contentBlock.findMany({
    where: { page: existing.page },
    orderBy: { sortOrder: "asc" },
  });
  const index = siblings.findIndex((s) => s.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;

  // Out-of-range swaps (already first/last) are a no-op, not an error — the UI disables
  // these buttons at the boundary, but the action itself must stay safe if invoked anyway.
  if (swapIndex >= 0 && swapIndex < siblings.length) {
    const other = siblings[swapIndex];
    await prisma.$transaction([
      prisma.contentBlock.update({ where: { id: existing.id }, data: { sortOrder: other.sortOrder } }),
      prisma.contentBlock.update({ where: { id: other.id }, data: { sortOrder: existing.sortOrder } }),
    ]);

    // Every other mutation in this file writes an audit entry (lib/audit.ts: "every other
    // admin mutation ... calls it too rather than waiting for a dedicated pass") — reorder
    // is still a mutation of this row, so it gets one too, even though it's a no-op when
    // already at the boundary (handled above, before this log would ever fire).
    await writeAuditLog({
      actor: admin,
      action: "content.block.reorder",
      entity: "ContentBlock",
      entityId: existing.id,
      meta: { page: existing.page, direction },
      ip: getClientIp(await headers()),
    });

    revalidateBlockPage(existing.page);
  }

  redirect(`/admin/content/${existing.page.toLowerCase()}`);
}
```

- [ ] **Step 5: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all three pass clean.

- [ ] **Step 6: Manual verification — orphan cleanup and boundary reorder**

This needs a real admin session and the dev server running (ask before starting it — see
Task 6 Step 5's note). As admin: upload an image to a Hero block's `imageKey` (you can set
this directly via a scratch Prisma script before Task 8/9 exist, or wait and do this check
again after Task 9 lands the real UI — note in your progress ledger which you did), confirm
the file exists under `STORAGE_DIR/site-images/`, then update that block to a different
image (or clear it) and confirm the old file is gone from disk afterward. Separately, call
`moveContentBlock` on the first block of a page with `direction: "up"` (via a scratch
script invoking the action directly, or the real UI once Task 9 lands) and confirm it
doesn't throw and sibling `sortOrder` values are unchanged.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/admin/content/actions.ts"
git commit -m "Add content block Server Actions: create, update, delete, reorder

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `ContentBlockFormDialog` — the admin per-type editor

**Files:**
- Create: `app/(app)/admin/content/content-block-form-dialog.tsx`
- Create: `app/(app)/admin/content/block-type-fields.tsx`
- Create: `app/(app)/admin/content/site-image-upload-field.tsx`

**Interfaces:**
- Consumes: `createContentBlock`, `updateContentBlock`, `ContentBlockFormState` (Task 7),
  `BLOCK_TYPE_LABEL`, `HeroBlockData`/`TextBlockData`/`CardGridBlockData`/`CtaBandBlockData`
  (Task 2), the `/api/site-images/upload` HTTP contract (Task 4).
- Produces: `ContentBlockFormDialog` (props below) — Task 9 renders this for both "+ Add
  block" and each row's "Edit".

```ts
type Props =
  | { mode: "create"; page: SitePage }
  | { mode: "edit"; id: string; type: ContentBlockType; data: HeroBlockData | TextBlockData | CardGridBlockData | CtaBandBlockData };
```

- [ ] **Step 1: `SiteImageUploadField`**

Create `app/(app)/admin/content/site-image-upload-field.tsx` — a controlled field that
uploads immediately on file selection and reports the resulting key up to its parent
(mirrors the fetch-based upload pattern already used by
`app/(app)/admin/categories/category-upload-form.tsx`, scoped down to a single image):

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SiteImageUploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/site-images/upload", { method: "POST", body: formData });
      const body = (await res.json().catch(() => ({}))) as { key?: string; error?: string };
      if (!res.ok || !body.key) {
        setError(body.error ?? "Upload failed. Try again.");
        return;
      }
      onChange(body.key);
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a public marketing asset, not a static asset next/image can optimize */}
          <img src={`/api/site-images/${value}`} alt="" className="h-16 w-16 rounded-md border object-cover" />
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(null)}>
            Remove
          </Button>
        </div>
      ) : null}
      <Input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={handleFile} disabled={pending} />
      {pending ? <p className="text-sm text-muted-foreground">Uploading…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 2: Per-type field components**

Create `app/(app)/admin/content/block-type-fields.tsx`. Each is a controlled component
lifting its block-data object to the parent dialog, with its own "add row" / "remove row"
controls for the repeatable arrays (same add/remove-per-row UX already built for the
materials upload form's department checkboxes — not a new interaction pattern, just a
different field shape):

```tsx
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { SiteImageUploadField } from "./site-image-upload-field";
import type {
  HeroBlockData,
  TextBlockData,
  CardGridBlockData,
  CtaBandBlockData,
} from "@/lib/validation/content";

export function HeroFields({ value, onChange }: { value: HeroBlockData; onChange: (v: HeroBlockData) => void }) {
  function updateButton(i: number, field: "label" | "href", v: string) {
    const buttons = value.buttons.map((b, idx) => (idx === i ? { ...b, [field]: v } : b));
    onChange({ ...value, buttons });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="hero-heading">Heading</Label>
        <Input id="hero-heading" value={value.heading} onChange={(e) => onChange({ ...value, heading: e.target.value })} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hero-subtext">Subtext</Label>
        <Textarea id="hero-subtext" rows={2} value={value.subtext} onChange={(e) => onChange({ ...value, subtext: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Buttons</Label>
        {value.buttons.map((button, i) => (
          <div key={i} className="flex gap-2">
            <Input placeholder="Label" value={button.label} onChange={(e) => updateButton(i, "label", e.target.value)} />
            <Input placeholder="Link (e.g. /contact)" value={button.href} onChange={(e) => updateButton(i, "href", e.target.value)} />
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, buttons: value.buttons.filter((_, idx) => idx !== i) })}>
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
        {value.buttons.length < 4 ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, buttons: [...value.buttons, { label: "", href: "" }] })}>
            <Plus className="size-4" aria-hidden="true" />
            Add button
          </Button>
        ) : null}
      </div>
      <SiteImageUploadField label="Image (optional)" value={value.imageKey} onChange={(imageKey) => onChange({ ...value, imageKey })} />
    </div>
  );
}

export function TextFields({ value, onChange }: { value: TextBlockData; onChange: (v: TextBlockData) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="text-heading">Heading (optional)</Label>
        <Input id="text-heading" value={value.heading ?? ""} onChange={(e) => onChange({ ...value, heading: e.target.value || null })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="text-body">Body</Label>
        <Textarea id="text-body" rows={8} value={value.body} onChange={(e) => onChange({ ...value, body: e.target.value })} required />
        <p className="text-xs text-muted-foreground">Leave a blank line between paragraphs.</p>
      </div>
    </div>
  );
}

export function CardGridFields({ value, onChange }: { value: CardGridBlockData; onChange: (v: CardGridBlockData) => void }) {
  function updateCard(i: number, patch: Partial<CardGridBlockData["cards"][number]>) {
    onChange({ ...value, cards: value.cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="grid-heading">Heading (optional)</Label>
        <Input id="grid-heading" value={value.heading ?? ""} onChange={(e) => onChange({ ...value, heading: e.target.value || null })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="grid-subtext">Subtext (optional)</Label>
        <Textarea id="grid-subtext" rows={2} value={value.subtext ?? ""} onChange={(e) => onChange({ ...value, subtext: e.target.value || null })} />
      </div>
      <div className="space-y-3">
        <Label>Cards</Label>
        {value.cards.map((card, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <Input placeholder="Title" value={card.title} onChange={(e) => updateCard(i, { title: e.target.value })} />
            <Textarea placeholder="Body" rows={2} value={card.body} onChange={(e) => updateCard(i, { body: e.target.value })} />
            <SiteImageUploadField label="Image (optional)" value={card.imageKey} onChange={(imageKey) => updateCard(i, { imageKey })} />
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, cards: value.cards.filter((_, idx) => idx !== i) })}>
              <X className="size-4" aria-hidden="true" />
              Remove card
            </Button>
          </div>
        ))}
        {value.cards.length < 12 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...value, cards: [...value.cards, { title: "", body: "", imageKey: null }] })}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add card
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function CtaBandFields({ value, onChange }: { value: CtaBandBlockData; onChange: (v: CtaBandBlockData) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cta-heading">Heading</Label>
        <Input id="cta-heading" value={value.heading} onChange={(e) => onChange({ ...value, heading: e.target.value })} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cta-subtext">Subtext</Label>
        <Textarea id="cta-subtext" rows={2} value={value.subtext} onChange={(e) => onChange({ ...value, subtext: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <Input placeholder="Button label" value={value.button.label} onChange={(e) => onChange({ ...value, button: { ...value.button, label: e.target.value } })} />
        <Input placeholder="Button link" value={value.button.href} onChange={(e) => onChange({ ...value, button: { ...value.button, href: e.target.value } })} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `ContentBlockFormDialog`**

Create `app/(app)/admin/content/content-block-form-dialog.tsx`. On create, the admin first
picks a type (a `Select`); once chosen, the matching fields component renders with a
default-empty data object for that type. On edit, the type is fixed and the fields
component renders immediately with the existing data.

```tsx
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import type { ContentBlockType, SitePage } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { createContentBlock, updateContentBlock, type ContentBlockFormState } from "./actions";
import { BLOCK_TYPE_LABEL } from "@/lib/validation/content";
import { HeroFields, TextFields, CardGridFields, CtaBandFields } from "./block-type-fields";
import type {
  HeroBlockData,
  TextBlockData,
  CardGridBlockData,
  CtaBandBlockData,
} from "@/lib/validation/content";

type BlockData = HeroBlockData | TextBlockData | CardGridBlockData | CtaBandBlockData;

const EMPTY_DATA: Record<ContentBlockType, BlockData> = {
  HERO: { heading: "", subtext: "", buttons: [], imageKey: null },
  TEXT: { heading: null, body: "" },
  CARD_GRID: { heading: null, subtext: null, cards: [] },
  CTA_BAND: { heading: "", subtext: "", button: { label: "", href: "" } },
};

type Props =
  | { mode: "create"; page: SitePage }
  | { mode: "edit"; id: string; type: ContentBlockType; data: BlockData };

const initialState: ContentBlockFormState = {};

export function ContentBlockFormDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ContentBlockType | null>(props.mode === "edit" ? props.type : null);
  const [data, setData] = useState<BlockData>(props.mode === "edit" ? props.data : EMPTY_DATA.HERO);

  const action = props.mode === "create" ? createContentBlock.bind(null, props.page) : updateContentBlock.bind(null, props.id);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setOpen(false);
      if (props.mode === "create") {
        setType(null);
        setData(EMPTY_DATA.HERO);
      }
    }
    wasPending.current = pending;
  }, [pending, state.error, props.mode]);

  function pickType(next: ContentBlockType) {
    setType(next);
    setData(EMPTY_DATA[next]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(buttonVariants(props.mode === "create" ? { variant: "outline" } : { variant: "ghost", size: "sm" }))}
      >
        {props.mode === "create" ? (
          <>
            <Plus className="size-4" aria-hidden="true" />
            Add block
          </>
        ) : (
          <>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.mode === "create" ? "New block" : `Edit ${BLOCK_TYPE_LABEL[props.type]} block`}</DialogTitle>
        </DialogHeader>

        {props.mode === "create" && !type ? (
          <div className="space-y-2">
            <Select onValueChange={(v) => pickType(v as ContentBlockType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a block type" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(BLOCK_TYPE_LABEL) as ContentBlockType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {BLOCK_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : type ? (
          <form ref={formRef} action={formAction} className="space-y-4">
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="data" value={JSON.stringify(data)} />

            {type === "HERO" ? <HeroFields value={data as HeroBlockData} onChange={setData} /> : null}
            {type === "TEXT" ? <TextFields value={data as TextBlockData} onChange={setData} /> : null}
            {type === "CARD_GRID" ? <CardGridFields value={data as CardGridBlockData} onChange={setData} /> : null}
            {type === "CTA_BAND" ? <CtaBandFields value={data as CtaBandBlockData} onChange={setData} /> : null}

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : props.mode === "create" ? "Add" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all three pass clean. (This task has no page rendering it yet — Task 9 wires it
in — so this step confirms it compiles standalone, not that it's reachable in the browser.)

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/admin/content/content-block-form-dialog.tsx" "app/(app)/admin/content/block-type-fields.tsx" "app/(app)/admin/content/site-image-upload-field.tsx"
git commit -m "Add the admin content-block editor dialog and per-type field components

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Admin `/admin/content` pages and sidebar nav entry

**Files:**
- Create: `app/(app)/admin/content/page.tsx`
- Create: `app/(app)/admin/content/[page]/page.tsx`
- Modify: `app/(app)/_components/app-shell.tsx`

**Interfaces:**
- Consumes: `getPageBlocks`, `SITE_PAGE_LABEL`, `SITE_PAGE_PATH`, `parseSitePageSegment`
  (Task 3), `BLOCK_TYPE_LABEL`, `getBlockPreviewText` (Task 2), `ContentBlockFormDialog`
  (Task 8), `deleteContentBlock`, `moveContentBlock` (Task 7), `DeleteConfirmButton`
  (existing).
- Produces: nothing consumed by later tasks (this is the leaf of the admin-side work).

- [ ] **Step 1: `/admin/content` root — four page tiles**

Create `app/(app)/admin/content/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SITE_PAGE_LABEL } from "@/lib/queries/content";
import type { SitePage } from "@prisma/client";

export const metadata: Metadata = {
  title: "Site Content",
};

export default async function AdminContentPage() {
  await requireAdmin("/admin/content");

  const counts = await prisma.contentBlock.groupBy({ by: ["page"], _count: true });
  const countByPage = Object.fromEntries(counts.map((c) => [c.page, c._count])) as Record<SitePage, number>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Site Content</h1>
        <p className="text-sm text-muted-foreground">
          Edit the text, images and sections on each public page.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {(Object.keys(SITE_PAGE_LABEL) as SitePage[]).map((page) => (
          <Link
            key={page}
            href={`/admin/content/${page.toLowerCase()}`}
            className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
          >
            <p className="font-medium">{SITE_PAGE_LABEL[page]}</p>
            <p className="text-sm text-muted-foreground">
              {countByPage[page] ?? 0} block{(countByPage[page] ?? 0) === 1 ? "" : "s"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `/admin/content/[page]` — block list**

Create `app/(app)/admin/content/[page]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUp, ArrowDown } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getPageBlocks, SITE_PAGE_LABEL, parseSitePageSegment } from "@/lib/queries/content";
import { BLOCK_TYPE_LABEL, getBlockPreviewText } from "@/lib/validation/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteConfirmButton } from "@/components/admin/delete-confirm-button";
import { ContentBlockFormDialog } from "../content-block-form-dialog";
import { deleteContentBlock, moveContentBlock } from "../actions";
import type { HeroBlockData, TextBlockData, CardGridBlockData, CtaBandBlockData } from "@/lib/validation/content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const { page } = await params;
  const parsed = parseSitePageSegment(page);
  return { title: parsed ? SITE_PAGE_LABEL[parsed] : "Site Content" };
}

export default async function AdminContentPageDetail({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page: segment } = await params;
  await requireAdmin("/admin/content");

  const page = parseSitePageSegment(segment);
  if (!page) {
    notFound();
  }

  const blocks = await getPageBlocks(page);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{SITE_PAGE_LABEL[page]}</h1>
        <ContentBlockFormDialog mode="create" page={page} />
      </div>

      {blocks.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No blocks yet — add one above.
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {blocks.map((block, i) => (
            <div key={block.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 space-y-1">
                <Badge variant="outline">{BLOCK_TYPE_LABEL[block.type]}</Badge>
                <p className="truncate text-sm">{getBlockPreviewText(block.type, block.data)}</p>
              </div>
              <div className="flex items-center gap-1">
                <form action={moveContentBlock.bind(null, block.id, "up")}>
                  <Button type="submit" variant="ghost" size="sm" disabled={i === 0}>
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </Button>
                </form>
                <form action={moveContentBlock.bind(null, block.id, "down")}>
                  <Button type="submit" variant="ghost" size="sm" disabled={i === blocks.length - 1}>
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </Button>
                </form>
                <ContentBlockFormDialog
                  mode="edit"
                  id={block.id}
                  type={block.type}
                  data={block.data as HeroBlockData | TextBlockData | CardGridBlockData | CtaBandBlockData}
                />
                <DeleteConfirmButton
                  action={deleteContentBlock.bind(null, block.id)}
                  title={`Delete this ${BLOCK_TYPE_LABEL[block.type]} block?`}
                  description="This removes it from the live page immediately."
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Sidebar nav entry**

In `app/(app)/_components/app-shell.tsx`, add `LayoutTemplate` to the `lucide-react`
import list, and add one entry to `ADMIN_LINKS` (after Categories, before Departments, to
group it with the other content-management links):

```ts
  { href: "/admin/content", label: "Site Content", icon: LayoutTemplate },
```

- [ ] **Step 4: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all three pass clean.

- [ ] **Step 5: Manual verification — full admin flow**

This needs a real admin session and the dev server running (ask before starting it if it
isn't already running). As admin:
1. Open `/admin/content` — confirm all four pages list with their correct seeded block
   counts (Home 3, About 2, Services 2, Contact 1).
2. Open `/admin/content/home` — confirm the three seeded blocks list with correct type
   badges and preview text matching the seeded copy.
3. Add a new block of each of the four types to a scratch page (e.g. Services), confirm
   each appears in the admin list and then on the live public page at the matching path.
4. Edit an existing block's text, confirm the public page reflects the change immediately
   with no stale cache.
5. Upload an image to a Hero block and to a Card grid card, confirm both render on the
   public page and are reachable at `/api/site-images/<key>` with no login (open that URL
   in an incognito/unauthenticated context).
6. Replace one of those images with a different one, confirm the old file is gone from
   `STORAGE_DIR/site-images/` and the new one renders.
7. Delete a block that had an image, confirm it disappears from both the admin list and
   the public page, and its image file is removed from disk.
8. Use Move up/down on a page with 3+ blocks, confirm the public page's rendering order
   updates to match, and confirm the buttons are disabled (not erroring) at the top/bottom
   of the list.
9. Revisit `/contact` and confirm the contact form still submits correctly and looks
   visually unaffected.
10. Clean up any scratch blocks/images you added purely for this test, so the live site
    doesn't ship test content.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/admin/content/page.tsx" "app/(app)/admin/content/[page]/page.tsx" "app/(app)/_components/app-shell.tsx"
git commit -m "Add /admin/content pages and Site Content sidebar nav entry

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
