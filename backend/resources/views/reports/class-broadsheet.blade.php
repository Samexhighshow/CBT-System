<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Class Broadsheet Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 18px; color: #1f2937; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0f766e; padding-bottom: 12px; }
        .header h1 { margin: 6px 0; color: #115e59; font-size: 22px; }
        .meta { margin-bottom: 12px; font-size: 12px; }
        .meta p { margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background-color: #0f766e; color: #fff; padding: 7px; text-align: left; }
        td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .align-right { text-align: right; }
        .align-center { text-align: center; }
        .footer { margin-top: 14px; text-align: center; font-size: 10px; color: #6b7280; }
    </style>
</head>
<body>
    <div class="header">
        <h1>CBT System - Full Class Broadsheet</h1>
        <p>{{ $term }} • {{ $academic_session }}</p>
    </div>

    <div class="meta">
        <p><strong>Class:</strong> {{ $class_name }}</p>
        <p><strong>Students:</strong> {{ $total_students }}</p>
        <p><strong>Subjects:</strong> {{ count($subjects) }}</p>
    </div>

    <table>
        <thead>
            <tr>
                <th>Student</th>
                <th>Reg. No.</th>
                <th>Class</th>
                @foreach($subjects as $subject)
                    <th>{{ $subject }}</th>
                @endforeach
                <th>Average (%)</th>
                <th>Position</th>
                <th>Grade</th>
            </tr>
        </thead>
        <tbody>
            @forelse($rows as $row)
                <tr>
                    <td>{{ $row['student_name'] ?? '-' }}</td>
                    <td>{{ $row['registration_number'] ?? '-' }}</td>
                    <td>{{ $row['class_level'] ?? '-' }}</td>
                    @foreach($subjects as $subject)
                        @php($score = data_get($row, 'subject_scores.' . $subject))
                        <td class="align-right">{{ $score !== null ? number_format((float) $score, 2) : '-' }}</td>
                    @endforeach
                    <td class="align-right">{{ isset($row['average_score']) && $row['average_score'] !== null ? number_format((float) $row['average_score'], 2) : '-' }}</td>
                    <td class="align-center">{{ $row['position'] ?? '-' }}</td>
                    <td class="align-center">{{ $row['overall_grade'] ?? '-' }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="{{ 6 + count($subjects) }}">No compiled rows found for the selected class and term.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="footer">
        <p>Generated on {{ $generated_at }}</p>
    </div>
</body>
</html>
