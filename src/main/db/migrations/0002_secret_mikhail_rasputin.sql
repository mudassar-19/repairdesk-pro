ALTER TABLE `customers` ADD `last_synced_remote_updated_at` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `last_synced_remote_updated_at` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `last_synced_remote_updated_at` text;--> statement-breakpoint
ALTER TABLE `repairs` ADD `last_synced_remote_updated_at` text;--> statement-breakpoint
ALTER TABLE `sync_queue` ADD `last_attempt_at` text;--> statement-breakpoint
CREATE INDEX `sync_queue_sync_status_idx` ON `sync_queue` (`sync_status`);