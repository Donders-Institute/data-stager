#!/bin/bash

#src=/project/3010000.03/raw/mri/SUBJ0003/
#dst=$( echo $src | sed 's|/project|irods:/rdm/di/dccn/DAC_3010000.01_173|g' )

#src=/project/3010000.01/rdm-test/mri_data/test16
#dst=irods:/rdm/di/dccn/DAC_3010000.01_173/davrods-test16

src=/project/3010000.01/rdm-test/meg_data/20160921
dst=irods:/rdm/di/dccn/DAC_3010000.01_173/meg_data/davrods-20160921.2

#dst=/project/3010000.01/rdm-test/mri_data/S20
#src=irods:/rdm/di/dccn/DAC_3018031.01_448/raw/S20

#dst=/project/3010000.01/rdm-test/meg_data/20160921
#src=irods:/rdm/di/dccn/DAC_3010102.00_087/raw/20160921

now=$( date )

curl -u admin:admin -H "Content-Type: application/json" -X POST -d \
"{ \"type\": \"rdm\",
   \"data\": { \"srcURL\": \"${src}\",
               \"dstURL\": \"${dst}\",
               \"clientIF\": \"webdav\",
               \"timeout\": 86400,
               \"timeout_noprogress\": 1800,
               \"title\": \"[${now}] sync to ${dst}\"},
   \"options\": { \"attempts\": 10,
                  \"backoff\": { \"delay\": 60000, \"type\": \"fixed\" }}
 }" http://localhost:3000/job
