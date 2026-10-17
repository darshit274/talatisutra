-- Data-only migration: commits the real Talatisutra marketing copy for HOME,
-- ABOUT, SERVICES and CONTACT to the repo. Previously this copy only existed in
-- the dev database via one-off scratch scripts (Tasks 15-17), which a fresh
-- `prisma migrate deploy` would never see — this migration is the fix (review
-- finding I-5/I-6).

-- HOME: drop the superseded CTA_BAND row (replaced by a dedicated
-- HomeNewsletterSection component, not a ContentBlock), add the About teaser
-- TEXT block, and update the pillars CARD_GRID to the real Sourced/Dated/Free copy.
DELETE FROM `ContentBlock` WHERE `id` = 'content-home-ctaband';

INSERT INTO `ContentBlock` (`id`, `page`, `type`, `sortOrder`, `data`, `updatedAt`) VALUES
('content-home-text', 'HOME', 'TEXT', 1, '{"heading":"A working library for the village revenue office.","body":"Talatisutra began as a shared folder of GRs, circulars and notes passed between a handful of Talati-cum-Mantri officers who were tired of hunting for the same documents every few months.\\n\\nIt has since grown into an open library, organised by subject and date, with every document linked back to its official source so nothing here has to be taken on faith."}', CURRENT_TIMESTAMP(3));

UPDATE `ContentBlock` SET `sortOrder` = 2, `data` = '{"heading":null,"subtext":null,"cards":[{"title":"Sourced","body":"Every document links back to the government resolution, circular or notification it came from.","imageKey":null},{"title":"Dated","body":"Each entry carries the date it was issued, so you always know how current it is.","imageKey":null},{"title":"Free","body":"No login, no fee. Everything here is free to read and free to download.","imageKey":null}]}' WHERE `id` = 'content-home-cardgrid';

-- ABOUT: the real heading, origin/sourcing paragraphs, and the 3 numbered values.
UPDATE `ContentBlock` SET `data` = '{"heading":"Made by people who know the panchayat office.","body":"Talatisutra began as a shared folder of GRs, circulars and notes passed between a handful of Talati-cum-Mantri officers who were tired of hunting for the same documents every few months. What started as a personal filing habit grew into something worth sharing more widely.\\n\\nEvery document is linked to its official source, so nothing on this site has to be taken on faith. Where a resolution or circular is still being tracked down, we say so rather than guess at it."}' WHERE `id` = 'content-about-text';

UPDATE `ContentBlock` SET `data` = '{"heading":"What we care about","subtext":null,"cards":[{"title":"Official sources first","body":"Every document here is linked back to the resolution, circular or notification it came from, so you can always check the original.","imageKey":null},{"title":"Written for the village office","body":"Procedure notes are written the way the work actually happens at the gram panchayat level, not copied from a general circular.","imageKey":null},{"title":"Kept current","body":"When a rule changes, the entry here changes with it, dated so you know how recent it is.","imageKey":null}]}' WHERE `id` = 'content-about-cardgrid';

-- SERVICES: the real heading and intro; the category CARD_GRID is superseded by
-- the static CATEGORY_META-driven layout in the page itself (one source of truth).
UPDATE `ContentBlock` SET `data` = '{"heading":"Six desks, one library.","body":"Every category below covers one area of work at the village revenue office, from government resolutions to exam preparation. Open a category to browse its documents, or use the search on the Articles page once you know what you are looking for."}' WHERE `id` = 'content-services-text';

DELETE FROM `ContentBlock` WHERE `id` = 'content-services-cardgrid';

-- CONTACT: the real heading and intro (spec §4).
UPDATE `ContentBlock` SET `data` = '{"heading":"Ask a question or send us a document.","body":"Have a question about a procedure, or a document you think belongs in this library? Send it along and we will get back to you, usually within a couple of working days."}' WHERE `id` = 'content-contact-text';
