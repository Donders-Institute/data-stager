#!/bin/bash

function print_usage() {

    cat <<EOF
Usage:

  $ s-iinit.sh <rdmUser> <rdmPass>

EOF
}

if [ $# -ne 2 ]; then
    print_usage
    exit 1
fi

u=$1
p=$2

export IRODS_AUTHENTICATION_FILE=/tmp/.irodsA.${u}
export IRODS_USER_NAME=$u

echo ${p} | iinit >> /tmp/.irodsA.${u}.log 2>&1

if [ $? -ne 0 ]; then
    echo 'init failure' 1>&2
    exit 1
else
    echo $IRODS_AUTHENTICATION_FILE
fi
