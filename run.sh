#!/bin/bash

export OMP_STACKSIZE=16M

while true; do
	echo 'Running StreamStory ...'
	node main.js config/config-release.json
done
