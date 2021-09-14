FROM ubuntu:20.04

SHELL ["/bin/bash", "--login", "-c"]

RUN echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections

# Install base dependencies
RUN apt-get update && apt-get install -y -q --no-install-recommends \
        apt-transport-https \
        build-essential \
        ca-certificates \
        curl \
        git \
        libssl-dev \
        wget \
        nano \
        jq \
        npm \
        pwgen \
        unzip \
        less \
    && rm -rf /var/lib/apt/lists/*

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash

RUN . ~/.nvm/nvm.sh && \
    nvm install 14.15.4 && \
    nvm use 14.15.4

# Building Jsonnet
RUN mkdir build && \
    cd build && \
    wget https://github.com/google/jsonnet/releases/download/v0.17.0/jsonnet-bin-v0.17.0-linux.tar.gz && \
    tar -xf jsonnet-bin-v0.17.0-linux.tar.gz && \
    mv ./jsonnet /usr/bin/jsonnet && \
    mv ./jsonnetfmt /usr/bin/jsonnetfmt

## Installing AWS CLI
RUN cd build && \
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64-2.1.4.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    ./aws/install

# Installing terraform
RUN mkdir /build/terraform && \
    cd /build/terraform && \
    wget https://releases.hashicorp.com/terraform/0.15.5/terraform_0.15.5_linux_amd64.zip && \
    unzip terraform_0.15.5_linux_amd64.zip && \
    ln -s /build/terraform/terraform /usr/bin/terraform

RUN mkdir /npk
VOLUME /npk

RUN mkdir -p /root/.aws
VOLUME /root/.aws/

ENTRYPOINT [ "bash" ]