<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class PasswordResetOtpMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $code;
    public int $expiry;

    public function __construct(string $code, int $expiryMinutes)
    {
        $this->code = $code;
        $this->expiry = $expiryMinutes;
    }

    public function build(): self
    {
        return $this->subject('Your Password Reset OTP')
            ->view('emails.password_reset_otp')
            ->with([
                'code' => $this->code,
                'expiry' => $this->expiry,
            ]);
    }
}
