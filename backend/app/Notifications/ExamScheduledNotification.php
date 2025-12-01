<?php

namespace App\Notifications;

use App\Models\Exam;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ExamScheduledNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected $exam;

    public function __construct(Exam $exam)
    {
        $this->exam = $exam;
    }

    public function via($notifiable)
    {
        return ['mail', 'database'];
    }

    public function toMail($notifiable)
    {
        return (new MailMessage)
            ->subject('New Exam Scheduled: ' . $this->exam->title)
            ->greeting('Hello ' . $notifiable->name . '!')
            ->line('A new exam has been scheduled for you.')
            ->line('**Exam Title:** ' . $this->exam->title)
            ->line('**Subject:** ' . ($this->exam->subject->name ?? 'N/A'))
            ->line('**Duration:** ' . $this->exam->duration . ' minutes')
            ->line('**Start Time:** ' . $this->exam->start_time)
            ->line('**End Time:** ' . $this->exam->end_time)
            ->action('View Exam', url('/student/exams'))
            ->line('Please ensure you are ready before the exam starts.')
            ->line('Good luck!');
    }

    public function toArray($notifiable)
    {
        return [
            'exam_id' => $this->exam->id,
            'exam_title' => $this->exam->title,
            'start_time' => $this->exam->start_time,
            'end_time' => $this->exam->end_time,
            'message' => 'New exam scheduled: ' . $this->exam->title,
        ];
    }
}
