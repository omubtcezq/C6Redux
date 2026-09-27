CREATE TABLE IF NOT EXISTS `screen_similarity_fingerprint` (
  `screen_id` int NOT NULL,
  `version` int NOT NULL,
  `fingerprint` longtext NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`screen_id`),
  CONSTRAINT `fk_screen_similarity_fingerprint_screen`
    FOREIGN KEY (`screen_id`) REFERENCES `screen` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
