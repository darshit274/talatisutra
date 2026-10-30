-- AlterTable
ALTER TABLE `ArticleCategory`
  ADD COLUMN `nameGu` VARCHAR(191) NULL,
  ADD COLUMN `shortDescriptionGu` TEXT NULL,
  ADD COLUMN `servicesDescriptionGu` TEXT NULL;

-- AlterTable
ALTER TABLE `SiteSettings`
  ADD COLUMN `contactHoursGu` VARCHAR(191) NULL,
  ADD COLUMN `contactAddressGu` VARCHAR(191) NULL,
  ADD COLUMN `aboutDisclaimerGu` TEXT NULL;

-- AlterTable
ALTER TABLE `Article`
  ADD COLUMN `titleGu` VARCHAR(200) NULL,
  ADD COLUMN `excerptGu` VARCHAR(300) NULL,
  ADD COLUMN `bodyGu` TEXT NULL;
