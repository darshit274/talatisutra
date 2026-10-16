-- CreateTable
CREATE TABLE `ContentBlock` (
    `id` VARCHAR(191) NOT NULL,
    `page` ENUM('HOME', 'ABOUT', 'SERVICES', 'CONTACT') NOT NULL,
    `type` ENUM('HERO', 'TEXT', 'CARD_GRID', 'CTA_BAND') NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `data` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedById` VARCHAR(191) NULL,

    INDEX `ContentBlock_page_sortOrder_idx`(`page`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ContentBlock` ADD CONSTRAINT `ContentBlock_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `ContentBlock` (`id`, `page`, `type`, `sortOrder`, `data`, `updatedAt`) VALUES
('content-home-hero', 'HOME', 'HERO', 0, '{"heading":"TalatiSutra","subtext":"We help organisations manage records, documentation and day-to-day administrative work with accuracy, discretion and care.","buttons":[{"label":"Get in touch","href":"/contact"},{"label":"Our services","href":"/services"}],"imageKey":null}', CURRENT_TIMESTAMP(3)),
('content-home-cardgrid', 'HOME', 'CARD_GRID', 1, '{"heading":null,"subtext":null,"cards":[{"title":"Accurate record-keeping","body":"Every document is organised, categorised and tracked, so nothing important ever gets lost in the shuffle.","imageKey":null},{"title":"Dependable turnaround","body":"We treat deadlines as commitments, not suggestions, so your paperwork moves as fast as it needs to.","imageKey":null},{"title":"Confidential by default","body":"Sensitive material stays restricted to the people who need it, and nobody else.","imageKey":null}]}', CURRENT_TIMESTAMP(3)),
('content-home-ctaband', 'HOME', 'CTA_BAND', 2, '{"heading":"Ready to work with us?","subtext":"Reach out and we will get back to you as soon as we can.","button":{"label":"Contact us","href":"/contact"}}', CURRENT_TIMESTAMP(3)),
('content-about-text', 'ABOUT', 'TEXT', 0, '{"heading":"About us","body":"TalatiSutra was founded to bring order and accountability to the paperwork every organisation depends on but few enjoy dealing with. We work behind the scenes so the people we support can focus on their own work instead of tracking down the right document.\\n\\nOur team manages records, materials and correspondence across departments, keeping everything organised, current and accessible to exactly the people who are meant to see it.\\n\\nWhatever the task is, filing, documentation, or day-to-day administrative support, we aim to do it quietly, correctly, and on time."}', CURRENT_TIMESTAMP(3)),
('content-about-cardgrid', 'ABOUT', 'CARD_GRID', 1, '{"heading":"Our values","subtext":null,"cards":[{"title":"Integrity","body":"We handle other people\\u2019s records the way we would want our own handled, carefully, and without cutting corners.","imageKey":null},{"title":"Quality","body":"Work goes out right the first time. We check it before anyone else has to.","imageKey":null},{"title":"Reliability","body":"If we say it will be ready, it will be ready.","imageKey":null}]}', CURRENT_TIMESTAMP(3)),
('content-services-text', 'SERVICES', 'TEXT', 0, '{"heading":"Our services","body":"We provide a range of administrative, documentation and records-management services, built around accuracy, confidentiality and dependable turnaround."}', CURRENT_TIMESTAMP(3)),
('content-services-cardgrid', 'SERVICES', 'CARD_GRID', 1, '{"heading":null,"subtext":null,"cards":[{"title":"Document management","body":"Organising, categorising and maintaining records so the right file is always easy to find.","imageKey":null},{"title":"Administrative support","body":"Day-to-day paperwork, correspondence and office administration handled reliably and on schedule.","imageKey":null},{"title":"Records compliance","body":"Keeping documentation current, accurate and ready for review whenever it is needed.","imageKey":null},{"title":"Confidential handling","body":"Department-level access controls keep sensitive materials visible only to the people who should see them.","imageKey":null}]}', CURRENT_TIMESTAMP(3)),
('content-contact-text', 'CONTACT', 'TEXT', 0, '{"heading":"Contact us","body":"Have a question or need something handled? Send us a message and we will get back to you."}', CURRENT_TIMESTAMP(3));
