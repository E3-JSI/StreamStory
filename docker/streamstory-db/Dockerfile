FROM mysql:5.7
MAINTAINER Luka Stopar <luka.stopar@ijs.si>

ENV GIT_BRANCH master

RUN apt-get update && apt-get install -y git

RUN git clone https://github.com/JozefStefanInstitute/StreamStory.git
RUN cd StreamStory && \
	git fetch --all && \
	git checkout $GIT_BRANCH
RUN apt-get install -y vim

RUN echo 'blabla'
RUN echo 'Hello my friend'

RUN cd StreamStory && \
    cat init-db.sql > /docker-entrypoint-initdb.d/init.sql && \
    cat init-tables.sql >> /docker-entrypoint-initdb.d/init.sql
