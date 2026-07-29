ALTER TABLE `players` ADD `poisoned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `extra_action_pending` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `giant_sword_wait` integer DEFAULT 0 NOT NULL;