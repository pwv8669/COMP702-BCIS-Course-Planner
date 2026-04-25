<?php
if($_SERVER["REQUEST_METHOD"] == "POST"){
    $course = [
        "Code" => $_POST["Code"],
        "Name" => $_POST["Name"],
        "Points" => $_POST["Points"],
        "Level" => $_POST["Level"],
        "Semester1Offered" => isset($_POST["Semester1Offered"]) ? true : false,
        "Semester2Offered" => isset($_POST["Semester2Offered"]) ? true : false,
    ];

    $jsonData = json_encode($course, JSON_PRETTY_PRINT);
    $filePath = "json/courses/" . $_POST["Code"] . ".json";
    file_put_contents($filePath, $jsonData);
}
?>