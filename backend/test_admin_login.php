<?php

require 'vendor/autoload.php';

use Illuminate\Support\Facades\Http;

$url = 'http://127.0.0.1:8000/api/auth/login';
$email = 'isholasamuel062@gmail.com';
$password = 'Callmelater';

echo "Testing Admin Login...\n";
echo "URL: $url\n";
echo "Email: $email\n";

$ch = curl_init($url);
$payload = json_encode(['email' => $email, 'password' => $password]);

curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$result = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: $httpCode\n";
echo "Response: $result\n";

if ($httpCode === 200) {
    echo "\n✅ Login Successful!\n";
    $data = json_decode($result, true);
    if (isset($data['token'])) {
        echo "Token received: " . substr($data['token'], 0, 20) . "...\n";
        echo "User Role: " . ($data['user']['roles'][0]['name'] ?? 'None') . "\n";
    }
} else {
    echo "\n❌ Login Failed.\n";
}
