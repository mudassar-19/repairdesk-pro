CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`description` text NOT NULL,
	`performed_at` text NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`address` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_phone_idx` ON `customers` (`phone`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL,
	`description` text,
	`expense_date` text NOT NULL,
	`is_recurring` integer DEFAULT false NOT NULL,
	`recurring_month` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `health_check` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`checked_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`repair_id` text NOT NULL,
	`amount` real NOT NULL,
	`type` text NOT NULL,
	`payment_date` text NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`repair_id`) REFERENCES `repairs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payments_repair_id_idx` ON `payments` (`repair_id`);--> statement-breakpoint
CREATE TABLE `repairs` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`device_brand` text NOT NULL,
	`device_model` text NOT NULL,
	`issue` text NOT NULL,
	`accessories` text,
	`imei` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`cost_price` real DEFAULT 0 NOT NULL,
	`repair_price` real DEFAULT 0 NOT NULL,
	`advance_amount` real DEFAULT 0 NOT NULL,
	`remaining_balance` real DEFAULT 0 NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`estimated_delivery_date` text,
	`delivery_time` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `repairs_status_idx` ON `repairs` (`status`);--> statement-breakpoint
CREATE INDEX `repairs_customer_id_idx` ON `repairs` (`customer_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`payload` text NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL
);
