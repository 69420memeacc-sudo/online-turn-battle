ALTER TABLE `players` ADD `last_seen_at` text DEFAULT '1970-01-01 00:00:00' NOT NULL;--> statement-breakpoint
UPDATE `players` SET `last_seen_at` = CURRENT_TIMESTAMP;
