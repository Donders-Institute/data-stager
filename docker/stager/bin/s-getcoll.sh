#!/bin/bash

function print_usage() {

    cat <<EOF
Gets collection detail.

Usage:

  $ s-getcoll.sh <collName>

EOF
}

# check if control file is given
if [ $# -ne 1 ]; then
    print_usage
    exit 1
fi

irule 'uiGetCollection(*kvstr, *out)' "*kvstr=collName=$1" "*out" | awk -F ' = ' '{$1=""; print}'
