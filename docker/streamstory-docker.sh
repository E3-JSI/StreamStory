#!/bin/bash

USR=proasense

APP_PORT=8283
MYSQL_PORT=3308
DOCKER_IP=172.17.0.1

CONFIG_PATH=/mnt/raidM2T/project-data/config
DATABASE_STORAGE=/mnt/docker-mysql

# containers
SS_CONTAINER=$USR/streamstory
SS_CONTAINER_NAME=streamstory
MYSQL_CONTAINER=$USR/mysql
MYSQL_CONTAINER_NAME=streamstory-mysql

MYSQL_ROOT_PASSWD=root12
MYSQL_USER=StreamStory
MYSQL_PASSWORD=StreamStory
MYSQL_DATABASE=StreamStory

function start {
	if [ "`docker inspect -f {{.State.Running}} $MYSQL_CONTAINER_NAME`" = "false" ]; then
		echo 'Starting database ...'
		docker start $MYSQL_CONTAINER_NAME
	fi
	echo 'Starting StreamStory ...'
	docker start $SS_CONTAINER_NAME
}

function run_db {
	echo 'Running database ...'
	docker run --name $MYSQL_CONTAINER_NAME -p $MYSQL_PORT:3306 -v $DATABASE_STORAGE:/var/lib/mysql -e MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWD -e MYSQL_USER=$MYSQL_USER -e MYSQL_PASSWORD=$MYSQL_PASSWORD -e MYSQL_DATABASE=$MYSQL_DATABASE -d $MYSQL_CONTAINER --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
}

function run {
	RUNNING=$(docker inspect -f {{.State.Running}} $MYSQL_CONTAINER_NAME 2> /dev/null)
	if [ $? -eq 1 ]; then
		run_db
	fi
	echo 'Running StreamStory ...'
	docker run --name $SS_CONTAINER_NAME --link $MYSQL_CONTAINER_NAME:$MYSQL_CONTAINER_NAME -p $APP_PORT:8080 -v $CONFIG_PATH:/etc/streamstory -v $DATABASE_STORAGE:/var/lib/mysql $SS_CONTAINER
}

function stop {
	echo 'Stopping StreamStory ...'
	docker stop $SS_CONTAINER_NAME
	echo 'Stopping database ...'
	docker stop $MYSQL_CONTAINER_NAME
	echo 'Done!'
}

function configure {
	run_db
	
	WAIT_TM=20

	echo 'Sleeping for '$WAIT_TM' seconds while the container initializes ...'
	sleep $WAIT_TM

	echo 'Running containers:'
	docker ps

	echo 'Configuring database schema ...'
	docker exec $MYSQL_CONTAINER_NAME sh -c 'cat StreamStory/init-db.sql | mysql -u root -p'$MYSQL_ROOT_PASSWD' '$MYSQL_DATABASE
	docker exec $MYSQL_CONTAINER_NAME sh -c 'cat StreamStory/init-tables.sql | mysql -u root -p'$MYSQL_ROOT_PASSWD' '$MYSQL_DATABASE

	echo 'Done!'
}

function build {
	echo 'Building StreamStory ...'
	docker build -t $MYSQL_CONTAINER mysql/
	docker build -t $SS_CONTAINER .
}

case $1 in
	run)
		run
		;;
	start)
		start
		;;
	stop)
		stop
		;;
	configure)
		configure
		;;
	build)
		build
		;;
	enter)
		case $2 in
			database)
				docker exec -it $MYSQL_CONTAINER_NAME bash
				;;
			streamstory)
				docker exec -it $SS_CONTAINER_NAME bash
				;;
			*)
				echo 'Cannot enter container '$2
				;;
		esac
		;;
	database)
		mysql -h $DOCKER_IP -P $MYSQL_PORT -u root -p$MYSQL_ROOT_PASSWD $MYSQL_DATABASE
		;;
	deletedb)
		docker rm -f $MYSQL_CONTAINER_NAME
		;;
	delete)
		docker rm -f $SS_CONTAINER_NAME
		docker rm -f $MYSQL_CONTAINER_NAME
		;;
	*)
		echo 'Usage: streamstory-docker.sh start|stop|build|configure|delete|enter|database|deletedb'
		;;
esac
