#!/bin/bash

source /opt/stager/envvars
export PATH=$PYTHON_BINDIR:$PATH

python -c 'import json; c = json.load(open("/opt/stager/config/default.json")); print(c["RDM"]["userPass"])' | iinit
