<?php
function parseCodeList($value) {
    $codes = array_map('trim', explode(',', $value ?? ''));
    return array_values(array_filter($codes, fn($code) => $code !== ''));
}

function parseRequirements($value) {
    $requirements = [];
    foreach (array_filter(array_map('trim', explode(',', $value ?? ''))) as $text) {
        $count = null;
        if (preg_match('/\[(\d+)\]\s*$/', $text, $match)) {
            $count = intval($match[1]);
            $text = preg_replace('/\[\d+\]\s*$/', '', $text);
        }
        $courses = array_values(array_filter(array_map('trim', preg_split('/\s+OR\s+/i', trim($text)))));
        if (!$courses) continue;
        $requirements[] = count($courses) > 1
            ? ['Type' => 'ChooseN', 'Count' => $count ?? 1, 'Courses' => $courses]
            : ['Type' => 'Required', 'Courses' => $courses];
    }
    return $requirements;
}

function editOption($filePath, $isMajor) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') return;
    $options = file_exists($filePath) ? json_decode(file_get_contents($filePath), true) : [];
    if (!is_array($options)) $options = [];

    $code = trim($_POST['Code'] ?? '');
    $name = trim($_POST['Name'] ?? '');
    $originalCode = trim($_POST['OriginalCode'] ?? '');
    if ($code === '' || $name === '') die('Code and name are required.');

    $option = [
        'Code' => $code,
        'Name' => $name,
        'Requirements' => parseRequirements($_POST['Courses'] ?? ''),
        'IncompatibleMajors' => parseCodeList($_POST['IncompatibleMajors'] ?? ''),
        'IncompatibleMinors' => parseCodeList($_POST['IncompatibleMinors'] ?? '')
    ];
    if ($isMajor) $option['IsCore'] = isset($_POST['IsCore']);

    if ($originalCode !== '' && $originalCode !== $code) unset($options[$originalCode]);
    $options[$code] = $option;
    ksort($options);
    $json = json_encode($options, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($filePath, $json . PHP_EOL) === false) die('Unable to save option data.');
}
