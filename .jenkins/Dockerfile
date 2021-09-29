FROM node:12.18

RUN apt-get -y update && apt-get -y install netcat-openbsd

ENV HOME /var/tmp/jenkins

# UID 997 is the norm for Jenkins
RUN useradd -u 999 -md $HOME jenkins
RUN chmod -R a+rw /var/tmp/jenkins
USER jenkins

RUN mkdir $HOME/.ssh
ADD known_hosts $HOME/.ssh/known_hosts
