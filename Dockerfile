# Inspired in https://andrewlock.net/packaging-cli-programs-into-docker-images-to-avoid-dependency-hell/
FROM alpine:3.10

# Building Jsonnet
RUN mkdir /build && \
    cd build && \
    apk -v --no-cache add git make gcc g++ && \
    git clone https://github.com/google/jsonnet.git && \
    cd jsonnet && \
    make && \
    apk -v --purge del git gcc && \
    ln -s /build/jsonnet/jsonnet /usr/bin/jsonnet && \
    ln -s /build/jsonnet/jsonnetfmt /usr/bin/jsonnetfmt

## Installing AWS CLI
RUN apk -v --no-cache add python py-pip groff less mailcap && \
    pip install --upgrade awscli s3cmd python-magic && \
    apk -v --purge del py-pip && \
    ## Installing other dependencies
    apk -v --no-cache add jq npm pwgen bash

# Installing terraform
RUN mkdir /build/terraform && \
    cd /build/terraform && \
    wget https://releases.hashicorp.com/terraform/0.11.15/terraform_0.11.15_linux_amd64.zip && \
    unzip terraform_0.11.15_linux_amd64.zip && \
    ln -s /build/terraform/terraform /usr/bin/terraform

# Installing a text editor
RUN apk -v --no-cache add nano

RUN mkdir /npk
VOLUME /npk

RUN mkdir -p /root/.aws
VOLUME /root/.aws/

ENTRYPOINT [ "bash" ]