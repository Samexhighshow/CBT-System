<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::where('email', 'admin@cbtsystem.local')->first();
if (!$user) {
    echo "Admin user not found" . PHP_EOL;
    exit(1);
}

$verified = $user->email_verified_at ? $user->email_verified_at->toDateTimeString() : 'null';
$passOk = Illuminate\Support\Facades\Hash::check('admin123456', $user->password) ? 'true' : 'false';

printf("verified_at=%s\npassword_ok=%s\n", $verified, $passOk);
