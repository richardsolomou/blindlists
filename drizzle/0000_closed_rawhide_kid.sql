CREATE TABLE `crews` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crews_token_unique` ON `crews` (`token`);--> statement-breakpoint
CREATE TABLE `entries` (
	`game_id` text NOT NULL,
	`member_id` text NOT NULL,
	`list` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_game_member_unique` ON `entries` (`game_id`,`member_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`crew_id` text NOT NULL,
	`number` integer NOT NULL,
	`created_at` integer NOT NULL,
	`revealed_at` integer,
	FOREIGN KEY (`crew_id`) REFERENCES `crews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `games_crew_id_index` ON `games` (`crew_id`);--> statement-breakpoint
CREATE INDEX `games_created_at_index` ON `games` (`created_at`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`crew_id` text NOT NULL,
	`name` text NOT NULL,
	`seat` integer NOT NULL,
	FOREIGN KEY (`crew_id`) REFERENCES `crews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `members_crew_id_index` ON `members` (`crew_id`);