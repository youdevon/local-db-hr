$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = "database/backup/local-db-hr-$timestamp.dump"

if ($env:POSTGRES_USER -and $env:POSTGRES_DB) {
  docker exec local-db-hr-postgres pg_dump -U $env:POSTGRES_USER -d $env:POSTGRES_DB -Fc -f "/backup/local-db-hr-$timestamp.dump"
  Write-Host "Backup created: $backupFile"
}
else {
  docker exec local-db-hr-postgres pg_dump -U local_db_hr_user -d local_db_hr -Fc -f /backup/local-db-hr-current.dump
  Write-Host "Backup created: database/backup/local-db-hr-current.dump"
}
