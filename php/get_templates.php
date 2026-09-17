<?php
header('Content-Type: application/json');

// Base directory path targeting the main templates folder
$dir = "../json/templates/"; 
$templates = [];

if (is_dir($dir)) {
    //iterator loop that crawls down into child folders automatically
    $directoryIterator = new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS);
    $iterator = new RecursiveIteratorIterator($directoryIterator);

    foreach ($iterator as $fileInfo) {
        // Look only for files ending with the .json extension
        if ($fileInfo->isFile() && $fileInfo->getExtension() === 'json') {
            
            // Extract the sub-path relative to the main json/ directory
            $realPath = $fileInfo->getRealPath();
            $jsonPos = strpos($realPath, 'json');
            $relativePath = substr($realPath, $jsonPos);
            
            // Normalize path separators to forward slashes for JavaScript 
            $cleanRelativePath = str_replace('\\', '/', $relativePath);

            $templates[] = [
                'filepath' => './' . $cleanRelativePath, // Browser safe path reference
                'display_name' => $fileInfo->getBasename('.json') // Clean label text
            ];
        }
    }
}

// Return the collection of discovered files back to client side JavaScript
echo json_encode($templates);
?>