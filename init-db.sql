-- create the user and database
CREATE USER 'StreamStory'@'localhost' IDENTIFIED BY 'StreamStory';
CREATE DATABASE StreamStory;
ALTER DATABASE StreamStory CHARACTER SET utf8 COLLATE utf8_general_ci;
GRANT ALL PRIVILEGES ON StreamStory.* TO 'StreamStory'@'localhost';
