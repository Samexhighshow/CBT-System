<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Attempt Report - {{ $attempt->exam->title }}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 20px;
        }
        .header h1 {
            color: #1e40af;
            margin: 10px 0;
        }
        .summary {
            margin-bottom: 30px;
            padding: 20px;
            background: #f9fafb;
            border-radius: 5px;
        }
        .info-row {
            display: flex;
            margin-bottom: 10px;
        }
        .info-label {
            font-weight: bold;
            width: 200px;
        }
        .score-card {
            text-align: center;
            padding: 20px;
            background: #eff6ff;
            border: 2px solid #3b82f6;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .score-card h2 {
            color: #1e40af;
            margin: 10px 0;
        }
        .question-item {
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid #e5e7eb;
            border-radius: 5px;
        }
        .question-number {
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 10px;
        }
        .question-text {
            margin-bottom: 10px;
        }
        .answer-row {
            display: flex;
            margin-bottom: 5px;
            padding: 5px;
        }
        .answer-label {
            font-weight: bold;
            width: 150px;
        }
        .correct {
            background-color: #d1fae5;
            padding: 10px;
            border-radius: 5px;
        }
        .incorrect {
            background-color: #fee2e2;
            padding: 10px;
            border-radius: 5px;
        }
        .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>CBT System - Detailed Attempt Report</h1>
        <h2>{{ $attempt->exam->title }}</h2>
    </div>

    <div class="summary">
        <h3>Exam Information</h3>
        <div class="info-row">
            <span class="info-label">Student:</span>
            <span>{{ $attempt->student->first_name }} {{ $attempt->student->last_name }} ({{ $attempt->student->registration_number }})</span>
        </div>
        <div class="info-row">
            <span class="info-label">Department:</span>
            <span>{{ $attempt->student->department->name ?? 'N/A' }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Subject:</span>
            <span>{{ $attempt->exam->subject->name }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Started At:</span>
            <span>{{ $attempt->started_at->format('Y-m-d H:i:s') }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Completed At:</span>
            <span>{{ $attempt->completed_at->format('Y-m-d H:i:s') }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Duration:</span>
            <span>{{ $attempt->started_at->diffInMinutes($attempt->completed_at) }} minutes</span>
        </div>
    </div>

    <div class="score-card">
        <h2>Final Score</h2>
        <h1 style="font-size: 48px; margin: 10px 0;">{{ $attempt->score }}/{{ $attempt->exam->total_marks }}</h1>
        <h3>{{ $percentage }}%</h3>
        <p style="margin-top: 15px;">
            Correct Answers: {{ $correct_answers }}/{{ $total_questions }}
        </p>
    </div>

    <h3>Question-by-Question Breakdown</h3>
    @foreach($questions as $index => $question)
    <div class="question-item {{ $question['is_correct'] ? 'correct' : 'incorrect' }}">
        <div class="question-number">Question {{ $index + 1 }} ({{ $question['marks'] }} marks)</div>
        <div class="question-text">{{ $question['question_text'] }}</div>
        <div class="answer-row">
            <span class="answer-label">Your Answer:</span>
            <span>{{ $question['selected_answer'] }}</span>
        </div>
        <div class="answer-row">
            <span class="answer-label">Correct Answer:</span>
            <span>{{ $question['correct_answer'] }}</span>
        </div>
        <div class="answer-row">
            <span class="answer-label">Marks Obtained:</span>
            <span>{{ $question['marks_obtained'] }}/{{ $question['marks'] }}</span>
        </div>
    </div>
    @endforeach

    <div class="footer">
        <p>Generated on {{ $generated_at }}</p>
        <p>&copy; 2025 CBT System. All rights reserved.</p>
    </div>
</body>
</html>
