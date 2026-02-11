<?php

$url = 'http://localhost:8000/api/auth/login';
$data = [
    'email' => 'isholesmauel062@gmail.com',
    'password' => 'Callmelater'
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Accept: application/json',
    'Content-Type: application/x-www-form-urlencoded'
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: $httpCode\n";
echo "Response: $response\n";

if ($httpCode == 200) {
    $json = json_decode($response, true);
    if (isset($json['token'])) {
        echo "\n✅ Login SUCCESS! Token received.\n";
        echo "User Role: " . ($json['user']['roles'][0]['name'] ?? 'None') . "\n";
    } else {
        echo "\n❌ Login Failed: No token in response.\n";
    }
} else {
    echo "\n❌ Login Failed: HTTP $httpCode\n";
}
