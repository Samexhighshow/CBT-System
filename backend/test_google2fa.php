<?php
require __DIR__ . '/vendor/autoload.php';

use PragmaRX\Google2FA\Google2FA;

$google2fa = new Google2FA();
$secret = $google2fa->generateSecretKey();

echo "✓ Google2FA Package is working!\n";
echo "Generated Secret: " . $secret . "\n";
echo "QR Code URL: " . $google2fa->getQRCodeUrl('CBT System', 'test@example.com', $secret) . "\n";
