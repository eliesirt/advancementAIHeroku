-- Direct SQL fix for production database sortOrder values
-- Run this with: heroku pg:psql --app advancement-ai-b8abf01faf28 < fix-production-db.sql

BEGIN;

-- Show current values
SELECT name, sort_order, display_name FROM applications ORDER BY id;

-- Update sortOrder values to correct order
UPDATE applications SET sort_order = 4 WHERE name = 'settings';
UPDATE applications SET sort_order = 2 WHERE name = 'portfolio-ai'; 
UPDATE applications SET sort_order = 3 WHERE name = 'itinerary-ai';

-- Verify the fix
SELECT name, sort_order, display_name FROM applications ORDER BY sort_order;

COMMIT;