#!/bin/bash

source /opt/stager/envvars

cat $IRODS_ADMIN_CREDENTIAL | iinit
