#!/bin/bash

function print_usage() {

    cat <<EOF
Usage:

  $ s-iinit.sh <rdmUser> <rdmPass> [<rdmTargetUser>]

EOF
}

if [ $# -lt 2 ]; then
    print_usage
    exit 1
fi

u=$1
p=$2

# optional argument for target user (in this case, `u` and `p` are for the proxy user)
tu=$u
[ $# -eq 3 ] && tu=$3

export IRODS_AUTHENTICATION_FILE=/tmp/.irodsA.${tu}
export IRODS_USER_NAME=$u

echo ${p} | iinit >> /tmp/.irodsA.${tu}.log 2>&1

if [ $? -ne 0 ]; then
    echo 'init failure' 1>&2
    exit 1
else
    echo $IRODS_AUTHENTICATION_FILE
fi
