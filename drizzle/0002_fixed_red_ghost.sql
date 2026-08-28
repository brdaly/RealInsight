CREATE INDEX IF NOT EXISTS `evaluation_requests_identity_created_idx` ON `evaluation_requests` (`identity_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `evaluations_listing_id_idx` ON `evaluations` (`listing_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `evaluations_visitor_session_id_idx` ON `evaluations` (`visitor_session_id`);
