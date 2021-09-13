#!/bin/bash

docker build -t c6fc/npk:latest .
docker run -it -v `pwd`:/npk -v ~/.aws/:/root/.aws c6fc/npk:latest