<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Exam Report - {{ $exam->title }}</title>
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
        .info-section {
            margin-bottom: 30px;
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
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-box {
            border: 1px solid #e5e7eb;
            padding: 15px;
            border-radius: 5px;
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
        <h1>CBT System - Exam Report</h1>
        <h2>{{ $exam->title }}</h2>
        <p>Subject: {{ $exam->subject->name }}</p>
    </div>

    <div class="info-section">
        <h3>Exam Information</h3>
        <div class="info-row">
            <span class="info-label">Duration:</span>
            <span>{{ $exam->duration_minutes }} minutes</span>
        </div>
        <div class="info-row">
            <span class="info-label">Total Marks:</span>
            <span>{{ $exam->total_marks }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Passing Marks:</span>
            <span>{{ $exam->passing_marks }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Start Time:</span>
            <span>{{ $exam->start_time }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">End Time:</span>
            <span>{{ $exam->end_time }}</span>
        </div>
    </div>

    <h3>Statistics</h3>
    <div class="stats-grid">
        <div class="stat-box">
            <div class="stat-label">Total Attempts</div>
            <div class="stat-value">{{ $total_attempts }}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Average Score</div>
            <div class="stat-value">{{ $average_score }}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Highest Score</div>
            <div class="stat-value">{{ $highest_score }}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Pass Rate</div>
            <div class="stat-value">{{ $pass_rate }}%</div>
        </div>
    </div>

    <h3>Student Results</h3>
    <table>
        <thead>
            <tr>
                <th>Rank</th>
                <th>Registration No.</th>
                <th>Student Name</th>
                <th>Department</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            @foreach($attempts as $index => $attempt)
            <tr>
                <td>{{ $index + 1 }}</td>
                <td>{{ $attempt->student->registration_number }}</td>
                <td>{{ $attempt->student->first_name }} {{ $attempt->student->last_name }}</td>
                <td>{{ $attempt->student->department->name ?? 'N/A' }}</td>
                <td>{{ $attempt->score }}/{{ $exam->total_marks }}</td>
                <td>{{ round(($attempt->score / $exam->total_marks) * 100, 2) }}%</td>
                <td class="{{ $attempt->score >= $exam->passing_marks ? 'passed' : 'failed' }}">
                    {{ $attempt->score >= $exam->passing_marks ? 'Passed' : 'Failed' }}
                </td>
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
