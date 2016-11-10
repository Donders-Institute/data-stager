#!/bin/bash

function print_usage() {

    cat <<EOF
Usage:

  $ s-otp.sh <rdmUser>

EOF
}

# check if control file is given
if [ $# -ne 1 ]; then
    print_usage
    exit 1
fi

irule 'uiGetUserNextHOTP(*userName, *out)' "*userName=$1" "*out" | awk -F ' = ' '{print $2}' | python -c "import sys, json; print json.load(sys.stdin)['otp']; "
