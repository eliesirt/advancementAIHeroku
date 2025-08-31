# Debug: Heroku Profile Update Issue

## Problem
User profile form works in Replit but doesn't save values in Heroku, even though BBEC columns exist.

## Database Confirmation
```sql
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE 'bbec%';
  column_name  | data_type | is_nullable
---------------+-----------+-------------
 bbec_guid     | text      | YES
 bbec_password | text      | YES
 bbec_username | text      | YES
```

## Debugging Steps Added

### 1. Enhanced Logging in Profile Update Route
- Added environment detection logs
- Added detailed update data logging (hiding passwords)
- Added try/catch around storage.updateUser call
- Added verification of saved BBEC fields

### 2. Enhanced Error Handling in Storage Layer
- Added fallback mechanism for missing BBEC columns (already done)
- Added detailed error logging

## Next Steps for Debugging

### Check Heroku Logs
```bash
# Monitor profile update attempts
heroku logs --tail --app your-app-name | grep "PROFILE UPDATE"

# Look for specific errors
heroku logs --tail --app your-app-name | grep -E "(ERROR|Failed|bbec)"
```

### Test Profile Update in Heroku
1. Open Heroku app
2. Go to Settings
3. Click "Update User"
4. Fill in BBEC credentials
5. Submit form
6. Check logs immediately

### Expected Log Pattern (Success)
```
📝 PROFILE UPDATE: User ID: [USER_ID]
📝 PROFILE UPDATE: Data received: {...}
📝 PROFILE UPDATE: Final update data: {...}
📝 PROFILE UPDATE: Environment: production
🔄 DATABASE UPDATE: Cleaned updates: {...}
🔄 DATABASE UPDATE: User ID: [USER_ID]
✅ PROFILE UPDATE: Successfully updated user profile
📝 PROFILE UPDATE: Updated user BBEC fields: {...}
```

### Expected Log Pattern (Failure)
```
📝 PROFILE UPDATE: User ID: [USER_ID]
📝 PROFILE UPDATE ERROR: [Error details]
📝 PROFILE UPDATE ERROR Stack: [Stack trace]
```

## Possible Issues to Investigate

1. **Authentication**: User ID not being extracted properly in Heroku
2. **Database Connection**: Different connection string or permissions
3. **Column Case Sensitivity**: Postgres case sensitivity issues
4. **Data Validation**: Different validation rules in production
5. **Session Management**: Different session handling in Heroku vs Replit

## Testing Commands

### Quick Profile Update Test
```bash
# Test the API directly
curl -X PATCH https://your-app.herokuapp.com/api/user/profile \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "firstName": "Test",
    "lastName": "User", 
    "email": "test@example.com",
    "buid": "TEST123",
    "bbecUsername": "testuser",
    "bbecPassword": "testpass"
  }'
```