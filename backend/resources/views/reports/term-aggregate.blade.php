<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Term Aggregate Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #3b82f6; padding-bottom: 14px; }
        .header h1 { color: #1e40af; margin: 6px 0; }
        .meta { margin-bottom: 16px; }
        .meta p { margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background-color: #3b82f6; color: white; padding: 8px; text-align: left; }
        td { padding: 7px; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) { background-color: #f9fafb; }
        .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #6b7280; }
    </style>
</head>
<body>
    <div class="header">
        <h1>CBT System - Term Aggregate Report</h1>
        <p>{{ $term }} • {{ $academic_session }}</p>
    </div>

    <div class="meta">
        <p><strong>Class:</strong> {{ $class_name }}</p>
        <p><strong>Total Rows:</strong> {{ $total_rows }}</p>
    </div>

    <table>
        <thead>
            <tr>
                <th>Student</th>
                <th>Reg. No.</th>
                <th>Class</th>
                <th>Term</th>
                <th>Subject</th>
                <th>CA (%)</th>
                <th>Exam (%)</th>
                <th>Compiled (%)</th>
                <th>CR (%)</th>
                <th>Source Exam IDs</th>
            </tr>
        </thead>
        <tbody>
            @forelse($rows as $row)
                <tr>
                    <td>{{ $row['student_name'] ?? '-' }}</td>
                    <td>{{ $row['registration_number'] ?? '-' }}</td>
                    <td>{{ $row['class_level'] ?? '-' }}</td>
                    <td>{{ $row['term'] ?? '-' }}</td>
                    <td>{{ $row['subject'] ?? '-' }}</td>
                    <td>{{ isset($row['ca_score']) && $row['ca_score'] !== null ? number_format((float) $row['ca_score'], 2) : '-' }}</td>
                    <td>{{ isset($row['exam_score']) && $row['exam_score'] !== null ? number_format((float) $row['exam_score'], 2) : '-' }}</td>
                    <td>{{ isset($row['compiled_score']) && $row['compiled_score'] !== null ? number_format((float) $row['compiled_score'], 2) : '-' }}</td>
                    <td>{{ isset($row['cumulative_average']) && $row['cumulative_average'] !== null ? number_format((float) $row['cumulative_average'], 2) : '-' }}</td>
                    <td>
                        @if(!empty($row['source_exam_ids']) && is_array($row['source_exam_ids']))
                            {{ collect($row['source_exam_ids'])->map(fn($id) => '#' . (int) $id)->implode(', ') }}
                        @else
                            -
                        @endif
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="10">No aggregate rows found for the selected term and class.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="footer">
        <p>Generated on {{ $generated_at }}</p>
    </div>
</body>
</html>
