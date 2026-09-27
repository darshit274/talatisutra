import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/auth/ip";
import { materialMetadataSchema } from "@/lib/validation/materials";
import {
  MAX_UPLOAD_BYTES,
  sniffFileType,
  declaredMimeMatchesSniffed,
  writeUploadedFile,
  deleteUploadedFile,
} from "@/lib/materials/upload";

// Multipart upload goes through a route handler, not a Server Action, to avoid the
// Server Action body-size limit (BUILD-PLAN "Working conventions").
export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await requireAdmin();

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }

  // Reject oversized uploads before reading the whole thing into memory
  // (BUILD-PLAN §7 step 3 / CLAUDE.md rule 6).
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File is too large. Maximum size is 25 MB." }, { status: 413 });
  }

  const parsed = materialMetadataSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
    visibility: formData.get("visibility"),
    departmentIds: formData.getAll("departmentIds"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the form and try again." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Never trust the declared MIME type — sniff the real one from magic bytes
  // (CLAUDE.md rule 6) and derive the disk extension from THAT, never from the
  // upload's filename or declared type.
  const sniffed = sniffFileType(buffer);
  if (!sniffed) {
    return NextResponse.json(
      { error: "Unrecognised file type. Allowed: PDF, PNG, JPEG, WebP." },
      { status: 400 },
    );
  }
  if (!declaredMimeMatchesSniffed(file.type, sniffed)) {
    return NextResponse.json(
      { error: "The file's contents don't match its declared type." },
      { status: 400 },
    );
  }

  const storageKey = await writeUploadedFile(buffer, sniffed.ext);

  try {
    const material = await prisma.$transaction(async (tx) => {
      const created = await tx.material.create({
        data: {
          title: parsed.data.title,
          description: parsed.data.description || null,
          kind: sniffed.kind,
          storageKey,
          originalName: file.name,
          mimeType: sniffed.mime,
          sizeBytes: buffer.length,
          categoryId: parsed.data.categoryId || null,
          visibility: parsed.data.visibility,
          uploadedById: admin.id,
        },
      });

      if (parsed.data.visibility === "DEPARTMENTS" && parsed.data.departmentIds.length > 0) {
        await tx.materialDepartment.createMany({
          data: parsed.data.departmentIds.map((departmentId) => ({
            materialId: created.id,
            departmentId,
          })),
        });
      }

      return created;
    });

    await writeAuditLog({
      actor: admin,
      action: "material.upload",
      entity: "Material",
      entityId: material.id,
      meta: { title: material.title, kind: material.kind, sizeBytes: material.sizeBytes },
      ip: getClientIp(await headers()),
    });

    return NextResponse.json({ id: material.id }, { status: 201 });
  } catch (error) {
    // BUILD-PLAN §7 step 6 — if the DB write fails, unlink the file we already wrote.
    await deleteUploadedFile(storageKey);
    console.error("Failed to create material:", error);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
