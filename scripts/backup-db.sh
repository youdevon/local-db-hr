#!/bin/sh
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
docker exec local-db-hr-postgres pg_dump -U local_db_hr_user -d local_db_hr -Fc -f /backup/local-db-hr-$TIMESTAMP.dump
echo "Backup created: database/backup/local-db-hr-$TIMESTAMP.dump"
