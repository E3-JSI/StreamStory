FROM debian:jessie
MAINTAINER Luka Stopar <luka.stopar@ijs.si>

# VARIABLES
ENV MYSQL_ROOT_PASS root12
ENV NPM_VERSION 2.11.3
ENV NODE_GYP_VERSION 2.0.1
ENV GIT_BRANCH development

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

# downgrade gcc and g++
#RUN add-apt-repository ppa:ubuntu-toolchain-r/test && apt-get update
#RUN apt-get install gcc-4.7 g++-4.7
#RUN update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-4.9 60 --slave /usr/bin/g++ g++ /usr/bin/g++-4.9
#RUN update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-4.7 40 --slave /usr/bin/g++ g++ /usr/bin/g++-4.7

#RUN `echo g++ -v` 


# install MySQL
#RUN echo $MYSQL_ROOT_PASS
#RUN echo 'mysql-server mysql-server/root_password_again password '$MYSQL_ROOT_PASS
#RUN debconf-set-selections << 'mysql-server mysql-server/root_password password '$MYSQL_ROOT_PASS
#RUN debconf-set-selections << 'mysql-server mysql-server/root_password_again password '$MYSQL_ROOT_PASS
#RUN export DEBIAN_FRONTEND="noninteractive" && apt-get install -y mysql-server

# install Node.js
RUN curl -sL https://deb.nodesource.com/setup_0.12 | bash -
RUN apt-get install -y nodejs

# downgrade npm
RUN npm update && \
	npm install -g npm@$NPM_VERSION
RUN npm install -g node-gyp@$NODE_GYP_VERSION

RUN echo `node -v`
RUN echo `npm -v`
RUN echo `node-gyp -v`

#==================================================
# CONFIGURE THE APP
#==================================================

# make the directory structure
RUN mkdir app
RUN cd app && \
	git clone https://github.com/JozefStefanInstitute/StreamStory.git && \
	cd StreamStory && \
	git checkout -b $GIT_BRANCH && \
	npm install
RUN cd app && \
	git clone https://github.com/lstopar/qminer.git && \
	cd qminer && \
	git checkout -b $GIT_BRANCH

# configure the database
#RUN service mysql start && \
#	cd app/StreamStory && \
#	cat init.sql | mysql -u root

# compile the projects
RUN cd app/qminer && npm install && node-gyp clean && node-gyp configure -- -DLIN_ALG_BLAS=BLAS -DLIN_ALG_LAPACKE=LAPACKE -DLIN_ALG_LIB=-llapacke && node-gyp build --verbose

RUN cd app && mkdir ss-db

RUN ls -al app/StreamStory/node_modules

#==================================================
# ENTRY POINT
#==================================================
#VOLUME ["/var/lib/mysql"]
EXPOSE 8283
WORKDIR /app/StreamStory
CMD node main.js /etc/streamstory/config-streamstory.json
