<?php

namespace App\Traits;

use App\Models\ActivityLog;

trait LogsActivity
{
    /**
     * Log an activity.
     */
    protected function logActivity(
        string $description,
        $subject = null,
        string $event = null,
        array $properties = []
    ): ActivityLog {
        return ActivityLog::logActivity($description, $subject, $event, $properties);
    }

    /**
     * Log a creation event.
     */
    protected function logCreated($model, array $properties = []): ActivityLog
    {
        return $this->logActivity(
            description: class_basename($model) . ' created',
            subject: $model,
            event: 'created',
            properties: array_merge(['attributes' => $model->toArray()], $properties)
        );
    }

    /**
     * Log an update event.
     */
    protected function logUpdated($model, array $old = [], array $properties = []): ActivityLog
    {
        return $this->logActivity(
            description: class_basename($model) . ' updated',
            subject: $model,
            event: 'updated',
            properties: array_merge([
                'old' => $old,
                'attributes' => $model->toArray()
            ], $properties)
        );
    }

    /**
     * Log a deletion event.
     */
    protected function logDeleted($model, array $properties = []): ActivityLog
    {
        return $this->logActivity(
            description: class_basename($model) . ' deleted',
            subject: $model,
            event: 'deleted',
            properties: array_merge(['attributes' => $model->toArray()], $properties)
        );
    }

    /**
     * Log a login event.
     */
    protected function logLogin($user): ActivityLog
    {
        return $this->logActivity(
            description: 'User logged in',
            subject: $user,
            event: 'login',
            properties: ['ip' => request()->ip(), 'user_agent' => request()->userAgent()]
        );
    }

    /**
     * Log a logout event.
     */
    protected function logLogout($user): ActivityLog
    {
        return $this->logActivity(
            description: 'User logged out',
            subject: $user,
            event: 'logout',
            properties: ['ip' => request()->ip()]
        );
    }

    /**
     * Log an exam submission.
     */
    protected function logExamSubmission($exam, $student, array $properties = []): ActivityLog
    {
        return $this->logActivity(
            description: 'Exam submitted',
            subject: $exam,
            event: 'exam_submitted',
            properties: array_merge([
                'student_id' => $student->id,
                'student_name' => $student->name ?? $student->student_id,
            ], $properties)
        );
    }

    /**
     * Log a grade assignment.
     */
    protected function logGraded($attempt, array $properties = []): ActivityLog
    {
        return $this->logActivity(
            description: 'Exam graded',
            subject: $attempt,
            event: 'graded',
            properties: array_merge([
                'score' => $attempt->score,
                'total' => $attempt->total_marks,
            ], $properties)
        );
    }
}
