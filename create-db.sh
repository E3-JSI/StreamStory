#!/bin/bash

DB_NAME=$1

if [[ $DB_NAME == "" ]]; then
    echo "usage: $0 \$DB_NAME"
    exit 1
fi


INIT_SQL="CREATE DATABASE $DB_NAME; ALTER DATABASE $DB_NAME CHARACTER SET utf8 COLLATE utf8_general_ci; GRANT ALL PRIVILEGES ON $DB_NAME.* TO 'StreamStory'@'localhost';"

echo 'Initializing database, please enter root password ...'
echo $INIT_SQL | mysql -u root -p

echo 'Initializing tables, please enter StreamStory password ...'
cat init-tables.sql | mysql -u StreamStory -p $DB_NAME
# INIT_TABLES="USE $DB_NAME; "`cat init-tables.sql`
# echo $INIT_TABLES
