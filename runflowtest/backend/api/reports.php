<?php
/**
 * Reports API Endpoints
 * GET    /api/reports/{id}    - Generate & download report as JSON/PDF
 * GET    /api/reports         - List reports
 */

// TODO: Implement reports generation and download
http_response_code(501);
echo json_encode(['error' => 'Not implemented']);
