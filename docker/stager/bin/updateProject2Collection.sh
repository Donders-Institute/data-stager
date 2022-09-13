#!/bin/bash -x
###################################################################
# This script updates the project2collection.json file (static part
# of the project to collection resolution), using the data retrieved
# from the online PPM form's API:
#
#    /api/RepositoryCollections?organizationalUnit={OU}
#
# Requirements:
#   - jq
#   - curl
#
##################################################################

if [ -z ${PROJECT_FORM_API_SERVER:+x} ]; then
    >&2 echo "Warning: PROJECT_FORM_API_SERVER variable was not set."
fi

if [ -z ${AUTH_SERVER:+x} ]; then
    >&2 echo "Error: AUTH_SERVER variable must be set."
    exit 1
fi

if [ -z ${AUTH_CLIENT_ID:+x} ]; then
    >&2 echo "Error: AUTH_CLIENT_ID variable must be set."
    exit 1
fi

if [ -z ${AUTH_CLIENT_SECRET:+x} ]; then
    >&2 echo "Error: AUTH_CLIENT_SECRET variable must be set."
    exit 1
fi

function request_token() {
    local response token expires

    token_cache=/tmp/.pdb_token_$(whoami)

    if [[ -f ${token_cache} ]]; then
        if read -r expires token < ${token_cache}; then
            if [[ "$(date '+%s')" < "$expires" ]]; then
                >&2 echo "Using cached access token."
                echo -n "$token"
                return 0
            fi
        fi
        rm -f ${token_cache} 
    fi

    >&2 echo "Requesting new access token."

    response="$(curl -sSf \
        -X POST \
        -H 'Content-Type: application/x-www-form-urlencoded' \
        --data-urlencode 'grant_type=client_credentials' \
        --data-urlencode "client_id=${AUTH_CLIENT_ID}" \
        --data-urlencode "client_secret=${AUTH_CLIENT_SECRET}" \
        --data-urlencode 'scope=urn:dccn:project-proposal:collections' \
        "${AUTH_SERVER}/connect/token")"

    token="$(echo -n "$response" | jq -r '.access_token')"
    expires="$(echo -n "$response" | jq -r 'now + .expires_in | floor')"

    echo "$expires" "$token" > ${token_cache} 

    echo -n "$token"
}


function project2collection() {

    [ $# -lt 1 ] && echo "missing token" && return 1

    endpoint="${PROJECT_FORM_API_SERVER}/api/RepositoryCollections"
    if [ $# -gt 1 ]; then
        endpoint="${endpoint}?organizationalUnit=${2}"
    fi

    result="$(curl -sS \
        -X GET "$endpoint" \
        -H 'Content-Type: application/json' \
        -H "Authorization: Bearer $token" \
        -w '\n%{content_type}\n%{http_code}')"

    readarray -t result <<< "$result"

    status="${result[-1]}"
    content_type="${result[-2]}"
    result="${result[@]::${#result[@]}-2}"

    if [[ "$content_type" != application/json* ]]; then
        case "$status" in
            401) >&2 echo "Error: authentication failed.";;
            *) >&2 echo "Error: server returned status code $status.";;
        esac

        return 1
    fi

    echo ${result}
}

function usage {
    	cat - <<EOF

Updating data stager's project2collection.json file with static mapping, using
the project-form's API.

Usage: $(basename $0) [OPTIONS]

Options are:
   -c      Specify the path of the project2collection.json file.
   -o      Specify the organizational unit of the collections.
   -t      Toggle test run without actually updating the project2collection.json file.
Informational options:
   -h      Display this help message.
EOF
}

##############################################################################
# main program 
##############################################################################
dryrun=0                     # no dryrun 
fmap=project2collection.json # default map path
while getopts ":htc:o:" opt; do
    case ${opt} in
    h)
      usage
      exit 0
      ;;
    c)
      fmap=$OPTARG
      ;;
    o)
      ou=$OPTARG
      ;;
    t)
      dryrun=1
      ;;
    ? | *)
      echo "ERROR: invalid option: -${OPTARG}." >&2 && usage && exit 1
      ;;
    esac
done

# check if $fmap exists
[ ! -f $fmap ] && echo "file not found: $fmap" >&2 && exit 2

# fetch valid access token
token=$(request_token)
[ $? -ne 0 ] && exit 2

# call project-form API and update the mapping
tab=$(cat $fmap)
for l in $(project2collection "$token" "$ou" | jq '.[] | "\(.project):\(.id)"' | sed 's/"//g'); do
    prj=$(echo $l | awk -F ':' '{print $1}')
    col="/nl.ru.donders/"$(echo $l | awk -F ':' '{print $2}' | sed 's|\.|/|1' | sed 's|\.|/|1')
    tab=$(echo $tab | jq --arg prj ${prj} --arg col ${col} ". * {DAC: {\"$prj\": \$col}}")
done

if [ $dryrun -eq 1 ]; then
    # print new table to stdout
    echo $tab | jq
else
    # backup current table and update it with new one
    cp $fmap $fmap.prev
    echo $tab | jq > $fmap
fi
