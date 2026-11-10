<?php
require_once dirname(__DIR__, 2) . '/config/db.php';

// Safe cookie parameters
session_name(env('SESSION_NAME', 'jp_session'));
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'httponly' => true,
    'samesite' => 'Lax',
]);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json; charset=utf-8');

// Never leak raw exception messages to client
set_exception_handler(function (Throwable $e) {
    error_log($e->getMessage() . "\n" . $e->getTraceAsString());
    json_response(['error' => 'Internal server error'], 500);
});

function json_response(mixed $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function csrf_token(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function get_auth_user(): ?array {
    return $_SESSION['user'] ?? null;
}

function require_role(string|array $roles): array {
    $user = get_auth_user();
    if (!$user) {
        json_response(['error' => 'Unauthorized'], 401);
    }
    $allowed = (array) $roles;
    if (!in_array($user['role'], $allowed, true)) {
        json_response(['error' => 'Forbidden'], 403);
    }
    return $user;
}

function get_json_input(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return $_POST;
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? array_merge($_POST, $decoded) : $_POST;
}

// CSRF check for state-changing HTTP methods
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (in_array($method, ['POST', 'PUT', 'DELETE', 'PATCH'], true)) {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['_csrf'] ?? '');
    $stored = $_SESSION['csrf_token'] ?? '';
    if (!$token || !$stored || !hash_equals($stored, $token)) {
        json_response(['error' => 'Invalid or missing CSRF token'], 403);
    }
}
