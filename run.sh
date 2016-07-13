#!/bin/bash

CONF_FILE=$1

while true; do
	echo 'Running StreamStory ...'
	node main.js $CONF_FILE
	sleep 1
done
