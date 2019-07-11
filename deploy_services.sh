#!/bin/bash

BASE_DIR=/home/amplify/amplify-choreo-async

cd ${BASE_DIR}/check-inventory
npm run helm_deploy

cd ${BASE_DIR}/customer-id-aggregation
npm run helm_deploy

cd ${BASE_DIR}/invoice-customer
npm run helm_deploy

cd ${BASE_DIR}/item-id-aggregation
npm run helm_deploy

cd ${BASE_DIR}/notify-supplier
npm run helm_deploy

cd ${BASE_DIR}/order-splitter
npm run helm_deploy

cd ${BASE_DIR}