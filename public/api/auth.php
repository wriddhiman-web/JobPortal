<?php
require_once __DIR__ . '/_bootstrap.php';

$action = $_GET['action'] ?? '';

if ($action === 'csrf') {
    json_response(['csrf_token' => csrf_token()]);
}

if ($action === 'me') {
    json_response(['user' => get_auth_user()]);
}

if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'] ?? '', $p['secure'] ?? false, $p['httponly'] ?? true);
    }
    session_destroy();
    json_response(['message' => 'Logged out successfully']);
}

$db = DB::conn();

if ($action === 'register') {
    $data = get_json_input();
    $name = trim($data['name'] ?? '');
    $email = strtolower(trim($data['email'] ?? ''));
    $password = $data['password'] ?? '';
    $role = trim($data['role'] ?? '');

    if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(['error' => 'Invalid name or email address'], 422);
    }
    if (strlen($password) < 6) {
        json_response(['error' => 'Password must be at least 6 characters'], 422);
    }
    if (!in_array($role, ['seeker', 'employer', 'admin'], true)) {
        json_response(['error' => 'Invalid role specified'], 422);
    }

    $stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        json_response(['error' => 'Email is already registered'], 409);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $ins = $db->prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
    $ins->execute([$name, $email, $hash, $role]);

    session_regenerate_id(true);
    $_SESSION['user'] = [
        'id' => (int) $db->lastInsertId(),
        'name' => $name,
        'email' => $email,
        'role' => $role,
    ];
    json_response(['message' => 'Registration successful', 'user' => $_SESSION['user']], 201);
}

if ($action === 'login') {
    $data = get_json_input();
    $email = strtolower(trim($data['email'] ?? ''));
    $password = $data['password'] ?? '';

    if ($email === '' || $password === '') {
        json_response(['error' => 'Email and password are required'], 422);
    }

    $stmt = $db->prepare('SELECT id, name, email, password, role FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        json_response(['error' => 'Invalid email or password'], 401);
    }

    session_regenerate_id(true);
    $_SESSION['user'] = [
        'id' => (int) $user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'role' => $user['role'],
    ];
    json_response(['message' => 'Login successful', 'user' => $_SESSION['user']]);
}

json_response(['error' => 'Invalid action'], 404);
