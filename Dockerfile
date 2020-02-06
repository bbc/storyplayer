FROM node:10

ENV http_proxy http://www-cache.rd.bbc.co.uk:8080
ENV https_proxy http://www-cache.rd.bbc.co.uk:8080

RUN useradd -u 997 -m jenkins
RUN apt-get -y update && apt-get -y install netcat-openbsd
