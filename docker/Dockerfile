#FROM ubuntu:14.04
FROM debian:jessie
MAINTAINER Luka Stopar <luka.stopar@ijs.si>

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


# install MySQL
#RUN DEBIAN_FRONTEND=noninteractive && apt-get install -y mysql-server

# install Node.js
RUN curl -sL https://deb.nodesource.com/setup_4.x | bash -
RUN apt-get install -y nodejs

RUN npm update && npm install -g node-gyp
RUN echo `node -v`
RUN echo `node-gyp -v`

#==================================================
# CONFIGURE THE APP
#==================================================

# make the directory structure
RUN mkdir app

RUN cd app && \
	git clone https://github.com/JozefStefanInstitute/StreamStory.git && \
	cd StreamStory && \
	git checkout -b development && \
	npm install --loglevel info
RUN cd app && \
	git clone https://github.com/lstopar/qminer.git && \
	cd qminer && \
	git checkout -b development

# configure the database
RUN service mysql start && cd app/StreamStory && cat init.sql | mysql -u root

RUN echo `nodejs -v`
RUN echo `node-gyp -v`

# compile the projects
#RUN cd app/StreamStory && npm install
RUN cd app/qminer && npm install && node-gyp clean && node-gyp configure -- -DLIN_ALG_BLAS=BLAS -DLIN_ALG_LAPACKE=LAPACKE -DLIN_ALG_LIB=-llapacke && node-gyp build --verbose

RUN cd app && mkdir ss-db

EXPOSE 8483
VOLUME ["/config"]
CMD node
