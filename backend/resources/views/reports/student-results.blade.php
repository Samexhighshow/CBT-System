<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Student Results - {{ $student->registration_number }}</title>
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
        .student-info {
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
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 30px;
        }
        .stat-box {
            border: 1px solid #e5e7eb;
            padding: 15px;
            border-radius: 5px;
            text-align: center;
            background: #f9fafb;
        }
        .stat-label {
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 5px;
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #1e40af;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th {
            background-color: #3b82f6;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 10px;
            border-bottom: 1px solid #e5e7eb;
        }
        tr:nth-child(even) {
            background-color: #f9fafb;
        }
        .passed {
            color: #059669;
            font-weight: bold;
        }
        .failed {
            color: #dc2626;
            font-weight: bold;
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
        <h1>CBT System - Student Results</h1>
        <h2>{{ $student->first_name }} {{ $student->last_name }}</h2>
    </div>

    <div class="student-info">
        <h3>Student Information</h3>
        <div class="info-row">
            <span class="info-label">Registration Number:</span>
            <span>{{ $student->registration_number }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Email:</span>
            <span>{{ $student->email }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Department:</span>
            <span>{{ $student->department->name ?? 'N/A' }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Class Level:</span>
            <span>{{ $student->class_level }}</span>
        </div>
    </div>

    <h3>Performance Summary</h3>
    <div class="stats-grid">
        <div class="stat-box">
            <div class="stat-label">Total Exams</div>
            <div class="stat-value">{{ $total_exams }}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Average Score</div>
            <div class="stat-value">{{ $average_score }}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Pass Rate</div>
            <div class="stat-value">{{ $pass_rate }}%</div>
        </div>
    </div>

    <h3>Exam Results</h3>
    <table>
        <thead>
            <tr>
                <th>Exam Title</th>
                <th>Subject</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Status</th>
                <th>Completed At</th>
            </tr>
        </thead>
        <tbody>
            @foreach($attempts as $attempt)
            <tr>
                <td>{{ $attempt->exam->title }}</td>
                <td>{{ $attempt->exam->subject->name }}</td>
                <td>{{ $attempt->score }}/{{ $attempt->exam->total_marks }}</td>
                <td>{{ round(($attempt->score / $attempt->exam->total_marks) * 100, 2) }}%</td>
                <td class="{{ $attempt->score >= $attempt->exam->passing_marks ? 'passed' : 'failed' }}">
                    {{ $attempt->score >= $attempt->exam->passing_marks ? 'Passed' : 'Failed' }}
                </td>
                <td>{{ $attempt->completed_at->format('Y-m-d H:i') }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div class="footer">
        <p>Generated on {{ $generated_at }}</p>
        <p>&copy; 2025 CBT System. All rights reserved.</p>
    </div>
</body>
</html>
