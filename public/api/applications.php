<?php
require_once __DIR__ . '/_bootstrap.php';

$action = $_GET['action'] ?? '';
$db = DB::conn();

if ($action === 'my') {
    $user = require_role('seeker');
    $stmt = $db->prepare('
        SELECT a.id, a.job_id, a.cover_note, a.resume_path, a.status, a.created_at,
               j.title, j.company, j.location, j.type, j.salary_range
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE a.seeker_id = ?
        ORDER BY a.id DESC
    ');
    $stmt->execute([$user['id']]);
    json_response(['applications' => $stmt->fetchAll()]);
}

if ($action === 'job_applicants') {
    $user = require_role('employer');
    $jobId = !empty($_GET['job_id']) ? (int) $_GET['job_id'] : null;

    if ($jobId) {
        $stmt = $db->prepare('
            SELECT a.id, a.job_id, a.seeker_id, a.cover_note, a.resume_path, a.status, a.created_at,
                   u.name AS seeker_name, u.email AS seeker_email,
                   j.title AS job_title
            FROM applications a
            JOIN jobs j ON a.job_id = j.id
            JOIN users u ON a.seeker_id = u.id
            WHERE a.job_id = ? AND j.employer_id = ?
            ORDER BY a.id DESC
        ');
        $stmt->execute([$jobId, $user['id']]);
    } else {
        $stmt = $db->prepare('
            SELECT a.id, a.job_id, a.seeker_id, a.cover_note, a.resume_path, a.status, a.created_at,
                   u.name AS seeker_name, u.email AS seeker_email,
                   j.title AS job_title
            FROM applications a
            JOIN jobs j ON a.job_id = j.id
            JOIN users u ON a.seeker_id = u.id
            WHERE j.employer_id = ?
            ORDER BY a.id DESC
        ');
        $stmt->execute([$user['id']]);
    }

    json_response(['applicants' => $stmt->fetchAll()]);
}

if ($action === 'set_status') {
    $user = require_role('employer');
    $data = get_json_input();
    $appId = (int) ($data['application_id'] ?? 0);
    $status = trim($data['status'] ?? '');

    if (!$appId || !in_array($status, ['pending', 'shortlisted', 'rejected'], true)) {
        json_response(['error' => 'Invalid application ID or status'], 422);
    }

    $chk = $db->prepare('
        SELECT a.id FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE a.id = ? AND j.employer_id = ?
    ');
    $chk->execute([$appId, $user['id']]);
    if (!$chk->fetch()) {
        json_response(['error' => 'Application not found or unauthorized'], 403);
    }

    $upd = $db->prepare('UPDATE applications SET status = ? WHERE id = ?');
    $upd->execute([$status, $appId]);

    json_response(['message' => 'Application status updated successfully']);
}

json_response(['error' => 'Invalid action'], 404);
