<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Student Report Card</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #1f2937; }
        .header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #1d4ed8; padding-bottom: 10px; }
        .header h1 { margin: 4px 0; color: #1e40af; font-size: 22px; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin-bottom: 12px; }
        .meta p { margin: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th { background: #1d4ed8; color: white; padding: 8px; text-align: left; }
        td { border-bottom: 1px solid #e5e7eb; padding: 8px; }
        .summary { margin-top: 14px; font-size: 12px; }
        .summary p { margin: 4px 0; }
        .remarks { margin-top: 16px; font-size: 12px; }
        .remarks-box { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px; min-height: 36px; margin-top: 6px; }
        .footer { margin-top: 18px; text-align: center; font-size: 10px; color: #6b7280; }
    </style>
</head>
<body>
    <div class="header">
        <h1>CBT System - Student Report Card</h1>
        <p>{{ $term }} • {{ $academic_session }}</p>
    </div>

    <div class="meta">
        <p><strong>Student:</strong> {{ $row['student_name'] ?? '-' }}</p>
        <p><strong>Registration:</strong> {{ $row['registration_number'] ?? '-' }}</p>
        <p><strong>Class:</strong> {{ $row['class_level'] ?? '-' }}</p>
        <p><strong>Position:</strong> {{ $row['position'] ?? '-' }}</p>
    </div>

    <table>
        <thead>
            <tr>
                <th>Subject</th>
                <th>Compiled Score (%)</th>
            </tr>
        </thead>
        <tbody>
            @foreach($subjects as $subject)
                @php($score = data_get($row, 'subject_scores.' . $subject))
                <tr>
                    <td>{{ $subject }}</td>
                    <td>{{ $score !== null ? number_format((float) $score, 2) : '-' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="summary">
        <p><strong>Average:</strong> {{ isset($row['average_score']) && $row['average_score'] !== null ? number_format((float) $row['average_score'], 2) . '%' : '-' }}</p>
        <p><strong>Grade:</strong> {{ $row['overall_grade'] ?? '-' }}</p>
        <p><strong>Passed Subjects:</strong> {{ ($row['passed_subjects'] ?? 0) . '/' . ($row['total_subjects'] ?? 0) }}</p>
        <p><strong>Pass Rate:</strong> {{ isset($row['pass_rate']) && $row['pass_rate'] !== null ? number_format((float) $row['pass_rate'], 1) . '%' : '-' }}</p>
        <p><strong>Remark:</strong> {{ $row['remarks'] ?? '-' }}</p>
    </div>

    <div class="remarks">
        <p><strong>Teacher Remark</strong></p>
        <div class="remarks-box">{{ $row['teacher_remark'] ?? '-' }}</div>
        <p style="margin-top: 10px;"><strong>Principal Remark</strong></p>
        <div class="remarks-box">{{ $row['principal_remark'] ?? '-' }}</div>
    </div>

    <div class="footer">
        <p>Generated on {{ $generated_at }}</p>
    </div>
</body>
</html>
