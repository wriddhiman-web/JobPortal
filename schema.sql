CREATE DATABASE IF NOT EXISTS `jobportal` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `jobportal`;

DROP TABLE IF EXISTS `applications`;
DROP TABLE IF EXISTS `jobs`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('seeker', 'employer', 'admin') NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `jobs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employer_id` INT NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `company` VARCHAR(150) NOT NULL,
    `location` VARCHAR(100) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `salary_range` VARCHAR(100) NOT NULL,
    `description` TEXT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_jobs_title` (`title`),
    INDEX `idx_jobs_location` (`location`),
    CONSTRAINT `fk_jobs_employer` FOREIGN KEY (`employer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `applications` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `job_id` INT NOT NULL,
    `seeker_id` INT NOT NULL,
    `cover_note` TEXT NOT NULL,
    `resume_path` VARCHAR(255) NULL,
    `status` ENUM('pending', 'shortlisted', 'rejected') NOT NULL DEFAULT 'pending',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uniq_job_seeker` (`job_id`, `seeker_id`),
    CONSTRAINT `fk_apps_job` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_apps_seeker` FOREIGN KEY (`seeker_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed data: 1 admin, 1 employer, 1 seeker (passwords: Password123!)
INSERT INTO `users` (`id`, `name`, `email`, `password`, `role`) VALUES
(1, 'System Admin', 'admin@jobportal.test', '$2y$12$ICO4H/S3/dkYwKMRH68EqOxpdXESLzxgyp3LFvjWTE9qylPee.QuK', 'admin'),
(2, 'TechCorp Hiring', 'employer@jobportal.test', '$2y$12$ICO4H/S3/dkYwKMRH68EqOxpdXESLzxgyp3LFvjWTE9qylPee.QuK', 'employer'),
(3, 'Jane Seeker', 'seeker@jobportal.test', '$2y$12$ICO4H/S3/dkYwKMRH68EqOxpdXESLzxgyp3LFvjWTE9qylPee.QuK', 'seeker');

-- 5 sample jobs
INSERT INTO `jobs` (`id`, `employer_id`, `title`, `company`, `location`, `type`, `salary_range`, `description`) VALUES
(1, 2, 'Senior Backend Engineer', 'TechCorp', 'San Francisco, CA', 'Full-time', '$140k - $180k', 'Build and optimize scalable REST and JSON APIs with PHP and MySQL. Work with microservices and cloud deployments.'),
(2, 2, 'Frontend Developer', 'TechCorp', 'New York, NY', 'Full-time', '$110k - $135k', 'Create responsive, high-performance web applications using semantic HTML5, modern CSS3, and vanilla JavaScript.'),
(3, 2, 'DevOps Specialist', 'TechCorp', 'Remote', 'Contract', '$70 - $90 / hr', 'Manage CI/CD workflows, containerization with Docker, server hardening, and database replication setups.'),
(4, 2, 'Product UI/UX Designer', 'TechCorp', 'Austin, TX', 'Part-time', '$60k - $80k', 'Design user-centric workflows, design systems, and responsive interfaces for our SaaS enterprise tools.'),
(5, 2, 'Junior Web Developer', 'TechCorp', 'Chicago, IL', 'Internship', '$25 - $30 / hr', 'Collaborate with senior team members on frontend widgets, documentation, bug fixes, and unit tests.');
