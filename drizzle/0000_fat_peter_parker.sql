CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`host_token` text NOT NULL,
	`created_at` integer NOT NULL,
	`revealed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_host_token_unique` ON `games` (`host_token`);--> statement-breakpoint
CREATE INDEX `games_created_at_index` ON `games` (`created_at`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`name` text NOT NULL,
	`seat` integer NOT NULL,
	`token` text NOT NULL,
	`list` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_token_unique` ON `players` (`token`);--> statement-breakpoint
CREATE INDEX `players_game_id_index` ON `players` (`game_id`);