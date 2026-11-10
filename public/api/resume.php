<?php
require_once __DIR__ . '/_bootstrap.php';

$user = get_auth_user();
if (!$user) {
    json_response(['error' => 'Unauthorized'], 401);
}

$appId = (int) ($_GET['application_id'] ?? 0);
if (!$appId) {
    json_response(['error' => 'Application ID is required'], 422);
}

$db = DB::conn();
$stmt = $db->prepare('
    SELECT a.id, a.seeker_id, a.resume_path, j.employer_id
    FROM applications a
    JOIN jobs j ON a.job_id = j.id
    WHERE a.id = ?
');
$stmt->execute([$appId]);
$app = $stmt->fetch();

if (!$app || empty($app['resume_path'])) {
    json_response(['error' => 'Resume not found'], 404);
}

// Authorization check: seeker who applied, job employer, or admin
$isSeeker = ((int) $user['id'] === (int) $app['seeker_id']);
$isEmployer = ((int) $user['id'] === (int) $app['employer_id']);
$isAdmin = ($user['role'] === 'admin');

if (!$isSeeker && !$isEmployer && !$isAdmin) {
    json_response(['error' => 'Forbidden'], 403);
}

// Strict basename to prevent directory traversal
$safeFilename = basename($app['resume_path']);
$filePath = dirname(__DIR__, 2) . '/storage/uploads/' . $safeFilename;

if (!file_exists($filePath)) {
    json_response(['error' => 'File not found on storage'], 404);
}

// Clear any accidental buffer and serve inline PDF
if (ob_get_level()) ob_end_clean();
header('Content-Type: application/pdf');
header('Content-Disposition: inline; filename="resume.pdf"');
header('Content-Length: ' . filesize($filePath));
header('Cache-Control: private, no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
readfile($filePath);
exit;
