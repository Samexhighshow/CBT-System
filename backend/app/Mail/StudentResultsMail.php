<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class StudentResultsMail extends Mailable
{
    use Queueable, SerializesModels;

    public User $student;
    public array $reportCard;

    public function __construct(User $student, array $reportCard)
    {
        $this->student = $student;
        $this->reportCard = $reportCard;
    }

    public function build(): self
    {
        return $this
            ->subject('Your Exam Results')
            ->view('emails.student_results')
            ->with([
                'student' => $this->student,
                'reportCard' => $this->reportCard,
            ]);
    }
}
