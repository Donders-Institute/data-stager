#!/bin/bash

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

# temporarily disable check on self-signed certificate until
# webdav-fs module supports it, see issue: 
# https://github.com/perry-mitchell/webdav-fs/issues/54
#
# TODO: replace it with trusting the self-signed certificate
export NODE_TLS_REJECT_UNAUTHORIZED=0

export PATH=${NODEJS_PREFIX}/bin:$PATH && npm start
