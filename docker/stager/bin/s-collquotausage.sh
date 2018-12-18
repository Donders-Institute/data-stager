#!/bin/bash

function print_usage() {

    cat <<EOF
Gets quota utilisation fraction (between 0. and 1.) of a collection.

Usage:

  $ s-collquotausage.sh <collName>

EOF
}

# check if control file is given
if [ $# -ne 1 ]; then
    print_usage
    exit 1
fi

read -r -d '' pyscript <<- EOF
import sys,json
coll = json.load(sys.stdin)['collection']
q = int(coll['quotaInBytes'])
u = int(coll['sizeInBytes'])
print (1.*u)/q
EOF

irule 'uiGetCollection(*kvstr, *out)' "*kvstr=collName=$1" "*out" | awk -F ' = ' '{print $2}' | python -c "$pyscript"
