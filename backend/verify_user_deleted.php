<?php
try {
    $conn = new PDO(
        'mysql:host=127.0.0.1;dbname=cbt_system',
        'root',
        ''
    );
    
    $stmt = $conn->query("SELECT COUNT(*) as count FROM users WHERE email = 'admin@cbtsystem.local'");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo "admin@cbtsystem.local users found: " . $result['count'] . "\n";
    
    if ($result['count'] === 0) {
        echo "✓ User successfully deleted!\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
