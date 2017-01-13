-- USE StreamStory;

CREATE TABLE user (
	email VARCHAR(100) PRIMARY KEY,
	passwd VARCHAR(128) NOT NULL,
	theme ENUM('dark', 'light') NOT NULL DEFAULT 'dark'
);

CREATE TABLE model (
	mid INT PRIMARY KEY AUTO_INCREMENT,
	name VARCHAR(100) NOT NULL,
	description VARCHAR(500),
	username VARCHAR(100) NOT NULL,
	model_file VARCHAR(255) NOT NULL UNIQUE,
	dataset VARCHAR(255) NOT NULL,
	is_realtime BOOLEAN NOT NULL DEFAULT 0,
	date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	is_public BOOLEAN NOT NULL DEFAULT 0,
	FOREIGN KEY (username) REFERENCES user(email)
);

CREATE TABLE offline_model (
	mid INT PRIMARY KEY,
	base_dir VARCHAR(255) NOT NULL,
	FOREIGN KEY (mid) REFERENCES model(mid)
);

CREATE TABLE online_model (
	mid INT PRIMARY KEY,
	is_active BOOLEAN NOT NULL DEFAULT 0,
	FOREIGN KEY (mid) REFERENCES model(mid)
);

CREATE TABLE state_properties (
	mid INT NOT NULL,
	sid INT NOT NULL,
	eventId VARCHAR(255),
	description VARCHAR(500),
	FOREIGN KEY (mid) REFERENCES model(mid),
	CONSTRAINT pk_state_properties PRIMARY KEY (mid,sid)
);

-- configuration of the friction coefficient
CREATE TABLE config (
	property VARCHAR(100) PRIMARY KEY,
	value VARCHAR(100) NOT NULL
);

-- insert values
INSERT INTO config (property, value) values ('calc_coeff', 'false');
INSERT INTO config (property, value) values ('deviation_extreme', '5');
INSERT INTO config (property, value) values ('deviation_major', '4');
INSERT INTO config (property, value) values ('deviation_significant', '3');
INSERT INTO config (property, value) values ('deviation_minor', '2');

INSERT INTO config (property, value) values ('deviation_extreme_lambda', '3.888');
INSERT INTO config (property, value) values ('deviation_major_lambda', '0.648');
INSERT INTO config (property, value) values ('deviation_significant_lambda', '0.1');
INSERT INTO config (property, value) values ('deviation_minor_lambda', '0.05');

-- FZI integration
CREATE TABLE pipelines (
    pid VARCHAR(255) NOT NULL,
    config TEXT NOT NULL,
    PRIMARY KEY (pid)
);
