#!/bin/bash

function print_usage() {

    cat <<EOF
Usage:

  $ s-getcoll4project.sh <collOu> <collType> <projectId>

EOF
}

# check if necessary arguments are presented
if [ $# -ne 3 ]; then
    print_usage
    exit 1
fi

irule "uiFindCollection('organisationalUnit=${1}%type=${2}%state=EDITABLE%projectId=${3}', false, *out)" "null" "*out" | awk -F ' = ' '{print $2}'
