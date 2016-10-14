#!/bin/bash

#src=/project/3010000.03/raw/mri/SUBJ0003/
#dst=$( echo $src | sed 's|/project|irods:/rdm/di/dccn/DAC_3010000.01_173|g' )

#src=/project/3010000.01/rdm-test/mri_data/S19
#dst=irods:/rdm/di/dccn/DAC_3010000.01_173/test/mri_data/S19

dst=/project/3010000.01/rdm-test/mri_data/S04
src=irods:/rdm/di/dccn/DAC_3018031.01_448/raw/S04

now=$( date )

curl -u 'honlee@dccn.nl:Hong6430;;' -H "Content-Type: application/json" -X POST -d \
"{ \"type\": \"rdm\",
   \"data\": { \"srcURL\": \"${src}\",
               \"dstURL\": \"${dst}\",
               \"clientIF\": \"irods\",
               \"stagerUser\": \"honlee@dccn.nl\",
               \"timeout\": 86400,
               \"timeout_noprogress\": 1800,
               \"title\": \"[${now}] sync to ${dst}\"},
   \"options\": { \"attempts\": 10,
                  \"backoff\": { \"delay\": 60000, \"type\": \"fixed\" }}
 }" http://localhost:3000/job
