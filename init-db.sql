-- create the user and database
-- CREATE DATABASE StreamStory;
ALTER DATABASE StreamStory CHARACTER SET utf8 COLLATE utf8_general_ci;
CREATE USER 'StreamStory'@'localhost' IDENTIFIED BY 'StreamStory';
-- CREATE USER 'StreamStory'@'%' IDENTIFIED BY 'StreamStory';
GRANT ALL PRIVILEGES ON StreamStory.* TO 'StreamStory'@'localhost';
-- GRANT ALL PRIVILEGES ON StreamStory.* TO 'StreamStory'@'%';
