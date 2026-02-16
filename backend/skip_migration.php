<?php
try {
    $conn = new PDO(
        'mysql:host=127.0.0.1;dbname=cbt_system',
        'root',
        ''
    );
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $conn->exec("INSERT IGNORE INTO migrations (migration, batch) VALUES ('2019_12_14_000001_create_personal_access_tokens_table', 1)");
    echo "Migration marked as completed\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
