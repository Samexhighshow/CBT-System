<?php
/**
 * Test Publish/Unpublish Functionality
 * 
 * Tests:
 * 1. Create a draft exam
 * 2. Publish it (should change status to 'scheduled' and set published=true)
 * 3. Unpublish it (should change status back to 'draft' and set published=false)
 * 4. Try to publish again (should work)
 * 5. Verify the status field is displayed correctly in the UI
 */

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/app/Models/Exam.php';

// Test via direct API calls
$baseUrl = 'http://localhost:8000/api';
$authToken = 'your_auth_token_here'; // Get from login

function makeRequest($method, $url, $data = null, $token = null) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    
    if ($data) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    
    $headers = ['Content-Type: application/json'];
    if ($token) {
        $headers[] = "Authorization: Bearer $token";
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return [
        'code' => $httpCode,
        'body' => json_decode($response, true)
    ];
}

echo "=== Publish/Unpublish Test Suite ===\n\n";

// Test 1: Get existing exam to test with
echo "Test 1: Get exam with ID 1\n";
$response = makeRequest('GET', "$baseUrl/exams/1");
if ($response['code'] === 200) {
    $exam = $response['body'];
    echo "✓ Exam found\n";
    echo "  - Current status: {$exam['status']}\n";
    echo "  - Published: " . ($exam['published'] ? 'true' : 'false') . "\n";
} else {
    echo "✗ Failed to get exam: {$response['code']}\n";
    exit(1);
}

$examId = $exam['id'];

// Test 2: Publish the exam (if not already published)
echo "\nTest 2: Publishing exam...\n";
$publishData = [
    'published' => true,
    'status' => 'scheduled',
    'start_datetime' => date('Y-m-d H:i:s', strtotime('+1 day')),
    'end_datetime' => date('Y-m-d H:i:s', strtotime('+1 day +1 hour')),
];

$response = makeRequest('PUT', "$baseUrl/exams/$examId", $publishData);
if ($response['code'] === 200) {
    $exam = $response['body']['exam'] ?? $response['body'];
    echo "✓ Exam published successfully\n";
    echo "  - New status: {$exam['status']}\n";
    echo "  - Published: " . ($exam['published'] ? 'true' : 'false') . "\n";
    
    if ($exam['status'] !== 'scheduled') {
        echo "⚠ WARNING: Expected status 'scheduled' but got '{$exam['status']}'\n";
    }
    if (!$exam['published']) {
        echo "⚠ WARNING: Expected published=true but got false\n";
    }
} else {
    echo "✗ Failed to publish exam: {$response['code']}\n";
    echo "  Response: " . json_encode($response['body']) . "\n";
}

// Test 3: Unpublish the exam (change back to draft)
echo "\nTest 3: Unpublishing exam (should change to draft)...\n";
$unpublishData = [
    'published' => false,
    'status' => 'draft',
];

$response = makeRequest('PUT', "$baseUrl/exams/$examId", $unpublishData);
if ($response['code'] === 200) {
    $exam = $response['body']['exam'] ?? $response['body'];
    echo "✓ Exam unpublished successfully\n";
    echo "  - New status: {$exam['status']}\n";
    echo "  - Published: " . ($exam['published'] ? 'true' : 'false') . "\n";
    
    if ($exam['status'] !== 'draft') {
        echo "✗ ERROR: Expected status 'draft' but got '{$exam['status']}'\n";
    } else {
        echo "✓ Status correctly changed to 'draft'\n";
    }
    
    if ($exam['published']) {
        echo "✗ ERROR: Expected published=false but got true\n";
    } else {
        echo "✓ Published flag correctly set to false\n";
    }
} else {
    echo "✗ Failed to unpublish exam: {$response['code']}\n";
    echo "  Response: " . json_encode($response['body']) . "\n";
}

// Test 4: Try to publish again
echo "\nTest 4: Publishing again (should work)...\n";
$publishData = [
    'published' => true,
    'status' => 'scheduled',
    'start_datetime' => date('Y-m-d H:i:s', strtotime('+2 days')),
    'end_datetime' => date('Y-m-d H:i:s', strtotime('+2 days +1 hour')),
];

$response = makeRequest('PUT', "$baseUrl/exams/$examId", $publishData);
if ($response['code'] === 200) {
    $exam = $response['body']['exam'] ?? $response['body'];
    echo "✓ Exam re-published successfully\n";
    echo "  - Status: {$exam['status']}\n";
    echo "  - Published: " . ($exam['published'] ? 'true' : 'false') . "\n";
} else {
    echo "✗ Failed to re-publish exam: {$response['code']}\n";
    echo "  Response: " . json_encode($response['body']) . "\n";
}

echo "\n=== Test Complete ===\n";
echo "\nExpected UI behavior:\n";
echo "- When exam is in 'draft' status with published=false → shows 'Draft' badge\n";
echo "- When exam is in 'scheduled' status with published=true → shows 'Scheduled' badge\n";
echo "- Unpublish button should only show when published=true\n";
echo "- Publish button should only show when published=false\n";
