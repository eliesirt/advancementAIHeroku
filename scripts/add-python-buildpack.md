# Add Python Support to Heroku for pythonAI

## Problem
Python scripts fail to execute in Heroku with error: `/bin/sh: 1: python3: not found`

## Solution: Add Python Buildpack

### Step 1: Add Python Buildpack to Heroku App
```bash
# Add Python buildpack to your Heroku app
heroku buildpacks:add --app advancement-ai heroku/python

# Verify buildpacks are configured
heroku buildpacks --app advancement-ai
```

### Step 2: Create runtime.txt for Python Version
Create a `runtime.txt` file in your project root to specify Python version:
```bash
echo "python-3.11.9" > runtime.txt
```

### Step 3: Create requirements.txt for Python Dependencies
Create a basic `requirements.txt` file:
```bash
echo "# Python dependencies for script execution" > requirements.txt
```

### Step 4: Deploy Changes
```bash
git add runtime.txt requirements.txt
git commit -m "Add Python support for pythonAI script execution"
git push heroku main
```

## Alternative: Manual Python Installation in Code
The updated server code now includes automatic Python detection and installation fallbacks:
- Tries `python3` first
- Falls back to `python` if `python3` not found
- Attempts to install Python if neither found
- Same fallback logic for `pip3`/`pip`

## Verification
After adding the buildpack and deploying:
1. Try executing a Python script in pythonAI
2. Check `heroku logs --tail --app advancement-ai` for execution details
3. Verify Python is available with: `heroku run --app advancement-ai python3 --version`

## Expected Result
Python scripts should execute successfully with proper stdout/stderr capture and execution logging.