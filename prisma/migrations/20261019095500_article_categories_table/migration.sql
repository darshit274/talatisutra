-- Hand-written (Prisma's migrate dev refused to auto-diff this: adding a
-- required column to a 10-row table and dropping a non-null column both need
-- an explicit backfill in between, which migrate dev's own diff ordering
-- can't produce). Converts the ArticleCategory enum into a real, admin-
-- managed table (design doc §2) and backfills every existing Article and the
-- HOME page's seeded SLIDER block to point at the new rows by slug.

-- 1. Create the new table.
CREATE TABLE `ArticleCategory` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NOT NULL,
    `shortDescription` TEXT NOT NULL,
    `servicesDescription` TEXT NOT NULL,
    `tags` JSON NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ArticleCategory_name_key`(`name`),
    UNIQUE INDEX `ArticleCategory_slug_key`(`slug`),
    INDEX `ArticleCategory_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Seed the 6 existing categories, carrying today's real label, icon,
-- description and tag text forward verbatim from lib/articles/categories.ts
-- (no content change, pure structural move) — slugs are hand-written, short
-- and clean, independent of `name` (see design doc's "Seed migration" note).
INSERT INTO `ArticleCategory` (`id`, `name`, `slug`, `icon`, `shortDescription`, `servicesDescription`, `tags`, `sortOrder`) VALUES
('cat-gr-circulars', 'GR & Circular archive', 'gr-circulars', 'FileText', 'Government resolutions and circulars from the Revenue and Panchayat departments, dated and linked to the official source.', 'Government resolutions and circulars from the Revenue and Panchayat departments, dated and linked to the official source.', '["Revenue Dept.", "Panchayat Dept.", "Yearly index"]', 0),
('cat-land-records', 'Land record guides', 'land-records', 'Map', 'Procedure notes for 7/12, 8-A, varsai, mutation entries and e-Dhara, written for the village office.', 'Procedure notes for 7/12, 8-A, varsai, mutation entries and e-Dhara, written for the village office.', '["7/12 & 8-A", "Varsai", "Mutation (6)"]', 1),
('cat-panchayat-administration', 'Panchayat administration', 'panchayat-administration', 'Landmark', 'Gram Sabha, tax registers, accounts and the day-to-day duties of the Mantri role.', 'Gram Sabha, tax registers, accounts and the day-to-day duties of the Mantri role.', '["Gram Sabha", "House tax", "Accounts"]', 2),
('cat-exam-preparation', 'Exam preparation', 'exam-preparation', 'GraduationCap', 'Syllabus, subject notes, previous papers and mock tests for the Talati-cum-Mantri recruitment exam.', 'Syllabus, subject notes, previous papers and mock tests for the Talati-cum-Mantri recruitment exam.', '["Syllabus", "Past papers", "Mock tests"]', 3),
('cat-salary-service-rules', 'Salary & service rules', 'salary-service-rules', 'Scale', 'Pay scales, DA revisions, leave, transfer and promotion rules explained in plain language.', 'Pay scales, DA revisions, leave, transfer and promotion rules explained in plain language.', '["Pay & DA", "Leave", "Transfers"]', 4),
('cat-forms-downloads', 'Forms & downloads', 'forms-downloads', 'Download', 'Ready-to-print forms and register formats used at the gram panchayat, in Gujarati and English.', 'Ready-to-print forms and register formats used at the gram panchayat, in Gujarati and English.', '["Certificates", "Registers", "Applications"]', 5);

-- 3. Add the new FK column as nullable first, so the 10 existing Article rows
-- don't block the ALTER before they're backfilled below.
ALTER TABLE `article` ADD COLUMN `categoryId` VARCHAR(191) NULL;

-- 4. Backfill every existing Article row's categoryId from its old enum value.
UPDATE `article` SET `categoryId` = 'cat-gr-circulars' WHERE `category` = 'GR_CIRCULARS';
UPDATE `article` SET `categoryId` = 'cat-land-records' WHERE `category` = 'LAND_RECORDS';
UPDATE `article` SET `categoryId` = 'cat-panchayat-administration' WHERE `category` = 'PANCHAYAT_ADMINISTRATION';
UPDATE `article` SET `categoryId` = 'cat-exam-preparation' WHERE `category` = 'EXAM_PREPARATION';
UPDATE `article` SET `categoryId` = 'cat-salary-service-rules' WHERE `category` = 'SALARY_SERVICE_RULES';
UPDATE `article` SET `categoryId` = 'cat-forms-downloads' WHERE `category` = 'FORMS_DOWNLOADS';

-- 5. Now that every row has a categoryId, make it required, add the FK
-- (RESTRICT — a category with articles can't be deleted), drop the old
-- enum column and its now-superseded composite index.
ALTER TABLE `article` MODIFY `categoryId` VARCHAR(191) NOT NULL;
ALTER TABLE `article` ADD CONSTRAINT `Article_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ArticleCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX `Article_category_publishedAt_idx` ON `article`;
ALTER TABLE `article` DROP COLUMN `category`;
CREATE INDEX `Article_categoryId_publishedAt_idx` ON `article`(`categoryId`, `publishedAt`);

-- 6. Every SLIDER ContentBlock stores its own category reference inside a
-- JSON blob with no foreign key — rewrite any slide's raw enum string to
-- the matching new slug, or that slide would point at a category that no
-- longer resolves. Done by value, across every SLIDER row (not just the
-- originally-seeded HOME block by id, and not by slide position) — a
-- position/id-targeted rewrite would silently miss, or mis-rewrite, a
-- slider an admin has since reordered, retargeted, or recreated since the
-- HOME slider shipped (confirmed live-editable since it was built).
UPDATE `contentblock`
SET `data` = CAST(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        CAST(`data` AS CHAR),
        '"GR_CIRCULARS"', '"gr-circulars"'),
        '"LAND_RECORDS"', '"land-records"'),
        '"PANCHAYAT_ADMINISTRATION"', '"panchayat-administration"'),
        '"EXAM_PREPARATION"', '"exam-preparation"'),
        '"SALARY_SERVICE_RULES"', '"salary-service-rules"'),
        '"FORMS_DOWNLOADS"', '"forms-downloads"')
    AS JSON)
WHERE `type` = 'SLIDER';
