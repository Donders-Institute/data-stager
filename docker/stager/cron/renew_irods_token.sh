#!/bin/bash

source /opt/stager/envvars

$NODEJS_PREFIX/bin/node -e "var cfg=require('config'); var pass = cfg.get('RDM.userPass'); console.log(pass)" | iinit 
