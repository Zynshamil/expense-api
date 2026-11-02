CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`title` text NOT NULL,
	`category_id` text NOT NULL,
	`subcategory` text NOT NULL,
	`date` text NOT NULL,
	`payment` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `expense_user_date_idx` ON `expenses` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`budget` integer DEFAULT 0 NOT NULL,
	`categories` text NOT NULL
);
