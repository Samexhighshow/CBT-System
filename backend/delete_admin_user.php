<?php
try {
    $conn = new PDO(
        'mysql:host=127.0.0.1;dbname=cbt_system',
        'root',
        ''
    );
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Delete the admin@cbtsystem.local user
    $stmt = $conn->prepare("DELETE FROM users WHERE email = ?");
    $stmt->execute(['admin@cbtsystem.local']);
    
    echo "User 'admin@cbtsystem.local' deleted successfully\n";
    echo "Rows affected: " . $stmt->rowCount() . "\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
