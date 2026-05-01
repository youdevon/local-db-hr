param(
  [string]$BackupFile = "local-db-hr-current.dump"
)

docker cp "database/backup/$BackupFile" local-db-hr-postgres:/tmp/$BackupFile
docker exec local-db-hr-postgres pg_restore -U local_db_hr_user -d local_db_hr --clean --if-exists /tmp/$BackupFile

Write-Host "Database restored from $BackupFile"
