<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Exam Report - <?php echo e($exam->title); ?></title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 12px;
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
        .info-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 20px 10px;
            margin-bottom: 20px;
        }
        .info-table td {
            border: none;
            padding: 0;
            background: transparent;
        }
        .info-table tr:nth-child(even) {
            background: transparent;
        }
        .info-item {
            width: 33.33%;
            vertical-align: top;
            padding: 0;
        }
        .info-label {
            font-weight: bold;
            display: block;
            margin-bottom: 4px;
            font-size: 13px;
            color: #6b7280;
        }
        .info-value {
            display: block;
            font-size: 14px;
            color: #333;
        }
        .stats-grid {
            width: 100%;
            margin-bottom: 30px;
            border-collapse: separate;
            border-spacing: 10px 0;
        }
        .stat-box {
            border: 1px solid #e5e7eb;
            padding: 12px 10px;
            background: #f9fafb;
            border-radius: 4px;
        }
        .stat-label {
            font-size: 11px;
            color: #6b7280;
            margin-bottom: 3px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .stat-value {
            font-size: 16px;
            font-weight: bold;
            color: #1e40af;
        }
        .results-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            table-layout: fixed;
            font-size: 12px;
        }
        .results-table th {
            background-color: #3b82f6;
            color: white;
            padding: 8px 6px;
            text-align: left;
            font-weight: 600;
        }
        .results-table td {
            padding: 8px 6px;
            border-bottom: 1px solid #e5e7eb;
            word-wrap: break-word;
        }
        .results-table tbody tr:nth-child(even) {
            background-color: #f9fafb;
        }
        .results-table th:nth-child(1),
        .results-table td:nth-child(1) {
            width: 6%;
        }
        .results-table th:nth-child(2),
        .results-table td:nth-child(2) {
            width: 16%;
        }
        .results-table th:nth-child(3),
        .results-table td:nth-child(3) {
            width: 16%;
        }
        .results-table th:nth-child(4),
        .results-table td:nth-child(4) {
            width: 13%;
        }
        .results-table th:nth-child(5),
        .results-table td:nth-child(5) {
            width: 15%;
            white-space: nowrap;
        }
        .results-table th:nth-child(6),
        .results-table td:nth-child(6) {
            width: 8%;
        }
        .results-table th:nth-child(7),
        .results-table td:nth-child(7) {
            width: 10%;
        }
        .results-table th:nth-child(8),
        .results-table td:nth-child(8) {
            width: 9%;
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
        <h2><?php echo e($exam->title); ?></h2>
        <p>Subject: <?php echo e($exam->subject->name ?? 'N/A'); ?></p>
        <p style="font-size: 18px; font-weight: bold; color: #1e40af; margin-top: 8px;">Assessment Type: <?php echo e($report_assessment_type ?? ($exam->assessment_type ?? 'Final Exam')); ?></p>
    </div>

    <div class="info-section">
        <h3>Exam Information</h3>
        <table class="info-table">
            <tr>
                <td class="info-item">
                    <span class="info-label">Duration</span>
                    <span class="info-value"><?php echo e($exam->duration_minutes); ?> minutes</span>
                </td>
                <td class="info-item">
                    <span class="info-label">Total Marks</span>
                    <span class="info-value"><?php echo e($exam_total_marks); ?></span>
                </td>
                <td class="info-item">
                    <span class="info-label">Passing Marks</span>
                    <span class="info-value"><?php echo e($exam_passing_marks); ?></span>
                </td>
            </tr>
            <tr>
                <td class="info-item">
                    <span class="info-label">Start Time</span>
                    <span class="info-value"><?php echo e($exam_start_time ?? 'N/A'); ?></span>
                </td>
                <td class="info-item">
                    <span class="info-label">End Time</span>
                    <span class="info-value"><?php echo e($exam_end_time ?? 'N/A'); ?></span>
                </td>
                <td class="info-item">&nbsp;</td>
            </tr>
        </table>
    </div>

    <h3>Statistics</h3>
    <table class="stats-grid">
        <tr>
            <td width="25%">
                <div class="stat-box">
                    <div class="stat-label">Total Attempts</div>
                    <div class="stat-value"><?php echo e($total_attempts); ?></div>
                </div>
            </td>
            <td width="25%">
                <div class="stat-box">
                    <div class="stat-label">Average Score</div>
                    <div class="stat-value"><?php echo e($average_score); ?></div>
                </div>
            </td>
            <td width="25%">
                <div class="stat-box">
                    <div class="stat-label">Highest Score</div>
                    <div class="stat-value"><?php echo e($highest_score ?? 0); ?></div>
                </div>
            </td>
            <td width="25%">
                <div class="stat-box">
                    <div class="stat-label">Pass Rate</div>
                    <div class="stat-value"><?php echo e($pass_rate); ?>%</div>
                </div>
            </td>
        </tr>
    </table>

    <h3>Student Results</h3>
    <table class="results-table">
        <thead>
            <tr>
                <th>Rank</th>
                <th>Registration No.</th>
                <th>Student Name</th>
                <th>Department</th>
                <th>Assessment Type</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            <?php $__empty_1 = true; $__currentLoopData = $attempts; $__env->addLoop($__currentLoopData); foreach($__currentLoopData as $index => $attempt): $__env->incrementLoopIndices(); $loop = $__env->getLastLoop(); $__empty_1 = false; ?>
            <tr>
                <td><?php echo e($index + 1); ?></td>
                <td><?php echo e($attempt->student->registration_number ?? 'N/A'); ?></td>
                <td><?php echo e(trim(($attempt->student->first_name ?? '') . ' ' . ($attempt->student->last_name ?? '')) ?: 'N/A'); ?></td>
                <td><?php echo e($attempt->student->department->name ?? 'N/A'); ?></td>
                <td>
                    <?php $assessmentType = (string) ($report_assessment_type ?? ($exam->assessment_type ?? 'Final Exam')); ?>
                    <?php if(strtolower(trim($assessmentType)) === 'ca test'): ?>
                        CA Test
                    <?php else: ?>
                        <?php echo e($assessmentType); ?>

                    <?php endif; ?>
                </td>
                <td><?php echo e((int) ($attempt->report_score ?? 0)); ?></td>
                <td><?php echo e((isset($attempt->report_percentage) && is_numeric($attempt->report_percentage)) ? round((float) $attempt->report_percentage, 2) . '%' : 'N/A'); ?></td>
                <td class="<?php echo e(!empty($attempt->report_passed) ? 'passed' : 'failed'); ?>">
                    <?php echo e(!empty($attempt->report_passed) ? 'Passed' : 'Failed'); ?>

                </td>
            </tr>
            <?php endforeach; $__env->popLoop(); $loop = $__env->getLastLoop(); if ($__empty_1): ?>
            <tr>
                <td colspan="8" style="text-align: center; color: #6b7280;">No student results available for this exam yet.</td>
            </tr>
            <?php endif; ?>
        </tbody>
    </table>

    <div class="footer">
        <p>Generated on <?php echo e($generated_at); ?></p>
        <p>&copy; 2025 CBT System. All rights reserved.</p>
    </div>
</body>
</html>
<?php /**PATH C:\xampp\htdocs\CBT-System\backend\resources\views/reports/exam-report.blade.php ENDPATH**/ ?>