# JobPortal MVP

## Setup
1. Create DB and import schema: `mysql -u root -p < schema.sql`
2. Configure environment: `cp .env.example .env` (edit DB_USER & DB_PASS)
3. Run local server: `php -S localhost:8000 -t public`
4. Open in browser: `http://localhost:8000`

## Demo Credentials (Password: Password123!)
- Admin: `admin@jobportal.test`
- Employer: `employer@jobportal.test`
- Seeker: `seeker@jobportal.test`

## API Endpoints
- `GET/POST /api/auth.php?action=csrf|me|register|login|logout`
- `GET/POST /api/jobs.php?action=list|detail|create|update|delete`
- `POST     /api/apply.php` (seeker apply with cover note & PDF)
- `GET/POST /api/applications.php?action=my|job_applicants|set_status`
- `GET/POST /api/admin.php?action=users|jobs|delete_job`
- `GET      /api/resume.php?application_id=ID` (authorized PDF stream)
