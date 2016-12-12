#!/bin/bash

ssh -f proasense@192.168.84.42 -L 8685:192.168.84.42:8080 -N
