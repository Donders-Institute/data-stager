#!/bin/bash

function print_usage() {

    cat <<EOF
Gets collection detail.

Usage:

  $ s-getcoll.sh <DR collection or data namespace>

EOF
}

# check if control file is given
if [ $# -ne 1 ]; then
    print_usage
    exit 1
fi

# the command below uses iCAT-side rules to resolve given path to a valid DR collection; and retrieve the attributes of the collection.
irule 'rdmGetRDMCollection(*path, "null", *coll); uiGetCollection("collName="++*coll, *out)' "*path=$1" "*out" | awk -F ' = ' '{$1=""; print}'
