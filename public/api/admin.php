<?php
require_once __DIR__ . '/_bootstrap.php';

$user = require_role('admin');
$action = $_GET['action'] ?? '';
$db = DB::conn();

if ($action === 'users') {
    $stmt = $db->query('SELECT id, name, email, role, created_at FROM users ORDER BY id DESC');
    json_response(['users' => $stmt->fetchAll()]);
}

if ($action === 'jobs') {
    $stmt = $db->query('
        SELECT j.id, j.title, j.company, j.location, j.type, j.salary_range, j.created_at,
               u.name AS employer_name, u.email AS employer_email,
               (SELECT COUNT(*) FROM applications WHERE job_id = j.id) AS applicant_count
        FROM jobs j
        JOIN users u ON j.employer_id = u.id
        ORDER BY j.id DESC
    ');
    json_response(['jobs' => $stmt->fetchAll()]);
}

if ($action === 'delete_job') {
    $data = get_json_input();
    $id = (int) ($data['id'] ?? ($_GET['id'] ?? 0));
    if (!$id) {
        json_response(['error' => 'Job ID is required'], 422);
    }

    $stmt = $db->prepare('DELETE FROM jobs WHERE id = ?');
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        json_response(['error' => 'Job not found'], 404);
    }

    json_response(['message' => 'Job deleted by admin']);
}

json_response(['error' => 'Invalid action'], 404);
