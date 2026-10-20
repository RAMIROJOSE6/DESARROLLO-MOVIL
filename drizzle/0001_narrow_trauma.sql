ALTER TABLE `geo_photos` ADD `note` text;--> statement-breakpoint
ALTER TABLE `geo_photos` ADD `favorite` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `geo_photos` ADD `client_id` text;--> statement-breakpoint
ALTER TABLE `geo_photos` ADD `updated_at` integer;--> statement-breakpoint
ALTER TABLE `geo_photos` ADD `remote_path` text;--> statement-breakpoint
ALTER TABLE `geo_photos` ADD `synced_at` integer;--> statement-breakpoint
ALTER TABLE `geo_photos` ADD `owner_id` text;