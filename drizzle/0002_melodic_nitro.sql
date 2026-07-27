CREATE TABLE `email_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`game_emails` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
