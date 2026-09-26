import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEPARTMENTS = ["Administration", "Accounts", "Operations", "Sales"];
const CATEGORIES = [
  "Policies",
  "Training Material",
  "Forms",
  "Circulars",
  "Photos",
];

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function main() {
  const isProduction = process.env.NODE_ENV === "production";

  const departments = await Promise.all(
    DEPARTMENTS.map((name) =>
      prisma.department.upsert({
        where: { name },
        update: {},
        create: { name, slug: slugify(name) },
      }),
    ),
  );

  await Promise.all(
    CATEGORIES.map((name, index) =>
      prisma.category.upsert({
        where: { name },
        update: {},
        create: { name, slug: slugify(name), sortOrder: index },
      }),
    ),
  );

  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL;
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!seedAdminEmail || !seedAdminPassword) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set to seed the admin account.",
    );
  }

  const adminPasswordHash = await bcrypt.hash(seedAdminPassword, 12);

  await prisma.user.upsert({
    where: { email: seedAdminEmail },
    update: {},
    create: {
      name: "Admin",
      email: seedAdminEmail,
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      mustChangePassword: true,
    },
  });

  console.log(`✔ Seeded ${departments.length} departments, ${CATEGORIES.length} categories, and the admin account (${seedAdminEmail}).`);

  if (isProduction) {
    console.log("NODE_ENV=production — skipping sample employees.");
    return;
  }

  const samplePasswordHash = await bcrypt.hash("Password123!", 12);
  const sampleEmployees = [
    { name: "Asha Rao", email: "asha.rao@example.dev", department: "Accounts" },
    { name: "Vikram Shah", email: "vikram.shah@example.dev", department: "Operations" },
    { name: "Neha Kapoor", email: "neha.kapoor@example.dev", department: "Sales" },
  ] as const;

  for (const employee of sampleEmployees) {
    const department = departments.find((d) => d.name === employee.department);

    await prisma.user.upsert({
      where: { email: employee.email },
      update: {},
      create: {
        name: employee.name,
        email: employee.email,
        passwordHash: samplePasswordHash,
        role: "EMPLOYEE",
        departmentId: department?.id,
        mustChangePassword: false,
      },
    });
  }

  console.log(
    `✔ Seeded ${sampleEmployees.length} sample employees (dev only, password: Password123!).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
