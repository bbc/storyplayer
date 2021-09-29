FROM node:12.18

RUN apt-get -y update && apt-get -y install netcat-openbsd

ENV HOME /var/tmp/jenkins
ARG USERID

RUN echo "UID is $USERID"
# UID 997 is the norm for Jenkins
RUN useradd -u $USERID -md $HOME jenkins
RUN chmod -R a+rw $HOME
USER jenkins

RUN mkdir $HOME/.ssh
ADD known_hosts $HOME/.ssh/known_hosts
