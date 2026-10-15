#!/bin/sh
# Starts the LOCAL development database (MongoDB, localhost only) in the background.
# Data lives in ~/cleaniq-nigeria-db/data, so it survives restarts. Run: npm run db
D="$HOME/cleaniq-nigeria-db"
if lsof -iTCP:27017 -sTCP:LISTEN >/dev/null 2>&1; then echo "Local database already running on 27017."; exit 0; fi
"$D/bin/mongod" --dbpath "$D/data" --port 27017 --bind_ip 127.0.0.1 --fork --logpath "$D/mongod.log" >/dev/null && echo "Local database started on 27017 (data: $D/data)."
