#!/bin/sh
BACKUP_FILE=${1:-local-db-hr-current.dump}
docker cp "database/backup/$BACKUP_FILE" local-db-hr-postgres:/tmp/$BACKUP_FILE
docker exec local-db-hr-postgres pg_restore -U local_db_hr_user -d local_db_hr --clean --if-exists /tmp/$BACKUP_FILE
echo "Database restored from $BACKUP_FILE"
