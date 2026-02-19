<?php

namespace App\Jobs;

use App\Mail\StudentOnboardingMail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class SendStudentOnboardingEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;
    public int $timeout = 60;

    public function __construct(
        public string $email,
        public string $studentName,
        public string $registrationNumber,
        public string $defaultPassword,
        public string $completeRegistrationUrl
    ) {}

    public function handle(): void
    {
        Mail::to($this->email)->send(new StudentOnboardingMail(
            $this->studentName,
            $this->registrationNumber,
            $this->defaultPassword,
            $this->completeRegistrationUrl
        ));
    }
}

