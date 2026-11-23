CREATE TABLE `ai_history` (
	`id` text PRIMARY KEY NOT NULL,
	`photo_id` integer NOT NULL,
	`prompt` text,
	`response` text NOT NULL,
	`tags` text,
	`tone` text DEFAULT 'natural',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `photos` ADD `ai_description` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `ai_tags` text;