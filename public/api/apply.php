<?php
require_once __DIR__ . '/_bootstrap.php';

$user = require_role('seeker');
$db = DB::conn();

$jobId = (int) ($_POST['job_id'] ?? 0);
$coverNote = trim($_POST['cover_note'] ?? '');

if (!$jobId || $coverNote === '') {
    json_response(['error' => 'Job ID and cover note are required'], 422);
}

// Verify job exists
$jobStmt = $db->prepare('SELECT id FROM jobs WHERE id = ?');
$jobStmt->execute([$jobId]);
if (!$jobStmt->fetch()) {
    json_response(['error' => 'Job not found'], 404);
}

// Check existing application
$chk = $db->prepare('SELECT id FROM applications WHERE job_id = ? AND seeker_id = ?');
$chk->execute([$jobId, $user['id']]);
if ($chk->fetch()) {
    json_response(['error' => 'You have already applied for this job'], 409);
}

$resumeFilename = null;

if (!empty($_FILES['resume']) && $_FILES['resume']['error'] !== UPLOAD_ERR_NO_FILE) {
    $file = $_FILES['resume'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        json_response(['error' => 'File upload error occurred'], 400);
    }

    $maxMb = (int) env('MAX_UPLOAD_MB', 2);
    if ($file['size'] > ($maxMb * 1024 * 1024)) {
        json_response(['error' => "Resume file exceeds maximum allowed size of {$maxMb}MB"], 422);
    }

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if ($ext !== 'pdf') {
        json_response(['error' => 'Resume must have a .pdf extension'], 422);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    if ($mime !== 'application/pdf') {
        json_response(['error' => 'Uploaded file is not a valid PDF document'], 422);
    }

    $resumeFilename = bin2hex(random_bytes(16)) . '.pdf';
    $targetDir = dirname(__DIR__, 2) . '/storage/uploads/';
    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0755, true);
    }
    if (!move_uploaded_file($file['tmp_name'], $targetDir . $resumeFilename)) {
        json_response(['error' => 'Failed to store resume'], 500);
    }
}

try {
    $ins = $db->prepare('INSERT INTO applications (job_id, seeker_id, cover_note, resume_path, status) VALUES (?, ?, ?, ?, "pending")');
    $ins->execute([$jobId, $user['id'], $coverNote, $resumeFilename]);
} catch (PDOException $e) {
    if ($resumeFilename && file_exists($targetDir . $resumeFilename)) {
        unlink($targetDir . $resumeFilename);
    }
    // Handle duplicate key error gracefully
    if ($e->getCode() == 23000) {
        json_response(['error' => 'You have already applied for this job'], 409);
    }
    throw $e;
}

json_response(['message' => 'Application submitted successfully'], 201);
