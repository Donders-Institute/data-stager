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

# load environment variables
cwd=$( get_script_dir $0 )
source ${cwd}/envvars
export PATH=$PYTHON_BINDIR:$PATH

# generate necessary configuration files for interfacing RDM services
${cwd}/config_stager.py --rdm_config ${cwd}/config/config.ini --irods_environment ${IRODS_ENVIRONMENT_FILE} 

if [ $? -ne 0 ]; then
    echo "fail generating stager config files" 1>&2
    exit 1
fi

# initialise iRODS authN token for iCommands
cfg=default.json
if [ "$NODE_ENV" != "" ]; then
    cfg=${NODE_ENV}.json
fi

python -c "import json; c = json.load(open('config/${cfg}')); print(c['RDM']['userPass'])" | iinit

# prepare for PAM authentication
ln -s /etc/pam.d/login /etc/pam.d/stager

$NODEJS_PREFIX/bin/node stager.js
