<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    // Allow local frontend during development
        // Development: allow all origins to eliminate CORS during local testing
        'allowed_origins' => ['*'],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
        // Must be false when allowed_origins is '*'
        'supports_credentials' => false,
];
