CREATE INDEX `activity_log_entity_type_idx` ON `activity_log` (`entity_type`);--> statement-breakpoint
CREATE INDEX `activity_log_action_type_idx` ON `activity_log` (`action_type`);--> statement-breakpoint
CREATE INDEX `activity_log_performed_at_idx` ON `activity_log` (`performed_at`);