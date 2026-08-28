CREATE TABLE `evaluation_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`identity_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `evaluations` ADD `visitor_session_id` text;