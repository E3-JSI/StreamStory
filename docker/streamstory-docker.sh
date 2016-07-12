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


case $1 in
	run)
		echo 'Running StreamStory ...'
		docker run --name $SS_CONTAINER_NAME -p $APP_PORT:8080 -v $CONFIG_PATH:/etc/streamstory -v $DATABASE_STORAGE:/var/lib/mysql $SS_CONTAINER
		;;
	stop)
		echo 'Stopping StreamStory ...'
		docker stop $SS_CONTAINER_NAME
		echo 'Stopping database ...'
		docker stop $MYSQL_CONTAINER_NAME
		echo 'Done!'
		;;
	configure)
		echo 'Starting database ...'
		docker run --name $MYSQL_CONTAINER_NAME -p $MYSQL_PORT:3306 -v $DATABASE_STORAGE:/var/lib/mysql -e MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWD -e MYSQL_USER=$MYSQL_USER -e MYSQL_PASSWORD=$MYSQL_PASSWORD -e MYSQL_DATABASE=$MYSQL_DATABASE -d $MYSQL_CONTAINER --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
		
		echo 'Sleeping for 20 seconds while the container initializes ...'
		sleep 20

		echo 'Running containers:'
		docker ps

		echo 'Configuring schema ...'
		docker exec $MYSQL_CONTAINER_NAME sh -c 'cat StreamStory/init-tables.sql | mysql -u root -p'$MYSQL_ROOT_PASSWD' '$MYSQL_DATABASE

		echo 'Done!'
		;;
	build)
		echo 'Building StreamStory ...'
		docker build -t $MYSQL_CONTAINER mysql/
		docker build -t $SS_CONTAINER .
		;;
	enter)
		case $2 in
			database)
				docker exec -it $MYSQL_CONTAINER_NAME bash
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
		echo 'Usage: streamstory-docker.sh run|stop|build|configure|delete|enter|database|deletedb'
		;;
esac

#docker run --name some-mysql -e MYSQL_ROOT_PASSWORD=my-secret-pw -d mysql:tag --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
