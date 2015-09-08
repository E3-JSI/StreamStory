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

-- configuration of the friction coefficient
CREATE TABLE config (property VARCHAR(100) PRIMARY KEY, value VARCHAR(100) NOT NULL);

INSERT INTO config (property, value) values ('calc_coeff', 'false');
INSERT INTO config (property, value) values ('deviation_extreme', '5');
INSERT INTO config (property, value) values ('deviation_major', '4');
INSERT INTO config (property, value) values ('deviation_significant', '3');
INSERT INTO config (property, value) values ('deviation_minor', '2');

INSERT INTO config (property, value) values ('deviation_extreme_lambda', '1');
INSERT INTO config (property, value) values ('deviation_major_lambda', '0.5');
INSERT INTO config (property, value) values ('deviation_significant_lambda', '0.08333333333333333');
INSERT INTO config (property, value) values ('deviation_minor_lambda', '0.041666666666666664');
