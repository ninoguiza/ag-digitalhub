<?php
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }

session_start();
$now = time();
if (!isset($_SESSION['chat_count']) || ($now - $_SESSION['chat_start']) > 3600) {
    $_SESSION['chat_count'] = 0;
    $_SESSION['chat_start'] = $now;
}
if ($_SESSION['chat_count'] >= 40) {
    header('Content-Type: application/json');
    http_response_code(429);
    echo json_encode(['reply' => 'Trop de messages. Reessayez dans une heure.']);
    exit;
}
$_SESSION['chat_count']++;

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['message']) || trim($input['message']) === '') {
    header('Content-Type: application/json');
    http_response_code(400);
    echo json_encode(['reply' => 'Message manquant.']);
    exit;
}

$message = mb_substr(strip_tags(trim($input['message'])), 0, 500);
$history = [];
if (isset($input['history']) && is_array($input['history'])) {
    foreach (array_slice($input['history'], -8) as $h) {
        if (isset($h['role'], $h['content']) && in_array($h['role'], ['user', 'assistant'], true)) {
            $history[] = ['role' => $h['role'], 'content' => mb_substr(strip_tags($h['content']), 0, 600)];
        }
    }
}

$payload = json_encode(['message' => $message, 'history' => $history]);

$ch = curl_init('https://n8n.miaam.io/webhook/garage-rdv-agent');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 25,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_SSL_VERIFYPEER => true,
]);
$resp = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

header('Content-Type: application/json');
header('Cache-Control: no-store');
if ($code === 200 && $resp) { echo $resp; }
else { echo json_encode(['reply' => "Je suis momentanement indisponible. Utilisez le formulaire ou appelez-nous."]); }
