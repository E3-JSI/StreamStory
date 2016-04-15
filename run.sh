#!/bin/bash

while true; do
	echo 'Running StreamStory ...'
	node main.js config/config-traffic-demo.json
	sleep 1
done
