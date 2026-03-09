<?php
// ============================================================
// COLLECT.PHP — Endpoint de coleta de eventos do app
// ============================================================
// Método: POST
// Content-Type: application/json
// Body: { device_id, session_id, events: [{type, screen, ts}] }
// ============================================================

require_once 'config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Responder preflight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

// ---- Ler e decodificar body ----
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

// ---- Validar device_id (SHA-256 hex = exatamente 64 chars hex) ----
if (
    !isset($data['device_id']) ||
    !is_string($data['device_id']) ||
    !preg_match('/^[a-f0-9]{64}$/', $data['device_id'])
) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid device_id']);
    exit;
}

// ---- Validar session_id (UUID v4) ----
if (
    !isset($data['session_id']) ||
    !is_string($data['session_id']) ||
    !preg_match(
        '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
        $data['session_id']
    )
) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid session_id']);
    exit;
}

// ---- Validar array de eventos ----
if (
    !isset($data['events']) ||
    !is_array($data['events']) ||
    count($data['events']) === 0
) {
    http_response_code(400);
    echo json_encode(['error' => 'No events']);
    exit;
}

if (count($data['events']) > MAX_EVENTS_PER_REQUEST) {
    http_response_code(400);
    echo json_encode(['error' => 'Too many events per request']);
    exit;
}

// ---- Preparar arquivo do dia (NDJSON) ----
$valid_types = ['app_open', 'screen_view'];
$device_id   = $data['device_id'];
$session_id  = $data['session_id'];
$today       = gmdate('Y-m-d'); // UTC
$file_path   = DATA_DIR . $today . '.json';

if (!is_dir(DATA_DIR)) {
    mkdir(DATA_DIR, 0750, true);
}

// ---- Escrever eventos com lock exclusivo ----
$written = 0;
$fp = fopen($file_path, 'a');

if ($fp && flock($fp, LOCK_EX)) {
    foreach ($data['events'] as $event) {
        // Validar tipo
        if (!isset($event['type']) || !in_array($event['type'], $valid_types, true)) {
            continue;
        }

        // Timestamp: usar o enviado pelo app ou agora
        $ts = (isset($event['ts']) && is_int($event['ts'])) ? (int)$event['ts'] : time();

        // Sanitizar e normalizar screen: remove prefixo /(drawer) do Expo Router
        $screen = null;
        if (isset($event['screen']) && is_string($event['screen'])) {
            $sanitized = preg_replace('/[^a-zA-Z0-9\/_\-\(\)]/', '', $event['screen']);
            $sanitized = preg_replace('#^/\(drawer\)#', '', $sanitized);
            $screen    = substr($sanitized ?: '/', 0, 128);
        }

        $row = json_encode([
            'device_id'  => $device_id,
            'session_id' => $session_id,
            'type'       => $event['type'],
            'screen'     => $screen,
            'ts'         => $ts,
        ], JSON_UNESCAPED_UNICODE);

        fwrite($fp, $row . "\n");
        $written++;
    }

    flock($fp, LOCK_UN);
    fclose($fp);
}

echo json_encode(['ok' => true, 'written' => $written]);
