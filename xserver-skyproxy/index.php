<?php
declare(strict_types=1);

/*
  SkyProxy for XServer
  - /skyproxy/xrpc/* を Bluesky へ中継
  - CORS は許可オリジンのみ
  - createSession は allowlist の handle のみ許可
  - 認証付きリクエストは allowlist の DID のみ許可
  - refreshSession は Bearer token の DID から PDS を解決して転送
*/

$basePath = '/skyproxy';
$configPath = __DIR__ . '/allowed-users.json';
$cachePath = __DIR__ . '/allowed-users.cache.json';
$allowedOrigins = [
    'https://rino-program.github.io',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
];

function starts_with(string $haystack, string $needle): bool
{
    return strncmp($haystack, $needle, strlen($needle)) === 0;
}

function json_out(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function normalize_handle(string $handle): string
{
    $value = strtolower(trim($handle));
    return ltrim($value, '@');
}

function base64url_decode_str(string $input): string
{
    $remainder = strlen($input) % 4;
    if ($remainder > 0) {
        $input .= str_repeat('=', 4 - $remainder);
    }
    $input = strtr($input, '-_', '+/');
    $decoded = base64_decode($input, true);
    return $decoded === false ? '' : $decoded;
}

function parse_jwt_payload(string $jwt): array
{
    $parts = explode('.', $jwt);
    if (count($parts) < 2) {
        return [];
    }
    $payloadRaw = base64url_decode_str($parts[1]);
    if ($payloadRaw === '') {
        return [];
    }
    $payload = json_decode($payloadRaw, true);
    return is_array($payload) ? $payload : [];
}

function fetch_json(string $url, int $timeoutSec = 10): array
{
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, $timeoutSec);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($raw === false || $err !== '') {
        return [];
    }
    if ($status < 200 || $status >= 300) {
        return [];
    }
    $json = json_decode((string)$raw, true);
    return is_array($json) ? $json : [];
}

function resolve_handle_to_did(string $handle): string
{
    $handle = normalize_handle($handle);
    if ($handle === '') {
        return '';
    }
    $url = 'https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=' . rawurlencode($handle);
    $data = fetch_json($url, 12);
    $did = isset($data['did']) ? trim((string)$data['did']) : '';
    return $did;
}

function resolve_pds_from_did(string $did): string
{
    $did = trim($did);
    if ($did === '' || !starts_with($did, 'did:')) {
        return '';
    }

    if (starts_with($did, 'did:plc:')) {
        $doc = fetch_json('https://plc.directory/' . rawurlencode($did), 12);
        if (!empty($doc['service']) && is_array($doc['service'])) {
            foreach ($doc['service'] as $svc) {
                $type = isset($svc['type']) ? (string)$svc['type'] : '';
                $id = isset($svc['id']) ? (string)$svc['id'] : '';
                $ep = isset($svc['serviceEndpoint']) ? (string)$svc['serviceEndpoint'] : '';
                if ($ep !== '' && ($type === 'AtprotoPersonalDataServer' || $id === '#atproto_pds')) {
                    return rtrim($ep, '/');
                }
            }
        }
    }

    if (starts_with($did, 'did:web:')) {
        $host = substr($did, strlen('did:web:'));
        if ($host !== '') {
            return 'https://' . $host;
        }
    }

    return '';
}

function load_allowlist(string $configPath, string $cachePath): array
{
    $configMtime = is_file($configPath) ? (int)filemtime($configPath) : 0;
    if (is_file($cachePath)) {
        $cacheRaw = file_get_contents($cachePath);
        $cache = is_string($cacheRaw) ? json_decode($cacheRaw, true) : null;
        if (is_array($cache) && (int)($cache['configMtime'] ?? -1) === $configMtime) {
            $handles = isset($cache['allowedHandles']) && is_array($cache['allowedHandles']) ? $cache['allowedHandles'] : [];
            $dids = isset($cache['allowedDids']) && is_array($cache['allowedDids']) ? $cache['allowedDids'] : [];
            return [
                'allowedHandles' => array_values(array_filter(array_map('normalize_handle', $handles))),
                'allowedDids' => array_values(array_filter(array_map('trim', $dids))),
            ];
        }
    }

    $handles = [];
    $dids = [];
    if (is_file($configPath)) {
        $raw = file_get_contents($configPath);
        $config = is_string($raw) ? json_decode($raw, true) : null;
        if (is_array($config)) {
            if (isset($config['allowedHandles']) && is_array($config['allowedHandles'])) {
                $handles = array_values(array_filter(array_map('normalize_handle', $config['allowedHandles'])));
            }
            if (isset($config['allowedDids']) && is_array($config['allowedDids'])) {
                $dids = array_values(array_filter(array_map('trim', $config['allowedDids'])));
            }
        }
    }

    $resolved = [];
    foreach ($handles as $handle) {
        $did = resolve_handle_to_did($handle);
        if ($did !== '') {
            $resolved[] = $did;
        }
    }

    $mergedDids = array_values(array_unique(array_merge($dids, $resolved)));
    @file_put_contents($cachePath, json_encode([
        'configMtime' => $configMtime,
        'allowedHandles' => $handles,
        'allowedDids' => $mergedDids,
        'generatedAt' => gmdate('c'),
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    return [
        'allowedHandles' => $handles,
        'allowedDids' => $mergedDids,
    ];
}

function apply_cors(array $allowedOrigins): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type, Atproto-Proxy, X-Requested-With');
        header('Access-Control-Max-Age: 600');
    }
}

function get_auth_header(): string
{
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        return (string)$_SERVER['HTTP_AUTHORIZATION'];
    }
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return (string)$_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (is_array($headers)) {
            foreach ($headers as $key => $value) {
                if (strtolower((string)$key) === 'authorization') {
                    return (string)$value;
                }
            }
        }
    }
    return '';
}

function allowed_handle_from_create_session_body(string $body): string
{
    $data = json_decode($body, true);
    if (!is_array($data)) {
        return '';
    }
    return normalize_handle((string)($data['identifier'] ?? ''));
}

function token_did_from_auth_header(string $authHeader): string
{
    if (!preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) {
        return '';
    }
    $payload = parse_jwt_payload(trim($matches[1]));
    $did = '';
    if (!empty($payload['sub'])) {
        $did = trim((string)$payload['sub']);
    } elseif (!empty($payload['iss'])) {
        $did = trim((string)$payload['iss']);
    }
    return $did;
}

function forward_request(string $targetUrl, string $method, string $authHeader, string $rawBody = ''): array
{
    $forwardHeaders = [];
    if (!empty($_SERVER['CONTENT_TYPE'])) {
        $forwardHeaders[] = 'Content-Type: ' . $_SERVER['CONTENT_TYPE'];
    }
    if ($authHeader !== '') {
        $forwardHeaders[] = 'Authorization: ' . $authHeader;
    }
    if (!empty($_SERVER['HTTP_ATPROTO_PROXY'])) {
        $forwardHeaders[] = 'Atproto-Proxy: ' . $_SERVER['HTTP_ATPROTO_PROXY'];
    }

    $ch = curl_init($targetUrl);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $forwardHeaders);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 8);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);

    if ($method !== 'GET' && $method !== 'HEAD') {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $rawBody);
    }

    $resp = curl_exec($ch);
    if ($resp === false) {
        $err = curl_error($ch);
        curl_close($ch);
        return [
            'ok' => false,
            'status' => 502,
            'contentType' => 'application/json; charset=utf-8',
            'body' => json_encode([
                'error' => 'proxy_failed',
                'detail' => $err,
                'target' => $targetUrl,
            ], JSON_UNESCAPED_UNICODE),
        ];
    }

    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $respHeadersRaw = substr($resp, 0, $headerSize);
    $respBody = substr($resp, $headerSize);
    curl_close($ch);

    $respContentType = 'application/json; charset=utf-8';
    $headerLines = explode("\r\n", (string)$respHeadersRaw);
    foreach ($headerLines as $line) {
        if (stripos($line, 'Content-Type:') === 0) {
            $respContentType = trim(substr($line, strlen('Content-Type:')));
            break;
        }
    }

    return [
        'ok' => true,
        'status' => $status,
        'contentType' => $respContentType,
        'body' => $respBody,
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($requestUri, PHP_URL_PATH);
if (!is_string($path) || $path === '') {
    $path = '/';
}

apply_cors($allowedOrigins);

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (starts_with($path, $basePath)) {
    $path = substr($path, strlen($basePath));
}

if ($path === '' || $path === '/') {
    json_out(200, [
        'ok' => true,
        'service' => 'skyproxy',
        'message' => 'running',
    ]);
}

if (!starts_with($path, '/xrpc/')) {
    json_out(404, ['error' => 'not_found']);
}

$allow = load_allowlist($configPath, $cachePath);
$allowedHandles = $allow['allowedHandles'];
$allowedDids = $allow['allowedDids'];
$authHeader = get_auth_header();
$requestBody = file_get_contents('php://input');
if ($requestBody === false) {
    $requestBody = '';
}
$query = $_SERVER['QUERY_STRING'] ?? '';

$publicUnauthPaths = [
    '/xrpc/com.atproto.server.describeServer',
    '/xrpc/com.atproto.identity.resolveHandle',
];

if ($path === '/xrpc/com.atproto.server.createSession') {
    $identifier = allowed_handle_from_create_session_body($requestBody);
    if ($identifier === '' || !in_array($identifier, $allowedHandles, true)) {
        json_out(403, [
            'error' => 'Forbidden',
            'message' => 'This account is not allowed to use the proxy.',
        ]);
    }
    $targetUrl = 'https://bsky.social' . $path . ($query !== '' ? ('?' . $query) : '');
    $result = forward_request($targetUrl, $method, $authHeader, $requestBody);
    if (!$result['ok']) {
        json_out((int)$result['status'], [
            'error' => 'proxy_failed',
            'detail' => $result['body'],
        ]);
    }
    http_response_code((int)$result['status']);
    header('Content-Type: ' . $result['contentType']);
    echo $result['body'];
    exit;
}

if (in_array($path, $publicUnauthPaths, true)) {
    $targetHost = 'https://bsky.social';
    $targetUrl = rtrim($targetHost, '/') . $path . ($query !== '' ? ('?' . $query) : '');
    $result = forward_request($targetUrl, $method, $authHeader, $requestBody);
    if (!$result['ok']) {
        json_out((int)$result['status'], [
            'error' => 'proxy_failed',
            'detail' => $result['body'],
        ]);
    }
    http_response_code((int)$result['status']);
    header('Content-Type: ' . $result['contentType']);
    echo $result['body'];
    exit;
}

if ($authHeader === '') {
    json_out(401, [
        'error' => 'AuthenticationRequired',
        'message' => 'missing auth',
    ]);
}

$tokenDid = token_did_from_auth_header($authHeader);
if ($tokenDid === '' || !in_array($tokenDid, $allowedDids, true)) {
    json_out(403, [
        'error' => 'Forbidden',
        'message' => 'This account is not allowed to use the proxy.',
    ]);
}

$targetHost = 'https://bsky.social';
if (starts_with($path, '/xrpc/chat.bsky.convo.')) {
    $targetHost = 'https://api.bsky.chat';
}

if ($path === '/xrpc/com.atproto.server.refreshSession') {
    $pds = resolve_pds_from_did($tokenDid);
    if ($pds !== '') {
        $targetHost = $pds;
    }
}

$targetUrl = rtrim($targetHost, '/') . $path . ($query !== '' ? ('?' . $query) : '');
$result = forward_request($targetUrl, $method, $authHeader, $requestBody);
if (!$result['ok']) {
    json_out((int)$result['status'], [
        'error' => 'proxy_failed',
        'detail' => $result['body'],
    ]);
}

http_response_code((int)$result['status']);
header('Content-Type: ' . $result['contentType']);
echo $result['body'];
