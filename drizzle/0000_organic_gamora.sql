CREATE TABLE `buyer_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`max_budget` integer NOT NULL,
	`max_commute_minutes` integer NOT NULL,
	`commute_anchor` text NOT NULL,
	`must_haves` text NOT NULL,
	`deal_breakers` text NOT NULL,
	`amenities` text NOT NULL,
	`weights` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `evaluations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`buyer_profile_id` integer NOT NULL,
	`photo_json` text,
	`score_json` text NOT NULL,
	`total_score` integer NOT NULL,
	`passed_filters` integer NOT NULL,
	`evaluation_mode` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`raw_text` text NOT NULL,
	`source_url` text,
	`extracted` text NOT NULL,
	`photo_urls` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
