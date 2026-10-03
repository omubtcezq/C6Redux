CREATE TABLE IF NOT EXISTS `user_comment` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `comment` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_user_comment_user_id` (`user_id`),
  KEY `ix_user_comment_created_at` (`created_at`),
  CONSTRAINT `fk_user_comment_apiuser`
    FOREIGN KEY (`user_id`) REFERENCES `apiuser` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
