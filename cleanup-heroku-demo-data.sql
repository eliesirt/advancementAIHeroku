-- Script to remove demo data from Heroku production database
-- Run this in Heroku PostgreSQL to clean up existing demo prospects

-- Remove known demo prospects by their identifiable data
DELETE FROM prospects 
WHERE (buid = 'BUID001' AND first_name = 'John' AND last_name = 'Smith')
   OR (buid = 'BUID002' AND first_name = 'Sarah' AND last_name = 'Johnson')  
   OR (buid = 'BUID003' AND first_name = 'Michael' AND last_name = 'Chen')
   OR (bbec_guid = 'BBEC-GUID-001')
   OR (bbec_guid = 'BBEC-GUID-002') 
   OR (bbec_guid = 'BBEC-GUID-003')
   OR (email = 'john.smith@example.com')
   OR (email = 'sarah.johnson@example.com')
   OR (email = 'michael.chen@example.com');

-- Also clean up any prospects with example.com email addresses
DELETE FROM prospects WHERE email LIKE '%@example.com';

-- Show remaining prospect count
SELECT COUNT(*) as remaining_prospects FROM prospects;

-- Run this command in terminal to execute in Heroku:
-- heroku pg:psql -a YOUR_APP_NAME -f cleanup-heroku-demo-data.sql