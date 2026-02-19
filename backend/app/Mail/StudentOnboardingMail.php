<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class StudentOnboardingMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $studentName,
        public string $registrationNumber,
        public string $defaultPassword,
        public string $completeRegistrationUrl
    ) {}

    public function build(): self
    {
        return $this
            ->subject('Your CBT Student Account Details')
            ->view('emails.student_onboarding');
    }
}

