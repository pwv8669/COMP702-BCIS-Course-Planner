<?php
if($_SERVER["REQUEST_METHOD"] == "POST"){
    $filePath = "../json/courses.json";
    
    // Load existing courses from the JSON file.
    if (file_exists($filePath)) {
        $json = file_get_contents($filePath);
        $courses = json_decode($json, true);
    } else {
        $courses = [];
    }

    $code = $_POST["Code"];
    if (empty($code)) {
        die("Course code is required.");
    }

    // Create an associative array to represent the course data
    $course = [
        "Code" => $code,
        "Name" => $_POST["Name"],
        "Points" => intval($_POST["Points"]),
        "Level" => intval($_POST["Code"][4]), // Extract the level from the course code (e.g., COMP503 -> 5)
        "Semester1Offered" => isset($_POST["Semester1Offered"]) ? true : false,
        "Semester2Offered" => isset($_POST["Semester2Offered"]) ? true : false,
        "Prerequisites" => $_POST["Prerequisites"] ?? "",
        "Corequisites" => $_POST["Corequisites"] ?? ""
    ];

    // Add/overwrite the course.
    $courses[$code] = $course;
    // Sort the courses alphabetically by course code.
    ksort($courses);

    // Save the updated courses.json file
    $coursesData = json_encode($courses, JSON_PRETTY_PRINT);
    file_put_contents($filePath, $coursesData);
}
header("Location: ../CourseCreator.html");
?>