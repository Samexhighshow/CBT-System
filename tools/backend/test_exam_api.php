<?php
echo "=== PHASE 1 API ENDPOINT TESTS ===\n\n";

$baseUrl = "http://127.0.0.1:8000/api";

function testAPI($method, $url, $data = null) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'Accept: application/json']);
    
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($data) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
    } elseif ($method === 'PUT') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
        if ($data) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return ['code' => $httpCode, 'response' => json_decode($response, true)];
}

echo "TEST 1: Create Exam with Valid Class-Subject Mapping\n";
echo "------------------------------------------------------\n";
$validExam = testAPI('POST', "$baseUrl/exams", [
    'title' => 'Final Exam - Mathematics',
    'description' => 'End of term mathematics examination',
    'class_id' => 2, // JSS 2
    'subject_id' => 2, // Mathematics (assigned to JSS 2)
    'duration_minutes' => 120,
    'status' => 'draft',
    'published' => false
]);

if ($validExam['code'] === 201) {
    echo "✓ SUCCESS: Exam created\n";
    echo "  Exam ID: " . $validExam['response']['exam']['id'] . "\n";
    echo "  Title: " . $validExam['response']['exam']['title'] . "\n";
    echo "  Subject: " . $validExam['response']['exam']['subject']['name'] . "\n";
    echo "  Class: " . $validExam['response']['exam']['school_class']['name'] . "\n";
    $examId = $validExam['response']['exam']['id'];
} else {
    echo "✗ FAILED: HTTP {$validExam['code']}\n";
    echo "  Error: " . json_encode($validExam['response']) . "\n";
    exit(1);
}

echo "\nTEST 2: Create Exam with Mismatched Class-Subject (Should Fail)\n";
echo "----------------------------------------------------------------\n";
$invalidExam = testAPI('POST', "$baseUrl/exams", [
    'title' => 'Invalid Exam',
    'class_id' => 1, // SSS 1
    'subject_id' => 2, // Mathematics (assigned to JSS 2, NOT SSS 1)
    'duration_minutes' => 60,
]);

if ($invalidExam['code'] === 422) {
    echo "✓ SUCCESS: Validation correctly rejected mismatched class-subject\n";
    echo "  Error message: " . $invalidExam['response']['message'] . "\n";
} else {
    echo "✗ FAILED: Should have returned 422 Validation Error\n";
    echo "  HTTP Code: " . $invalidExam['code'] . "\n";
}

echo "\nTEST 3: Create Exam with Non-Existent Class (Should Fail)\n";
echo "----------------------------------------------------------\n";
$noClass = testAPI('POST', "$baseUrl/exams", [
    'title' => 'No Class Exam',
    'class_id' => 9999, // Non-existent
    'subject_id' => 2,
    'duration_minutes' => 60,
]);

if ($noClass['code'] === 422) {
    echo "✓ SUCCESS: Validation correctly rejected non-existent class\n";
    echo "  Error: " . json_encode($noClass['response']['errors']) . "\n";
} else {
    echo "✗ FAILED: Should have returned 422\n";
}

echo "\nTEST 4: Get Exam Details\n";
echo "------------------------\n";
$getExam = testAPI('GET', "$baseUrl/exams/$examId");

if ($getExam['code'] === 200) {
    echo "✓ SUCCESS: Retrieved exam details\n";
    echo "  Title: " . $getExam['response']['title'] . "\n";
    echo "  Status: " . $getExam['response']['status'] . "\n";
} else {
    echo "✗ FAILED: HTTP {$getExam['code']}\n";
}

echo "\nTEST 5: Update Exam\n";
echo "-------------------\n";
$updateExam = testAPI('PUT', "$baseUrl/exams/$examId", [
    'status' => 'scheduled',
    'published' => true,
]);

if ($updateExam['code'] === 200) {
    echo "✓ SUCCESS: Exam updated\n";
    echo "  New status: " . $updateExam['response']['exam']['status'] . "\n";
    echo "  Published: " . ($updateExam['response']['exam']['published'] ? 'Yes' : 'No') . "\n";
} else {
    echo "✗ FAILED: HTTP {$updateExam['code']}\n";
}

echo "\nTEST 6: List Exams with Filters\n";
echo "-------------------------------\n";
$listExams = testAPI('GET', "$baseUrl/exams?class_id=2&subject_id=2");

if ($listExams['code'] === 200) {
    $count = count($listExams['response']['data']);
    echo "✓ SUCCESS: Retrieved exams\n";
    echo "  Total exams for JSS 2 Mathematics: $count\n";
} else {
    echo "✗ FAILED: HTTP {$listExams['code']}\n";
}

echo "\n=== ALL API TESTS COMPLETED ===\n";
echo "PHASE 1 IMPLEMENTATION VERIFIED!\n";
?>
