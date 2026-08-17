<?php
require_once __DIR__ . '/editOption.php';
editOption(__DIR__ . '/../json/minors.json', false);
header('Location: ../majoreditor.html');
exit;
