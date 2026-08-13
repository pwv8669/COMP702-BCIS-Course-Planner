<?php
require_once __DIR__ . '/editOption.php';
editOption(__DIR__ . '/../json/majors.json', true);
header('Location: ../majoreditor.html');
exit;
