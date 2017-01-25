#!/bin/bash

function print_usage() {

    cat <<EOF
Usage:

  $ s-getuserprofile.sh <userName>

EOF
}

# check if necessary arguments are presented
if [ $# -ne 1 ]; then
    print_usage
    exit 1
fi

irule "uiGetUser('${1}', *out)" "null" "*out" | awk -F ' = ' '{print $2}'
