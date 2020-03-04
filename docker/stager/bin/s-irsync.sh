#!/bin/bash

function print_usage() {

    cat <<EOF
Usage:

  $ s-irsync.sh <srcPath> <dstPath> <irodsUserName> <irodsA>

  - srcPath:       the source location, use "irods:" prefix to indicate it's an iRODS path
  - dstPath:       the target location, use "irods:" prefix to indicate it's an iRODS path
  - irodsUserName: the iRODS username 
  - irodsA:        the path of the .irodsA file in which a scrambled password is stored

EOF
}

function get_script_dir() {

    ## resolve the base directory of this executable
    local SOURCE=$1
    while [ -h "$SOURCE" ]; do
        # resolve $SOURCE until the file is no longer a symlink
        DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
        SOURCE="$(readlink "$SOURCE")"

        # if $SOURCE was a relative symlink,
        # we need to resolve it relative to the path
        # where the symlink file was located

        [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
    done

    echo "$( cd -P "$( dirname "$SOURCE" )" && pwd )"
}

# check if control file is given
if [ $# -ne 4 ]; then
    print_usage
    exit 1
fi

mydir=$( get_script_dir $0 )
src=$( echo $1 | sed 's/irods:/i:/g' )
dst=$( echo $2 | sed 's/irods:/i:/g' )

# set iRODS environment variables
export IRODS_USER_NAME=$3
export IRODS_AUTHENTICATION_FILE=$4

${mydir}/isync ${src} ${dst}

return $?
