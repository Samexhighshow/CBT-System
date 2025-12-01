<?php

namespace App\Notifications;

use App\Models\ExamAttempt;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResultReleasedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected $attempt;

    public function __construct(ExamAttempt $attempt)
    {
        $this->attempt = $attempt;
    }

    public function via($notifiable)
    {
        return ['mail', 'database'];
    }

    public function toMail($notifiable)
    {
        $percentage = ($this->attempt->score / $this->attempt->exam->total_marks) * 100;
        $passed = $percentage >= ($this->attempt->exam->pass_mark ?? 40);

        return (new MailMessage)
            ->subject('Exam Result Released: ' . $this->attempt->exam->title)
            ->greeting('Hello ' . $notifiable->name . '!')
            ->line('Your exam result has been released.')
            ->line('**Exam:** ' . $this->attempt->exam->title)
            ->line('**Score:** ' . $this->attempt->score . ' / ' . $this->attempt->exam->total_marks)
            ->line('**Percentage:** ' . number_format($percentage, 2) . '%')
            ->line('**Status:** ' . ($passed ? '✅ Passed' : '❌ Failed'))
            ->action('View Full Results', url('/student/results'))
            ->line($passed ? 'Congratulations on passing!' : 'Keep studying and you\'ll do better next time.');
    }

    public function toArray($notifiable)
    {
        return [
            'exam_id' => $this->attempt->exam_id,
            'exam_title' => $this->attempt->exam->title,
            'score' => $this->attempt->score,
            'total_marks' => $this->attempt->exam->total_marks,
            'message' => 'Result released for: ' . $this->attempt->exam->title,
        ];
    }
}
