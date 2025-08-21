# Fix Heroku Database Connection Issue

## Problem
Heroku has an attached database add-on that's setting an invalid DATABASE_URL pointing to `api.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com` (which doesn't exist).

## Solution Options

### Option 1: Remove the Old Database Add-on (Recommended)
```bash
# Check what database add-ons are attached
heroku addons -a advancement-ai

# Remove the problematic database add-on (replace 'addon-name' with actual name)
heroku addons:destroy addon-name -a advancement-ai

# Then set your working DATABASE_URL
heroku config:set DATABASE_URL="your-working-neon-url" -a advancement-ai
```

### Option 2: Detach the Database Add-on
```bash
# Detach without destroying (if you want to keep it for later)
heroku addons:detach addon-name -a advancement-ai

# Then set your working DATABASE_URL
heroku config:set DATABASE_URL="your-working-neon-url" -a advancement-ai
```

### Option 3: Use a Different Variable Name
```bash
# Set a custom database URL variable
heroku config:set NEON_DATABASE_URL="your-working-neon-url" -a advancement-ai
```

If you choose Option 3, I'll need to update the code to use NEON_DATABASE_URL instead of DATABASE_URL.

## Your Working Database URL
From the diagnostic, your working connection is:
```
postgresql://neondb_owner:[password]@ep-fragrant-poetry-afdxe8lo.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require
```

## Steps to Execute
1. First run: `heroku addons -a advancement-ai` to see what's attached
2. Choose one of the options above based on what you find
3. Test the connection after making changes

Let me know which option you prefer, or what the `heroku addons` command shows.