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

# get the directory in which this script is located
cwd=$( get_script_dir $0 )

# update environment variables files with variables only available at runtime
if [ "$NODE_ENV" != "" ]; then
    echo "export NODE_ENV=${NODE_ENV}" >> ${cwd}/envvars
fi

# load environment variables
source ${cwd}/envvars
export PATH=$PYTHON_BINDIR:$PATH

# generate necessary configuration files for interfacing RDM services
${cwd}/config_stager.py --rdm_config ${cwd}/config/config.ini --irods_environment ${IRODS_ENVIRONMENT_FILE} 

if [ $? -ne 0 ]; then
    echo "fail generating stager config files" 1>&2
    exit 1
fi

# initiate the iRODS authentication token
/cron/renew_irods_token.sh

# prepare for PAM authentication for the stager local filesystem
ln -s /etc/pam.d/login /etc/pam.d/stager

# start the stager service
$NODEJS_PREFIX/bin/node stager.js
