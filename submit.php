<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://garage.ag-digitalhub.eu');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// --- Rate limiting : 5 requêtes max par IP par minute ---
$ip      = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rl_file = sys_get_temp_dir() . '/agdh_rl_' . md5($ip) . '.json';
$lock    = fopen(sys_get_temp_dir() . '/agdh_rl_lock_' . md5($ip) . '.lock', 'c');
flock($lock, LOCK_EX);
$now     = time();
$rl      = file_exists($rl_file) ? json_decode(file_get_contents($rl_file), true) : ['count' => 0, 'ts' => $now];
if ($now - $rl['ts'] < 60) {
    if ($rl['count'] >= 5) {
        flock($lock, LOCK_UN); fclose($lock);
        http_response_code(429);
        echo json_encode(['error' => 'Trop de requêtes. Réessayez dans une minute.']);
        exit;
    }
    $rl['count']++;
} else {
    $rl = ['count' => 1, 'ts' => $now];
}
file_put_contents($rl_file, json_encode($rl));
flock($lock, LOCK_UN); fclose($lock);

// --- Content-Type enforcement ---
$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (strpos($ct, 'application/json') === false) {
    http_response_code(415);
    echo json_encode(['error' => 'Content-Type invalide — application/json requis']);
    exit;
}

// --- Parsing JSON ---
$raw   = file_get_contents('php://input');
$input = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE || !is_array($input)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

// --- Validation et sanitisation des champs ---
$name   = htmlspecialchars(trim($input['name']   ?? ''), ENT_QUOTES, 'UTF-8');
$garage = htmlspecialchars(trim($input['garage'] ?? ''), ENT_QUOTES, 'UTF-8');
$rdv    = htmlspecialchars(trim($input['rdv']    ?? ''), ENT_QUOTES, 'UTF-8');

// Validation stricte du téléphone — neutralise l'injection d'en-têtes email
$raw_phone = trim($input['phone'] ?? '');
if (!preg_match('/^\+?[\d\s\-\(\)\.\/]{7,20}$/', $raw_phone)) {
    http_response_code(400);
    echo json_encode(['error' => 'Numéro de téléphone invalide']);
    exit;
}
$phone = str_replace(["\r", "\n", "\t"], '', htmlspecialchars($raw_phone, ENT_QUOTES, 'UTF-8'));

if (empty($name) || empty($phone)) {
    http_response_code(400);
    echo json_encode(['error' => 'Champs requis manquants']);
    exit;
}

// --- Validation consentement RGPD côté serveur ---
if (empty($input['gdpr']) || $input['gdpr'] !== true) {
    http_response_code(400);
    echo json_encode(['error' => 'Consentement RGPD requis']);
    exit;
}

// --- Envoi email ---
$to      = 'contact@ag-digitalhub.eu';
$subject = '=?UTF-8?B?' . base64_encode("Nouvelle demande — $name ($garage)") . '?=';
$body    = "Nouvelle demande via garage.ag-digitalhub.eu\n\n"
         . "Prénom      : $name\n"
         . "Téléphone   : $phone\n"
         . "Garage      : $garage\n"
         . "Volume RDV  : $rdv\n\n"
         . "Date        : " . date('d/m/Y H:i') . " UTC";

$headers  = "From: noreply@ag-digitalhub.eu\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
$headers .= "X-Mailer: AG-Mailer/1.0";

$sent = mail($to, $subject, $body, $headers);
echo json_encode(['success' => $sent]);
