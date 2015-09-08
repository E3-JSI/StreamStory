--====================================================================
-- create the user
CREATE USER 'StreamStory'@'localhost' IDENTIFIED BY 'StreamStory';

-- create database
CREATE DATABASE StreamStory;
GRANT ALL PRIVILEGES ON StreamStory.* TO 'StreamStory'@'localhost';

--====================================================================

USE StreamStory;

CREATE TABLE user (email VARCHAR(100) PRIMARY KEY);
CREATE TABLE user_base (bid INT PRIMARY KEY AUTO_INCREMENT, user_email VARCHAR(100) NOT NULL, base_dir VARCHAR(255) NOT NULL, dataset VARCHAR(255) NOT NULL, FOREIGN KEY (user_email) REFERENCES user(email));
