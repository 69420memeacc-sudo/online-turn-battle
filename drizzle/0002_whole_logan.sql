ALTER TABLE `players` ADD `loadout_item_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
UPDATE `players` SET `loadout_item_ids` = `item_ids` WHERE `item_ids` != '[]';
