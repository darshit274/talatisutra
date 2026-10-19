-- AlterTable
ALTER TABLE `contentblock` MODIFY `page` ENUM('HOME', 'ABOUT', 'SERVICES', 'CONTACT', 'ARTICLES', 'PRIVACY', 'DISCLAIMER') NOT NULL;

-- SeedData: one TEXT block per new page, carrying today's real public copy
-- forward verbatim (articles/page.tsx, privacy/page.tsx, disclaimer/page.tsx),
-- so /admin/content has something real to show and no page's source changes
-- until an admin edits it.
INSERT INTO `ContentBlock` (`id`, `page`, `type`, `sortOrder`, `data`, `updatedAt`) VALUES
('content-articles-text', 'ARTICLES', 'TEXT', 0, '{"heading":"Articles","body":"GRs, circulars, land record guides, exam preparation and forms, organised by subject and date."}', CURRENT_TIMESTAMP(3)),
('content-privacy-text', 'PRIVACY', 'TEXT', 0, '{"heading":"Privacy","body":"This page is coming soon. Talatisutra is an independent information resource and is not an official website of the Government of Gujarat or the Government of India."}', CURRENT_TIMESTAMP(3)),
('content-disclaimer-text', 'DISCLAIMER', 'TEXT', 0, '{"heading":"Disclaimer","body":"This page is coming soon. Talatisutra is an independent information resource and is not an official website of the Government of Gujarat or the Government of India."}', CURRENT_TIMESTAMP(3));
