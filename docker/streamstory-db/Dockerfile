FROM mysql:5.7
MAINTAINER Luka Stopar <luka.stopar@ijs.si>

ENV GIT_BRANCH master

RUN apt-get update && apt-get install -y git

RUN git clone https://github.com/JozefStefanInstitute/StreamStory.git
RUN cd StreamStory && \
	git fetch && \
	git checkout $GIT_BRANCH
RUN cd StreamStory && \
    cp init-tables.sql /docker-entrypoint-initdb.d/init.sql
