ALTER TABLE `players` ADD `mp` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `max_mp` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `item_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `sleep_turns` integer DEFAULT 0 NOT NULL;