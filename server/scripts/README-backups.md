# Database backups (Cleaniq Nigeria)

The Nigeria database (`cleaniq_ng`) runs on our VPS, so **we** are responsible for backups.

## What happens
- Every day at **3:00am Lagos time** `scripts/backup-db.js` makes a compressed copy of the whole database.
- The newest **14** copies are kept on the VPS (`BACKUP_DIR`, default `/var/backups/cleaniq_ng`).
- Each copy is also **uploaded off the VPS** with `BACKUP_UPLOAD_CMD` — if the VPS dies, the copies elsewhere survive.
- Run a backup **before every deploy** too: `npm run backup`.

## One-time setup on the VPS
1. Install MongoDB Database Tools (gives `mongodump` / `mongorestore`):
   `sudo apt install mongodb-database-tools` (or the .deb from mongodb.com/try/download/database-tools).
2. Make the backup folder: `sudo mkdir -p /var/backups/cleaniq_ng && sudo chown $USER /var/backups/cleaniq_ng && chmod 700 /var/backups/cleaniq_ng`
3. Choose where copies go off the VPS. Easiest: **rclone** to a cloud bucket (Backblaze B2, Google Drive, S3…):
   - `sudo apt install rclone`, then `rclone config` and create a remote called `offsite`.
   - In `server/.env` (the script adds the backup file's path at the end of this command):
     `BACKUP_UPLOAD_CMD=sh -c 'rclone copy "$0" offsite:cleaniq-ng-backups'`
   - Set a lifecycle rule on the bucket to delete copies older than 60 days.
4. Add the cron job (`crontab -e`). VPS clocks are usually UTC, and 3am Lagos = **2am UTC**:
   ```
   CRON_TZ=Africa/Lagos
   0 3 * * * cd /var/www/cleaniq-nigeria/server && /usr/bin/node --env-file=.env scripts/backup-db.js >> /var/log/cleaniq-ng-backup.log 2>&1
   ```
   (If your cron ignores `CRON_TZ`, use `0 2 * * *` instead.)
5. Run it once by hand and check the log, the file in `/var/backups/cleaniq_ng`, and the copy in the bucket.

## Test a restore (do this once after setup, then every few months)
This restores into a **separate** database — the live one is not touched:
```
node --env-file=.env scripts/restore-db.js /var/backups/cleaniq_ng/<newest file> --into cleaniq_ng_restore_test
mongosh "$MONGODB_URI" --eval 'db.getSiblingDB("cleaniq_ng_restore_test").bookings.countDocuments()'
```
The count should match the live database. Then remove the test copy:
`mongosh "$MONGODB_URI" --eval 'db.getSiblingDB("cleaniq_ng_restore_test").dropDatabase()'`

## Real restore (something went wrong with live data)
1. `pm2 stop cleaniq-ng-api`
2. Take a backup of the current state first: `node --env-file=.env scripts/backup-db.js`
3. `node --env-file=.env scripts/restore-db.js <backup file> --replace-live --yes`
4. `pm2 start cleaniq-ng-api` and check the admin.
