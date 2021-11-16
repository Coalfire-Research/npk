FROM ubuntu:20.04

SHELL ["/bin/bash", "--login", "-c"]

RUN echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections

# Install base dependencies
RUN apt-get update && apt-get install -y -q --no-install-recommends \
        apt-transport-https \
        build-essential \
        cmake \
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

## Installing AWS CLI
RUN mkdir /opt/build && \
    cd /opt/build && \
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64-2.1.4.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    ./aws/install

ARG user=
ARG uid=

RUN groupadd -g ${uid} ${user} && \
    useradd -u ${uid} -g ${user} -s /bin/sh -m ${user}

USER ${uid}:${uid}

RUN mkdir /home/${user}/npk
VOLUME /home/${user}/npk

WORKDIR /home/${user}/

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash

RUN . ~/.nvm/nvm.sh && \
    nvm install 17 && \
    nvm use 17

RUN mkdir -p /home/${user}/.aws
VOLUME /home/${user}/.aws/

WORKDIR /home/${user}/npk/terraform
ENTRYPOINT [ "bash" ]