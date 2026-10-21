<?php

return [
    // Set TRUSTED_PROXIES to a comma-separated list of proxy IPs/CIDRs.
    // Leave empty when requests reach the application directly.
    'proxies' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('TRUSTED_PROXIES', ''))
    ))),
];
