<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Student Account Setup</title>
</head>
<body style="margin:0;padding:0;background:#f6f8fc;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f8fc;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:24px 28px;background:#2563eb;color:#ffffff;">
              <h1 style="margin:0;font-size:22px;line-height:1.2;">CBT Student Portal</h1>
              <p style="margin:8px 0 0 0;font-size:14px;opacity:0.95;">Welcome to your school CBT system</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <p style="margin:0 0 12px 0;font-size:15px;">Hello <?php echo e($studentName); ?>,</p>
              <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#374151;">
                Your student account was created by the administrator. Use the details below to complete your registration.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;background:#f9fafb;margin:0 0 18px 0;">
                <tr>
                  <td style="padding:12px 14px;font-size:13px;color:#6b7280;">Registration Number</td>
                  <td style="padding:12px 14px;font-size:14px;font-weight:700;color:#111827;"><?php echo e($registrationNumber); ?></td>
                </tr>
                <tr>
                  <td style="padding:12px 14px;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;">Temporary Password</td>
                  <td style="padding:12px 14px;font-size:14px;font-weight:700;color:#111827;border-top:1px solid #e5e7eb;"><?php echo e($defaultPassword); ?></td>
                </tr>
              </table>

              <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#374151;">
                Complete your profile and change your password immediately after first login.
              </p>

              <p style="margin:0 0 18px 0;">
                <a href="<?php echo e($completeRegistrationUrl); ?>" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 16px;font-size:14px;font-weight:700;">
                  Complete Registration
                </a>
              </p>

              <p style="margin:0;font-size:12px;color:#6b7280;">
                If you did not expect this email, contact your school administrator.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>

<?php /**PATH C:\xampp\htdocs\CBT-System\backend\resources\views/emails/student_onboarding.blade.php ENDPATH**/ ?>