<?php
require_once __DIR__ . '/_bootstrap.php';

$action = $_GET['action'] ?? '';
$db = DB::conn();

if ($action === 'list') {
    $where = [];
    $params = [];

    if (!empty($_GET['keyword'])) {
        $where[] = '(j.title LIKE :kw OR j.company LIKE :kw OR j.description LIKE :kw)';
        $params[':kw'] = '%' . trim($_GET['keyword']) . '%';
    }
    if (!empty($_GET['location'])) {
        $where[] = 'j.location LIKE :loc';
        $params[':loc'] = '%' . trim($_GET['location']) . '%';
    }
    if (!empty($_GET['type'])) {
        $where[] = 'j.type = :type';
        $params[':type'] = trim($_GET['type']);
    }
    if (!empty($_GET['my_jobs'])) {
        $user = require_role('employer');
        $where[] = 'j.employer_id = :emp_id';
        $params[':emp_id'] = $user['id'];
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $countStmt = $db->prepare("SELECT COUNT(*) FROM jobs j {$whereSql}");
    foreach ($params as $k => $v) {
        $countStmt->bindValue($k, $v);
    }
    $countStmt->execute();
    $total = (int) $countStmt->fetchColumn();

    $page = max(1, (int) ($_GET['page'] ?? 1));
    $limit = min(50, max(1, (int) ($_GET['limit'] ?? 5)));
    $offset = ($page - 1) * $limit;

    $sql = "SELECT j.*, u.name AS employer_name FROM jobs j JOIN users u ON j.employer_id = u.id {$whereSql} ORDER BY j.id DESC LIMIT :limit OFFSET :offset";
    $stmt = $db->prepare($sql);
    foreach ($params as $k => $v) {
        $stmt->bindValue($k, $v);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $jobs = $stmt->fetchAll();

    json_response([
        'jobs' => $jobs,
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'pages' => $total > 0 ? (int) ceil($total / $limit) : 1,
    ]);
}

if ($action === 'detail') {
    $id = (int) ($_GET['id'] ?? 0);
    $stmt = $db->prepare('SELECT j.*, u.name AS employer_name FROM jobs j JOIN users u ON j.employer_id = u.id WHERE j.id = ?');
    $stmt->execute([$id]);
    $job = $stmt->fetch();
    if (!$job) {
        json_response(['error' => 'Job not found'], 404);
    }

    $user = get_auth_user();
    $application = null;
    if ($user && $user['role'] === 'seeker') {
        $appStmt = $db->prepare('SELECT id, status, created_at FROM applications WHERE job_id = ? AND seeker_id = ?');
        $appStmt->execute([$id, $user['id']]);
        $application = $appStmt->fetch() ?: null;
    }

    json_response(['job' => $job, 'application' => $application]);
}

if ($action === 'create') {
    $user = require_role('employer');
    $data = get_json_input();
    $title = trim($data['title'] ?? '');
    $company = trim($data['company'] ?? '');
    $location = trim($data['location'] ?? '');
    $type = trim($data['type'] ?? '');
    $salary = trim($data['salary_range'] ?? '');
    $description = trim($data['description'] ?? '');

    if (!$title || !$company || !$location || !$type || !$salary || !$description) {
        json_response(['error' => 'All fields are required'], 422);
    }

    $stmt = $db->prepare('INSERT INTO jobs (employer_id, title, company, location, type, salary_range, description) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$user['id'], $title, $company, $location, $type, $salary, $description]);

    json_response(['message' => 'Job created successfully', 'job_id' => (int) $db->lastInsertId()], 201);
}

if ($action === 'update') {
    $user = require_role('employer');
    $data = get_json_input();
    $id = (int) ($data['id'] ?? 0);
    $title = trim($data['title'] ?? '');
    $company = trim($data['company'] ?? '');
    $location = trim($data['location'] ?? '');
    $type = trim($data['type'] ?? '');
    $salary = trim($data['salary_range'] ?? '');
    $description = trim($data['description'] ?? '');

    if (!$id || !$title || !$company || !$location || !$type || !$salary || !$description) {
        json_response(['error' => 'All fields are required'], 422);
    }

    $chk = $db->prepare('SELECT employer_id FROM jobs WHERE id = ?');
    $chk->execute([$id]);
    $job = $chk->fetch();
    if (!$job) {
        json_response(['error' => 'Job not found'], 404);
    }
    if ((int) $job['employer_id'] !== (int) $user['id']) {
        json_response(['error' => 'You can only edit your own jobs'], 403);
    }

    $stmt = $db->prepare('UPDATE jobs SET title = ?, company = ?, location = ?, type = ?, salary_range = ?, description = ? WHERE id = ?');
    $stmt->execute([$title, $company, $location, $type, $salary, $description, $id]);

    json_response(['message' => 'Job updated successfully']);
}

if ($action === 'delete') {
    $user = require_role(['employer', 'admin']);
    $data = get_json_input();
    $id = (int) ($data['id'] ?? ($_GET['id'] ?? 0));

    $chk = $db->prepare('SELECT employer_id FROM jobs WHERE id = ?');
    $chk->execute([$id]);
    $job = $chk->fetch();
    if (!$job) {
        json_response(['error' => 'Job not found'], 404);
    }
    if ($user['role'] !== 'admin' && (int) $job['employer_id'] !== (int) $user['id']) {
        json_response(['error' => 'Forbidden'], 403);
    }

    $del = $db->prepare('DELETE FROM jobs WHERE id = ?');
    $del->execute([$id]);
    json_response(['message' => 'Job deleted successfully']);
}

json_response(['error' => 'Invalid action'], 404);
