CREATE TABLE `actions` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`turn_number` integer NOT NULL,
	`actor_id` text NOT NULL,
	`target_id` text NOT NULL,
	`action_id` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`message` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `actions_room_turn_unique` ON `actions` (`room_id`,`turn_number`);--> statement-breakpoint
CREATE INDEX `actions_room_idx` ON `actions` (`room_id`,`turn_number`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`name` text NOT NULL,
	`team` text NOT NULL,
	`hp` integer DEFAULT 100 NOT NULL,
	`max_hp` integer DEFAULT 100 NOT NULL,
	`barrier` integer DEFAULT 0 NOT NULL,
	`weapon_id` text DEFAULT 'longsword' NOT NULL,
	`armor_id` text DEFAULT 'chainmail' NOT NULL,
	`skill_ids` text DEFAULT '["guard","mend"]' NOT NULL,
	`cooldowns` text DEFAULT '{}' NOT NULL,
	`ready` integer DEFAULT 0 NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `players_room_idx` ON `players` (`room_id`,`joined_at`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'lobby' NOT NULL,
	`host_player_id` text NOT NULL,
	`current_player_id` text,
	`turn_number` integer DEFAULT 1 NOT NULL,
	`winner_team` text,
	`human_cursor` integer DEFAULT 0 NOT NULL,
	`monster_cursor` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_code_unique` ON `rooms` (`code`);