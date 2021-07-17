# Inspired in https://andrewlock.net/packaging-cli-programs-into-docker-images-to-avoid-dependency-hell/
FROM alpine:3.10 as base

# Building Jsonnet
RUN mkdir /build && \
    cd build && \
    apk -v --no-cache add git make gcc g++ && \
    git clone --depth=1 https://github.com/google/jsonnet.git && \
    cd jsonnet && \
    rm -rf .git/ && \
    make && \
    apk -v --purge del git gcc && \
    ln -s /build/jsonnet/jsonnet /usr/bin/jsonnet && \
    ln -s /build/jsonnet/jsonnetfmt /usr/bin/jsonnetfmt

## Installing AWS CLI
RUN apk -v --no-cache add python py-pip groff less mailcap jq npm && \
    pip install --upgrade awscli s3cmd python-magic && \
    apk -v --purge del py-pip

# Installing terraform
RUN mkdir /build/terraform && \
    cd /build/terraform && \
    wget https://releases.hashicorp.com/terraform/0.11.15-oci/terraform_0.11.15-oci_linux_amd64.zip && \
    unzip terraform_0.11.15-oci_linux_amd64.zip && \
    ln -s /build/terraform/terraform /usr/bin/terraform

# Installing a text editor
RUN apk -v --no-cache add nano

FROM base AS npk
RUN mkdir /npk
WORKDIR /npk
ADD . /npk

RUN mkdir -p /root/.aws && \
    echo "[npk]" >> /root/.aws/credentials && \
    echo "aws_access_key_id = ..." >> /root/.aws/credentials && \
    echo "aws_secret_access_key = ..." >> /root/.aws/credentials && \
    cp /npk/terraform/npk-settings.json.sample /npk/terraform/npk-settings.json

ENTRYPOINT [ "sh" ]

# docker run -it npk:latest

# To run once inside the container:
# nano /root/.aws/credentials
# nano /npk/terraform/npk-settings.json
# cd /npk/terraform
# sh deploy.sh