DROP TABLE `sync_queue`;--> statement-breakpoint
ALTER TABLE `customers` DROP COLUMN `sync_status`;--> statement-breakpoint
ALTER TABLE `customers` DROP COLUMN `last_synced_remote_updated_at`;--> statement-breakpoint
ALTER TABLE `expenses` DROP COLUMN `sync_status`;--> statement-breakpoint
ALTER TABLE `expenses` DROP COLUMN `last_synced_remote_updated_at`;--> statement-breakpoint
ALTER TABLE `payments` DROP COLUMN `sync_status`;--> statement-breakpoint
ALTER TABLE `payments` DROP COLUMN `last_synced_remote_updated_at`;--> statement-breakpoint
ALTER TABLE `repairs` DROP COLUMN `sync_status`;--> statement-breakpoint
ALTER TABLE `repairs` DROP COLUMN `last_synced_remote_updated_at`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `sync_status`;--> statement-breakpoint
ALTER TABLE `udhaar` DROP COLUMN `sync_status`;--> statement-breakpoint
ALTER TABLE `udhaar` DROP COLUMN `last_synced_remote_updated_at`;--> statement-breakpoint
ALTER TABLE `udhaar_settlements` DROP COLUMN `sync_status`;--> statement-breakpoint
ALTER TABLE `udhaar_settlements` DROP COLUMN `last_synced_remote_updated_at`;