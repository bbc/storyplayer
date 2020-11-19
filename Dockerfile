FROM node:10.20

ENV http_proxy http://www-cache.rd.bbc.co.uk:8080
ENV https_proxy http://www-cache.rd.bbc.co.uk:8080

RUN apt-get -y update && apt-get -y install netcat-openbsd

ENV HOME /var/tmp/jenkins
RUN useradd -u 997 -md $HOME jenkins
USER jenkins

RUN mkdir $HOME/.ssh
ADD .known_hosts $HOME/.ssh/known_hosts
