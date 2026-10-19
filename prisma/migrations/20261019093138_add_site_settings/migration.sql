-- CreateTable
CREATE TABLE `SiteSettings` (
    `id` VARCHAR(191) NOT NULL,
    `contactEmail` VARCHAR(191) NOT NULL,
    `contactPhone` VARCHAR(191) NOT NULL,
    `contactHours` VARCHAR(191) NOT NULL,
    `contactAddress` VARCHAR(191) NOT NULL,
    `aboutPhotoKey` VARCHAR(191) NULL,
    `aboutDisclaimer` TEXT NOT NULL,
    `contactMapImageKey` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedById` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SiteSettings` ADD CONSTRAINT `SiteSettings_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- SeedData: exactly one row, carrying today's real public copy forward verbatim
-- (marketing-footer.tsx / contact-details.tsx / about/page.tsx), so no page's
-- source changes until an admin edits it via /admin/settings.
INSERT INTO `SiteSettings` (`id`, `contactEmail`, `contactPhone`, `contactHours`, `contactAddress`, `aboutPhotoKey`, `aboutDisclaimer`, `contactMapImageKey`, `updatedAt`, `updatedById`)
VALUES (
    'site-settings-default',
    'help@talatisutra.in',
    '+91 98250 00000',
    'Mon–Sat, 10am–6pm',
    'Gandhinagar, Gujarat',
    NULL,
    'Talatisutra is an independent information resource and is not an official website of the Government of Gujarat or the Government of India.',
    NULL,
    CURRENT_TIMESTAMP(3),
    NULL
);
