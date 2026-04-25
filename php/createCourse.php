<?php
if($_SERVER["REQUEST_METHOD"] == "POST"){
    // Create an associative array to represent the course data
    $course = [
        "Code" => $_POST["Code"],
        "Name" => $_POST["Name"],
        "Points" => $_POST["Points"],
        "Level" => $_POST["Level"],
        "Semester1Offered" => isset($_POST["Semester1Offered"]) ? true : false,
        "Semester2Offered" => isset($_POST["Semester2Offered"]) ? true : false,
        "Prerequisites" => $_POST["Prerequisites"] ?? "",
        "Corequisites" => $_POST["Corequisites"] ?? ""
    ];

    // Ensure the directory for storing course JSON files exists, if not, create it
    $folder = "../json/courses/";
    if (!is_dir($folder)) {
        mkdir($folder, 0777, true);
    }

    // Convert the course data to JSON format and save it to a file
    $jsonData = json_encode($course, JSON_PRETTY_PRINT);
    $filePath = $folder . $_POST["Code"] . ".json";
    file_put_contents($filePath, $jsonData);
}
header("Location: ../CourseCreator.html");
?>