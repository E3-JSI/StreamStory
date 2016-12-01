FROM debian:jessie
MAINTAINER Luka Stopar <luka.stopar@ijs.si>

#==================================================
# VARIABLES
#==================================================

ENV MYSQL_ROOT_PASS root12
ENV NPM_VERSION 2.11.3
ENV NODE_GYP_VERSION 2.0.1
ENV GIT_BRANCH master

#==================================================
# CHECK INTERNET
#==================================================

# check if we have an internet connection
RUN echo 'Pinging DNS ...' && ping -c 2 8.8.8.8
RUN echo 'Pinging Google ...' && ping -c 2 216.58.213.36
RUN echo 'Pinging Google (by name) ...' && ping -c 2 www.google.com

#==================================================
# DEPENDENCIES
#==================================================

# install dependencies
RUN apt-get update && apt-get upgrade -y
RUN apt-get install -y python2.7
RUN apt-get install -y git
RUN apt-get install -y uuid-dev
RUN apt-get install -y libopenblas-dev
RUN apt-get install -y liblapacke
RUN apt-get install -y liblapacke-dev
RUN apt-get install -y curl
RUN apt-get install -y build-essential
RUN apt-get install -y libssl-dev

# install Node.js
RUN curl -sL https://deb.nodesource.com/setup_0.12 | bash -
RUN apt-get install -y nodejs

# downgrade npm
RUN npm update && \
	npm install -g npm@$NPM_VERSION
RUN npm install -g node-gyp@$NODE_GYP_VERSION

#==================================================
# CONFIGURE THE APP
#==================================================

# make the directory structure
RUN mkdir app

RUN echo 'refreshing qminer ...'
# QMINER
RUN cd app && \
	git clone https://github.com/lstopar/qminer.git && \
	cd qminer && \
	git checkout $GIT_BRANCH

# compile the projects
RUN cd app/qminer && \
	npm install
RUN cd app/qminer && \
	node-gyp clean && \
	node-gyp configure -- -DLIN_ALG_BLAS=BLAS -DLIN_ALG_LAPACKE=LAPACKE -DLIN_ALG_LIB=-llapacke && \
	node-gyp build --jobs 20

RUN echo 'Refreshing streamstory ...'

# STREAM STORY
RUN cd app && \
	git clone https://github.com/JozefStefanInstitute/StreamStory.git && \
	cd StreamStory && \
	git checkout $GIT_BRANCH && \
	npm install

RUN cd app && mkdir ss-db

# TODO remove
RUN which npm
RUN readlink /usr/bin/npm

#==================================================
# ENTRY POINT
#==================================================
EXPOSE 8080 
WORKDIR /app/StreamStory
CMD sleep 10 && ./run.sh /etc/streamstory/config-streamstory.json
