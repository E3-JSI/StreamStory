#!/bin/bash

NODE_VERSION=0.11.14

sudo apt-get update

# install prereqisites
echo 'Installing prerequisites ...'
sudo apt-get install python2.7
sudo apt-get install git
sudo apt-get install mysql-server
sudo apt-get install uuid-dev
sudo apt-get install libopenblas-dev
sudo apt-get install liblapacke
sudo apt-get install liblapacke-dev
sudo apt-get install curl
sudo apt-get install build-essential
sudo apt-get install libssl-dev

# install NVM
echo 'Installing NVM ...'
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.26.1/install.sh | bash

# load NVM
CURR_DIR=`pwd`
cd ~
export NVM_DIR=`pwd`/.nvm
NVM_FILE=$NVM_DIR/nvm.sh
echo 'NVM file: '$NVM_FILE
if [ -s $NVM_FILE ]; then	
	echo 'Loading NVM ...'
	. $NVM_FILE	# This loads nvm
else
	echo 'NVM not installed, please contact the system administrator!'
	exit 1
fi
cd $CURR_DIR

# install Node.js
echo 'Installing node ...'
nvm install $NODE_VERSION
nvm use $NODE_VERSION
nvm alias default $NODE_VERSION

# install node-gyp
npm update
echo 'Installing node-gyp ...'
npm install -g node-gyp

# clone qminer and StreamStory
echo 'Cloning QMiner and StreamStory ...'
git clone https://github.com/lstopar/qminer.git
git clone https://github.com/JozefStefanInstitute/StreamStory.git

# build qminer
echo 'Building qminer ...'
cd qminer
echo 'Fetching dependencies ...'
npm install
echo 'Building ...'
node-gyp clean && node-gyp configure -- -DLIN_ALG_BLAS=BLAS -DLIN_ALG_LAPACKE=LAPACKE -DLIN_ALG_LIB=-llapacke
node-gyp --verbose build
cd ..

# install StreamStory dependencies and create the database
cd StreamStory
echo 'Fetching StreamStory dependencies ...'
npm install
echo 'Creating database ...'
echo 'Please enter MySQL root password:'
cat init.sql | mysql -u root -p
cd ..

echo 'Done!'


