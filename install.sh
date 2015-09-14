#!/bin/bash

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

# install node
echo 'Installing Node.js ...'
if [ `type -t nvm` == 'function' ]; then
	echo 'NVM already installed!'
else
	echo 'Installing NVM ...'
	#curl https://raw.githubusercontent.com/creationix/nvm/v0.16.1/install.sh | sh
	curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.26.1/install.sh | bash
	source ~/.profile
fi

echo 'Installing node ...'
nvm install 0.11.14
nvm use 0.11.14

# install npm
npm update

echo 'Cloning QMiner and StreamStory ...'
# clone qminer and StreamStory
git clone https://github.com/lstopar/qminer.git
git clone https://github.com/JozefStefanInstitute/StreamStory.git

echo 'Building qminer ...'
# build qminer
cd qminer
node-gyp clean && node-gyp configure -- -DLIN_ALG_BLAS=BLAS -DLIN_ALG_LAPACKE=LAPACKE -DLIN_ALG_LIB=-llapacke
node-gyp --verbose build
npm install
cd ..

# create the database
echo 'Creating database. Please enter your MySQL root password'
cd StreamStory
cat init.sql | mysql -u root -p
npm install
cd ..

echo 'Done!'


