<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Two-Factor Authentication Code</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Two-Factor Authentication</h2>
        
        <p>Your two-factor authentication code is:</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h1 style="margin: 0; color: #1f2937; letter-spacing: 5px;"><?php echo e($otp); ?></h1>
        </div>
        
        <p>This code will expire in 10 minutes.</p>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you didn't request this code, please ignore this email or contact support if you have concerns.
        </p>
    </div>
</body>
</html>
<?php /**PATH C:\xampp\htdocs\CBT System\backend\resources\views/emails/two_factor_otp.blade.php ENDPATH**/ ?>