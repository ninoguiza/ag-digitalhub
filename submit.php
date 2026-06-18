<?php
error_reporting(0);
ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://garage.ag-digitalhub.eu');
header('Cache-Control: no-store, no-cache, must-revalidate');

// Preflight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// --- Rate limiting : 5 req/min/IP ---
$ip = filter_var($_SERVER['HTTP_X_FORWARDED_FOR'] ?? '', FILTER_VALIDATE_IP) ?: ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$rl_base = dirname(dirname(__FILE__));
$rl_dir  = (is_writable($rl_base) ? $rl_base : sys_get_temp_dir()) . '/agdh_rl_cache/';
if (!is_dir($rl_dir)) { @mkdir($rl_dir, 0700, true); }
$rl_file = $rl_dir . 'rl_' . md5($ip) . '.json';
$lock    = fopen($rl_dir . 'lk_' . md5($ip) . '.lock', 'c');
flock($lock, LOCK_EX);
$now = time();
$rl  = file_exists($rl_file) ? json_decode(file_get_contents($rl_file), true) : ['count' => 0, 'ts' => $now];
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

// --- Content-Type ---
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

// --- Validation et sanitisation ---
$name   = htmlspecialchars(str_replace(["\r", "\n", "\t"], '', trim($input['name']   ?? '')), ENT_QUOTES, 'UTF-8');
$garage = htmlspecialchars(str_replace(["\r", "\n", "\t"], '', trim($input['garage'] ?? '')), ENT_QUOTES, 'UTF-8');

if (empty($name)   || mb_strlen($name)   > 80)  { http_response_code(400); echo json_encode(['error' => 'Prénom invalide']);        exit; }
if (empty($garage) || mb_strlen($garage) > 100) { http_response_code(400); echo json_encode(['error' => 'Nom de garage invalide']); exit; }

$allowed_rdv = ['moins-10', '10-20', '20-30', 'plus-30'];
$rdv_raw = trim($input['rdv'] ?? '');
if (!in_array($rdv_raw, $allowed_rdv, true)) { http_response_code(400); echo json_encode(['error' => 'Volume RDV invalide']); exit; }
$rdv = $rdv_raw;

$raw_phone = trim($input['phone'] ?? '');
if (!preg_match('/^\+?[\d\s\-\(\)\.\/]{7,20}$/', $raw_phone)) {
    http_response_code(400);
    echo json_encode(['error' => 'Numéro de téléphone invalide']);
    exit;
}
$phone = str_replace(["\r", "\n", "\t"], '', $raw_phone); // regex valide déjà tous les chars — pas d'htmlspecialchars en body texte

// Email (optionnel — pour envoyer une confirmation au lead)
$lead_email = '';
$raw_email = trim($input['email'] ?? '');
if ($raw_email !== '') {
    if (!filter_var($raw_email, FILTER_VALIDATE_EMAIL) || mb_strlen($raw_email) > 120) {
        http_response_code(400);
        echo json_encode(['error' => 'Email invalide']);
        exit;
    }
    $lead_email = strtolower($raw_email);
}

// RGPD
if (empty($input['gdpr']) || $input['gdpr'] !== true) {
    http_response_code(400);
    echo json_encode(['error' => 'Consentement RGPD requis']);
    exit;
}

// --- Configuration mail ---
$from_name = 'Garage.RDV';
$from_addr = 'noreply@ag-digitalhub.eu';
$to_intern = 'contact@ag-digitalhub.eu';

$rdv_labels = [
    'moins-10' => 'Moins de 10 RDV/semaine',
    '10-20'    => '10 à 20 RDV/semaine',
    '20-30'    => '20 à 30 RDV/semaine',
    'plus-30'  => 'Plus de 30 RDV/semaine',
];
$rdv_label = $rdv_labels[$rdv] ?? $rdv;

// --- Email de notification interne ---
$subj_int  = '=?UTF-8?B?' . base64_encode("Nouveau lead — $name ($garage)") . '?=';
$body_int  = "Nouvelle demande via garage.ag-digitalhub.eu\n";
$body_int .= str_repeat('=', 42) . "\n";
$body_int .= "Prénom     : $name\n";
$body_int .= "Téléphone  : $phone\n";
if ($lead_email) { $body_int .= "Email      : $lead_email\n"; }
$body_int .= "Garage     : $garage\n";
$body_int .= "Volume RDV : $rdv_label\n";
$body_int .= str_repeat('=', 42) . "\n";
$body_int .= "Date       : " . date('d/m/Y H:i') . " UTC\n";
$body_int .= "Action     : Appeler sous 24h\n";

$hdrs_int  = "From: $from_name <$from_addr>\r\n";
$hdrs_int .= $lead_email ? "Reply-To: $name <$lead_email>\r\n" : "Reply-To: $from_name <$to_intern>\r\n";
$hdrs_int .= "Return-Path: <$from_addr>\r\n";
$hdrs_int .= "MIME-Version: 1.0\r\n";
$hdrs_int .= "Content-Type: text/plain; charset=UTF-8\r\n";
$hdrs_int .= "Content-Transfer-Encoding: 8bit\r\n";
$hdrs_int .= "X-Mailer: GarageRDV-Mailer/2.0\r\n";

mail($to_intern, $subj_int, $body_int, $hdrs_int);

// --- Email de confirmation au lead (si email fourni) ---
if ($lead_email) {
    $subj_conf = '=?UTF-8?B?' . base64_encode("Votre demande d'audit — on vous rappelle sous 24h") . '?=';
    $body_conf  = "Bonjour $name,\n\n";
    $body_conf .= "Nous avons bien reçu votre demande d'audit pour $garage.\n\n";
    $body_conf .= str_repeat('-', 40) . "\n";
    $body_conf .= "Récapitulatif de votre demande :\n";
    $body_conf .= "  Garage     : $garage\n";
    $body_conf .= "  Téléphone  : $phone\n";
    $body_conf .= "  Volume RDV : $rdv_label\n";
    $body_conf .= str_repeat('-', 40) . "\n\n";
    $body_conf .= "Un conseiller vous appellera sous 24h pour analyser votre zone\n";
    $body_conf .= "et vous dire exactement combien de rendez-vous supplémentaires\n";
    $body_conf .= "vous pouvez obtenir chaque semaine.\n\n";
    $body_conf .= "Si vous n'êtes pas disponible dans ce délai, répondez simplement\n";
    $body_conf .= "à cet email avec vos créneaux préférés.\n\n";
    $body_conf .= "À très bientôt,\n";
    $body_conf .= "L'équipe Garage.RDV\n\n";
    $body_conf .= str_repeat('-', 40) . "\n";
    $body_conf .= "Garage.RDV — Systèmes d'acquisition pour garages auto\n";
    $body_conf .= "contact@ag-digitalhub.eu | https://garage.ag-digitalhub.eu\n\n";
    $body_conf .= "Vous recevez cet email uniquement parce que vous avez rempli\n";
    $body_conf .= "le formulaire sur garage.ag-digitalhub.eu. Aucun abonnement.";

    $hdrs_conf  = "From: $from_name <$from_addr>\r\n";
    $hdrs_conf .= "Reply-To: $from_name <$to_intern>\r\n";
    $hdrs_conf .= "Return-Path: <$from_addr>\r\n";
    $hdrs_conf .= "MIME-Version: 1.0\r\n";
    $hdrs_conf .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $hdrs_conf .= "Content-Transfer-Encoding: 8bit\r\n";
    $hdrs_conf .= "X-Mailer: GarageRDV-Mailer/2.0\r\n";

    mail($lead_email, $subj_conf, $body_conf, $hdrs_conf);
}

echo json_encode(['success' => true]);
