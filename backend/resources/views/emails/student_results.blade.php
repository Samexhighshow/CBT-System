<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Exam Results</title>
</head>
<body style="font-family: Arial, sans-serif; color: #111;">
    <h2 style="margin-bottom: 4px;">Hello {{ $student->name }},</h2>
    <p style="margin-top: 0;">Here is your latest exam results summary.</p>

    <p><strong>Class:</strong> {{ $reportCard['class_level'] ?? 'N/A' }}</p>
    <p><strong>Average:</strong> {{ number_format($reportCard['average_percentage'] ?? 0, 1) }}%</p>
    <p><strong>Pass Rate:</strong> {{ number_format($reportCard['pass_rate'] ?? 0, 1) }}%</p>
    <p><strong>Total Subjects:</strong> {{ $reportCard['total_subjects'] ?? 0 }}</p>

    <h3 style="margin-bottom: 8px;">Subjects</h3>
    <table width="100%" cellpadding="6" cellspacing="0" border="1" style="border-collapse: collapse; font-size: 14px;">
        <thead>
            <tr style="background: #f0f4ff;">
                <th align="left">Subject</th>
                <th align="left">Class</th>
                <th align="left">Score</th>
                <th align="left">Grade</th>
                <th align="left">Submitted</th>
            </tr>
        </thead>
        <tbody>
            @foreach($reportCard['results'] as $result)
                <tr>
                    <td>{{ $result['subject'] }}</td>
                    <td>{{ $result['class_level'] }}</td>
                    <td>{{ number_format($result['score'], 2) }} / {{ number_format($result['total_marks'], 2) }} ({{ number_format($result['percentage'] ?? 0, 1) }}%)</td>
                    <td>{{ $result['grade'] ?? 'N/A' }}</td>
                    <td>{{ $result['submitted_at'] ?? '-' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <p style="margin-top: 16px;">If you have questions, please contact the academic office.</p>
    <p style="margin-top: 8px;">Thank you.</p>
</body>
</html>
