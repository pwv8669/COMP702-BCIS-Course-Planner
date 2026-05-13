<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$rawData = file_get_contents('php://input');
$decodedData = json_decode($rawData, true);

// Sanitize filename
$filename = basename($decodedData['filename']);
$filename = preg_replace('/[^a-zA-Z0-9_\-]/', '', $filename) . '.json';

unset($decodedData['filename']);

$targetDir = __DIR__ . '/../json/templates/'; 
$targetFile = $targetDir . $filename;

$formattedJson = json_encode($decodedData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

if (file_put_contents($targetFile, $formattedJson) !== false) {
    echo json_encode(['success' => true, 'message' => "Successfully saved $filename"]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to write data to server storage. Check folder permissions.']);
}
