CREATE TABLE `departure_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`installation_id` varchar(64) NOT NULL,
	`appointment_label` varchar(160) NOT NULL,
	`appointment_at` timestamp NOT NULL,
	`line_id` int NOT NULL,
	`destination_latitude` decimal(10,7) NOT NULL,
	`destination_longitude` decimal(10,7) NOT NULL,
	`latest_latitude` decimal(10,7),
	`latest_longitude` decimal(10,7),
	`location_consented` boolean NOT NULL DEFAULT false,
	`is_enabled` boolean NOT NULL DEFAULT true,
	`alerted_at` timestamp,
	`schedule_cron_task_uid` varchar(65),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `departure_alerts_id` PRIMARY KEY(`id`),
	CONSTRAINT `departure_alerts_installation_id_unique` UNIQUE(`installation_id`)
);
