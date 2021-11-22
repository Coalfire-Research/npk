#!/bin/bash

if [[ $UID -eq 0 ]]; then
	echo "[!] This script isn't meant to be run as root."
	echo "If you get an error about your AWS profile not being found,"
	echo "re-run this command as yourself WITHOUT sudo."
	pause
fi

docker build --platform linux/x86_64 -t c6fc/npk:latest --build-arg user=$(whoami) --build-arg uid=$UID .
docker run --platform linux/x86_64 -it --user $(whoami) -v `pwd`:/home/$(whoami)/npk -v ~/.aws/:/home/$(whoami)/.aws -v /etc/passwd:/etc/passwd c6fc/npk:latest
