#!/bin/bash

function print_usage() {

    cat <<EOF
Usage:

  $ s-irsync.sh <src> <dst> <rdmUser> <rdmPass>

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

# wrapper function for parallel to call for file transfer
function file_transfer() {
    _cmd=$1
    _s=$2
    _t=$3

    $_cmd -f $_s $_t

    ec=$?
    echo $4
    return $ec
}
export -f file_transfer

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

w_total=0

# check source type/existence
is_src_irods=0
is_src_dir=0
echo $src | egrep '^i:' > /dev/null 2>&1
if [ $? -eq 0 ]; then
    is_src_irods=1
    src_coll=$( echo $src | sed 's/^i://' | sed 's/\/$//' )
    ils "$src_coll" > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo "file or collection not found: $src_coll" 1>&2
        exit 1
    fi

    # TODO: find a better way to determine the source is a collection or a data object
    ils "${src_coll}/" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        is_src_dir=1
        # determine size of the sync task: number of data objects in the source collection
        w_total=$( iquest --no-page "n=%s" "select UNIQUE(DATA_NAME) where COLL_NAME = '${src_coll}'" | grep 'n=' | wc -l )
        w_total=$(( $w_total + $(iquest --no-page "n=%s" "select UNIQUE(DATA_NAME) where COLL_NAME like '${src_coll}/%'" | grep 'n=' | wc -l) ))
    else
        w_total=1
    fi
else
    if [ -e "$src" ]; then
        if [ -d "$src" ]; then
            is_src_dir=1
            # determine size of the sync task: number of files in the directory
            w_total=$( find "$src" -type f | wc -l )
        else
            w_total=1
        fi
    else
        echo "file or directory not found: $src" 1>&2
        exit 1
    fi
fi

## prepare destination directory/collection
is_dst_irods=0
is_dst_dir=0

echo $dst | egrep '^i:' > /dev/null 2>&1
if [ $? -eq 0 ]; then
    is_dst_irods=1
    dst_coll=$( echo $dst | sed 's/^i://' )
    # TODO: find a better way to determine whether the irods namespace is existing and whether it's a directory
    ils "${dst_coll}" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        ils "${dst_coll}/" > /dev/null 2>&1
        # this is an existing irods collection
        if [ $? -eq 0 ]; then
            is_dst_dir=1
        fi
    elif [ "${dst_coll: -1}" == "/" ]; then
        # if the given $dst_coll doesn't exist, and it ends with '/'; it's taken as a directory to be created
        is_dst_dir=1
    else
        # the namespace doesn't exist at all, whether it should be a directory is determined by is_src_dir
        is_dst_dir=$is_src_dir
    fi
else
    if [ -e "$dst" ]; then
        if [ -d "$dst" ]; then
            is_dst_dir=1
        fi
    else
        is_dst_dir=$is_src_dir
    fi
fi

if [ $is_src_dir -eq 1 ] && [ $is_dst_dir -ne 1 ] ; then
    echo "cannot rsync directory into file: $src -> $dst" 1>&2
    exit 1
fi

# make sure the dst_dir is created
if [ $is_dst_dir -eq 1 ]; then
    if [ $is_dst_irods -eq 1 ]; then
        imkdir -p "$( echo $dst | sed 's/^i://' )" > /dev/null 2>&1
    else
        mkdir -p "${dst}"
    fi
fi

# reconstruct the dst w/ proper filename
if [ $is_src_dir -eq 0 ] && [ $is_dst_dir -eq 1 ] ; then
    fname=$( echo "$src" | awk -F '/' '{print $NF}' )
    dst=${dst}/${fname}
fi

# run irsync
if [ $w_total -gt 0 ]; then

    # transferring files
    w_done=0
    w_done_percent=0
    ec=0
    nf_threashold=200000

    # log files
    flist=/tmp/files2sync_$$.txt
    flog=/tmp/files2sync_$$.log

    # make sure flog and flist are new
    if [ -f $flog ]; then
        rm -f $flog
    fi
        
    if [ -f $flist ]; then
        rm -f $flist
    fi
    
    if [ $w_total -lt $nf_threashold ]; then
        # small dataset with files less than 200,000
        ${mydir}/s-unbuffer irsync -v -K -r "${src}" "${dst}" | while read -r line; do

            if [[ $line == *"ERROR:"* ]]; then
                # return the whole line containing the ERROR: string
                echo "error:${line}"
            else
                w_done=$(( $w_done + 1 ))
                w_done_percent=$(( $w_done * 100 / $w_total ))

                # the process is still running, therefore the progress should not exceed 99%
                if [ $w_done -ge $w_total ] || [ $w_done_percent -ge 100 ]; then
                    w_done=$(( $w_total - 1 ))
                    w_done_percent=99
                fi

                # print current progress
                echo "progress:${w_done_percent}:${w_done}:${w_total}"
            fi
        done
        # catch the exit code of the actual irsync command
        ec=${PIPESTATUS[0]}
    else
        # more scalable approach for dataset containing massive amount of files
        # scan files to be synchronised
        w_skipped=0
	${mydir}/s-unbuffer irsync -v -l -r "${src}" "${dst}" 2>/dev/null | grep '^ ' | while read -r line; do
	    ## faking the w_done so that the progress remains at 10% maximum with frequent job progress update
            w_done=$(( ($w_done + 1) / 10 ))
            w_done_percent=$(( $w_done * 100 / $w_total ))
            echo "progress:${w_done_percent}:${w_done}:${w_total}"

            ## keep file to be transferred in the flist
            echo $line | grep ' --- a match no sync required' >/dev/null 2>&1
	    if [ $? -ne 0 ]; then
                echo $line >> $flist
            else
                w_skipped=$(( $w_skipped + 1 ))
            fi
        done

        # remove the heading 'i:' indicating the iRODS endpoint
        dst=$( echo $dst | sed 's/^i://g' )
        src=$( echo $src | sed 's/^i://g' )

        # create each sub-directories in the destination location
        for d in $( cat ${flist} | sed "s|${src}|${dst}|" | awk '{print $1}' | awk -F '/' 'BEGIN {OFS="/"} {$NF=""; print}' | sort | uniq ); do
            if [ $is_dst_irods -eq 1 ]; then
                imkdir $d >> ${flog} 2>&1
            else
                mkdir $d >> ${flog} 2>&1
            fi
        done

        # determin transfer method
        cmd=""
        if [ $(( $is_src_irods + $is_dst_irods )) -eq 2 ]; then
            cmd='icp'
        elif [ $is_src_irods -eq 1 ]; then
            cmd='iget'
        elif [ $is_dst_irods -eq 1 ]; then
            cmd='iput'
        fi

        if [ "$cmd" == "" ]; then
            echo "error: unable to determin the command to transfer"
            exit 1
        fi

        # perform transfer with iput/iget, and parallelised by 'parallel'
        cat ${flist} | awk '{print $1}' | perl -pe "print; s|${src}|${dst}|" | parallel -N2 -P 4 -k file_transfer ${cmd} "{1}" "{2}" "{#}" | while read -r line; do
            w_done=$(( $w_skipped + $line ))
            w_done_percent=$(( $w_done * 100 / $w_total ))

            # the process is still running, therefore the progress should not exceed 99%
            if [ $w_done -ge $w_total ] || [ $w_done_percent -ge 100 ]; then
                w_done=$(( $w_total - 1 ))
                w_done_percent=99
            fi

            # print current progress
            echo "progress:${w_done_percent}:${w_done}:${w_total}"
        done
        ec=${PIPESTATUS[3]}
    fi

    # make sure the final 100% progress is printed
    if [ $ec -eq 0 ]; then
        echo "progress:100:${w_total}:${w_total}"
    fi

    # cleanup flog and flist files
    if [ -f $flog ]; then
        rm -f $flog
    fi
        
    if [ -f $flist ]; then
        rm -f $flist
    fi

    # return the irsync exit code
    exit $ec
else
    echo "nothing to sync"
    exit 0
fi
