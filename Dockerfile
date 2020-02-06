FROM node:10

RUN useradd -u 997 -m jenkins
RUN apt-get -y update && apt-get -y install netcat-openbsd
