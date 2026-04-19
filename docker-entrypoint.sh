#!/bin/sh
set -eu

echo "Applying Prisma migrations..."
/app/node_modules/.bin/prisma migrate deploy

exec node server.js
