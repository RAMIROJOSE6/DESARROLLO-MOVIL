CREATE TABLE `geo_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`uri` text NOT NULL,
	`latitude` real,
	`longitude` real,
	`accuracy` real,
	`coordinate_timestamp` integer,
	`source` text NOT NULL,
	`created_at` integer NOT NULL
);
