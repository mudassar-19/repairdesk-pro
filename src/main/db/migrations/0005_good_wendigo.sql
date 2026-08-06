CREATE TABLE `udhaar` (
	`id` text PRIMARY KEY NOT NULL,
	`person_name` text NOT NULL,
	`person_phone` text,
	`customer_id` text,
	`direction` text NOT NULL,
	`total_amount` real NOT NULL,
	`amount_settled` real DEFAULT 0 NOT NULL,
	`remaining_balance` real NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`due_date` text,
	`repair_id` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`last_synced_remote_updated_at` text,
	`is_deleted` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`repair_id`) REFERENCES `repairs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `udhaar_direction_idx` ON `udhaar` (`direction`);--> statement-breakpoint
CREATE INDEX `udhaar_status_idx` ON `udhaar` (`status`);--> statement-breakpoint
CREATE INDEX `udhaar_due_date_idx` ON `udhaar` (`due_date`);--> statement-breakpoint
CREATE TABLE `udhaar_settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`udhaar_id` text NOT NULL,
	`amount` real NOT NULL,
	`settlement_date` text NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`last_synced_remote_updated_at` text,
	`is_deleted` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`udhaar_id`) REFERENCES `udhaar`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `udhaar_settlements_udhaar_id_idx` ON `udhaar_settlements` (`udhaar_id`);