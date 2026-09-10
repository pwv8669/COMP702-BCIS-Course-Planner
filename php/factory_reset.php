<?php
header('Content-Type: application/json');

// JSON directory paths
$jsonDirectory = realpath(__DIR__ . '/../json');
$factoryDirectory = realpath(__DIR__ . '/../json/factory');

// Recursively delete JSON files and directories without removing the factory directory
function deleteContents(string $directory, string $preservedDirectory): void
{
    $items = new DirectoryIterator($directory);

    foreach ($items as $item) {
        if ($item->isDot() || $item->getPathname() === $preservedDirectory) {
            continue;
        }

        if ($item->isDir()) {
            deleteContents($item->getPathname(), $preservedDirectory);
            rmdir($item->getPathname());
        } else {
            unlink($item->getPathname());
        }
    }
}

// Recursively copy files and directories from factory back to original JSON directory
function copyDirectory(string $source, string $destination): void
{
    if (!is_dir($destination)) {
        mkdir($destination, 0755, true);
    }

    $items = new DirectoryIterator($source);

    foreach ($items as $item) 
    {
        if ($item->isDot()) 
        {
            continue;
        }

        $sourcePath = $item->getPathname();
        $destinationPath = $destination . DIRECTORY_SEPARATOR . $item->getFilename();

        if ($item->isDir()) 
        {
            copyDirectory($sourcePath, $destinationPath);
        } 
        else if (!copy($sourcePath, $destinationPath)) 
        {
            throw new RuntimeException("Could not copy {$item->getFilename()}.");
        }
    }
}

// Delete the current JSON files and directories, then restore from the factory directory
try 
{
    deleteContents($jsonDirectory, $factoryDirectory);
    copyDirectory($factoryDirectory, $jsonDirectory);

    echo json_encode(['success' => true, 'message' => 'Factory reset completed.']);
}
catch (Throwable $error) 
{
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Factory reset failed.']);
}
?>