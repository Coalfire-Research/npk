#! /bin/bash

PSCOUNT=`ps aux | grep hashcat | grep -v grep | wc -l`

if [[ "$PSCOUNT" == "0" ]]; then
	if [[ ! -f /root/deathrow ]]; then
		touch /root/deathrow
	else
		poweroff
	fi
else
	rm -f /root/deathrow
fi