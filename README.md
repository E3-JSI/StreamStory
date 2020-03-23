# StreamStory

## Installation

### Prerequisites

Before setting up StreamStory make sure the following dependencies are installed on your system:

- MySQL database
- Node.js 8 with NPM
- `node-gyp` which can be installed with `npm install -g node-gyp`
- `g++` 4.8 or 5
- openBLAS, lapack, lapacke which can be installed with `apt-get install libopenblas-dev liblapack-dev liblapacke-dev`

### Initialize the Database

StreamStory uses a MySQL database. First open MySQL and create the database with the following commands:
```
   CREATE DATABASE StreamStory;
   ALTER DATABASE StreamStory CHARACTER SET utf8 COLLATE utf8_general_ci;
   CREATE USER 'StreamStory'@'localhost' IDENTIFIED BY 'StreamStory';
   GRANT ALL PRIVILEGES ON StreamStory.* TO 'StreamStory'@'localhost';
```

Then initialize the tables with:
```
   cat init-tables.sql | mysql -u StreamStory -pStreamStory StreamStory
```

### Setup QMiner

```
   cd ..
   git clone https://github.com/lstopar/qminer.git
   cd qminer
   npm install
```

Then compile QMiner with:
```
   cd qminer
   node-gyp clean
   node-gyp configure -- -DLIN_ALG_BLAS=BLAS -DLIN_ALG_LAPACKE=LAPACKE -DLIN_ALG_LIB=-llapacke
   node-gyp build --jobs 20
```

### Setup StreamStory

Install the npm dependencies with:
```
   npm install
```

### Configure StreamStory

Place your configuration file in directory `config`. Here is an example configuration file:
```
{
    "qminer": {
        "path": "../qminer/",
        "mode": "createClean",
        "createPipeline": true,
        "initializeZeros": true
    },
    "server": {
        "port": 8465,
        "pingInterval": 10000
    },
    "log": {
        "logger": {
            "level": "debug",
            "outputMode": "short",
            "stream": {
                "type": "stdout",
                "file": "log.log"
            }
        },
        "print": {
            "rawData": 10000,
            "streamStory": 100,
            "stores": 100000,
            "broker": 1000,
            "coeff": 1000
        }
    },
    "database": {
        "host": "localhost",
        "user": "StreamStory",
        "password": "StreamStory",
        "database": "StreamStory"
    },
    "integration": {
        "type": "http",
        "brokerUrl": "koi15.fzi.de",
        "zookeperPort": 2181,
        "producerPort": 9092,
        "xauthentication": {
            "host": "192.168.84.46",
            "timeout": 10000
        }
    },
    "useCase": "mhwirth",
    "seed": 0,
    "saveStates": false,
    "saveActivities": false,
    "saveFriction": false,
    "restartOnReplay": false,
    "interpolation": "current",
    "dataPath": "/mnt/raidM2T/project-data/StreamStory-example/"
}
```

### Run StreamStory

To run StreamStory enter the `bin` directory and execute command `run-streamstory` with the appropriate
configuration file as the parameter. For instance:
```
   cd bin
   ./run-streamstory config/config-example.json
```
