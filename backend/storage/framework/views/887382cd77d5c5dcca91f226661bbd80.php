<!DOCTYPE html>
<html>

<head>
    <title>Account Pending Approval</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            padding: 20px;
        }

        .container {
            max-width: 600px;
            margin: 0 auto;
            background: #fff;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }

        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
        }

        .content {
            padding: 20px 0;
        }

        .footer {
            text-align: center;
            font-size: 12px;
            color: #777;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }

        .button {
            display: inline-block;
            background-color: #007bff;
            color: #fff;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 20px;
        }
    </style>
</head>

<body>
    <div class="container">
        <div class="header">
            <h2>Welcome to CBT System</h2>
        </div>
        <div class="content">
            <p>Dear <?php echo e($user->name); ?>,</p>

            <p>Thank you for registering with the CBT System.</p>

            <p>Your account has been created successfully and is currently <strong>pending administrator
                    approval</strong>.</p>

            <p>You cannot log in until an administrator reviews and approves your account.</p>

            <p>You will receive another email once your account has been approved.</p>

            <p>Thank you for your patience.</p>
        </div>
        <div class="footer">
            <p>&copy; <?php echo e(date('Y')); ?> CBT System. All rights reserved.</p>
        </div>
    </div>
</body>

</html><?php /**PATH C:\xampp\htdocs\CBT-System\backend\resources\views/emails/admin_approval_pending.blade.php ENDPATH**/ ?>