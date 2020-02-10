FROM node:10

ENV http_proxy http://www-cache.rd.bbc.co.uk:8080
ENV https_proxy http://www-cache.rd.bbc.co.uk:8080

RUN useradd -u 997 -m jenkins
RUN mkdir /home/jenkins/.ssh
ADD .known_hosts /home/jenkins/.ssh/known_hosts
RUN apt-get -y update && apt-get -y install netcat-openbsd
