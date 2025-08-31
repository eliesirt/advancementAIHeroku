# Heroku Production Deployment: BBEC User-Specific Authentication

## Database Migration Commands

### Option 1: Direct SQL Execution
```bash
# Connect to your Heroku Postgres database and run the migration
heroku pg:psql --app your-app-name -f heroku-bbec-credentials-migration.sql
```

### Option 2: Manual SQL Commands
```bash
# Connect to Heroku Postgres
heroku pg:psql --app your-app-name

# Then run these commands one by one:
ALTER TABLE users ADD COLUMN IF NOT EXISTS bbec_username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bbec_password TEXT;

# Verify the changes
\d users;

# Exit
\q
```

### Option 3: Single Command
```bash
# Run as a single command
heroku pg:psql --app your-app-name -c "
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS bbec_username TEXT,
ADD COLUMN IF NOT EXISTS bbec_password TEXT;
"
```

## Verification Steps

After running the migration, verify the changes:

```bash
# Check the table structure
heroku pg:psql --app your-app-name -c "\d users"

# Check existing users
heroku pg:psql --app your-app-name -c "
SELECT id, email, first_name, last_name, bbec_guid, bbec_username, 
       CASE WHEN bbec_password IS NOT NULL THEN '[HAS_PASSWORD]' ELSE NULL END as password_status
FROM users 
ORDER BY id;
"
```

## Post-Migration Steps

1. **Deploy Updated Code**: Ensure your latest code changes are deployed to Heroku
2. **Test BBEC Connection**: Have users update their BBEC credentials in Settings
3. **Monitor Logs**: Check interaction submissions use user-specific authentication
4. **Fallback Verification**: Confirm environment variable fallback still works

## Expected Heroku Logs After Migration

Look for these log patterns indicating success:
```
✅ Found BBEC credentials for user: [USER_ID]
✅ BBEC credentials loaded from user profile: { hasUsername: true, hasPassword: true, environment: 'Heroku' }
🔄 BBEC SUBMISSION: Starting submission for interaction [ID] by user: [USER_ID]
```

## Rollback Plan (if needed)

If issues arise, you can remove the columns:
```bash
heroku pg:psql --app your-app-name -c "
ALTER TABLE users 
DROP COLUMN IF EXISTS bbec_username,
DROP COLUMN IF EXISTS bbec_password;
"
```

## Security Notes

- BBEC passwords are stored as plain text in the database (as required by the Base64 encoding for SOAP authentication)
- Consider database encryption at rest for sensitive credential storage
- Monitor access logs for unusual credential access patterns