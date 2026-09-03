#!/bin/bash
set -e
cd /home/runner/workspace/frontend

echo "Installing frontend dependencies..."
yarn install --network-timeout 300000 2>&1

echo "Starting React app..."
PORT=3000 BROWSER=none yarn start
