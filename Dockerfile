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
    apk -v --no-cache add jq npm

# Installing terraform
RUN mkdir /build/terraform && \
    cd /build/terraform && \
    wget https://releases.hashicorp.com/terraform/0.11.15-oci/terraform_0.11.15-oci_linux_amd64.zip && \
    unzip terraform_0.11.15-oci_linux_amd64.zip && \
    ln -s /build/terraform/terraform /usr/bin/terraform

# Installing a text editor
RUN apk -v --no-cache add nano

RUN mkdir /npk
WORKDIR /npk
ADD . /npk

RUN mkdir -p /root/.aws
RUN echo "[npk]" >> /root/.aws/credentials
RUN echo "aws_access_key_id = ..." >> /root/.aws/credentials
RUN echo "aws_secret_access_key = ..." >> /root/.aws/credentials
RUN cp /npk/terraform/npk-settings.json.sample /npk/terraform/npk-settings.json

ENTRYPOINT [ "sh" ]

# docker run -it npk:latest

# To run once inside the container:
# nano /root/.aws/credentials
# nano /npk/terraform/npk-settings.json
# cd /npk/terraform
# sh deploy.sh