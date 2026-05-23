<?php
if($_SERVER["REQUEST_METHOD"] == "POST"){
    $filePath = "../json/options.json";
    
    // Load existing options from the JSON file.
    if (file_exists($filePath)) {
        $json = file_get_contents($filePath);
        $options = json_decode($json, true);
    } else {
        $options = [];
    }

    $code = $_POST["Code"];
    if (empty($code)) {
        die("Course code is required.");
    }

    $found = false;
    foreach ($options["Options"] as $key => $obj) {//go through each entry 
    echo($obj['Name']);
    echo($key);
        if($obj['Name'] == $_POST["Name"]){
            $found = true;
            //unset($options["Options"][$key]);
            // Create an associative array to represent the course data
            $option = [
                "Code" => $code,
                "Name" => $_POST["Name"],
                "Courses" => preg_split("/[\s,]+/", $_POST["Courses"])?? "",
                "AvailableAsMajor" => isset($_POST["MajorOffered"]) ? true : false,
                "AvailableAsMinor" => isset($_POST["MinorOffered"]) ? true : false,
            ];
            // Add/overwrite the course.
            $options["Options"][$key] = $option;
            }
    }
    if($found == false){
         $option = [
                "Code" => $code,
                "Name" => $_POST["Name"],
                "Courses" => preg_split("/[\s,]+/", $_POST["Courses"])?? "",
                "AvailableAsMajor" => isset($_POST["MajorOffered"]) ? true : false,
                "AvailableAsMinor" => isset($_POST["MinorOffered"]) ? true : false,
            ];
            // Add/overwrite the course.
            array_push($options["Options"], $option);
    }
    // Sort the courses alphabetically by course code.
    ksort($options);

    // Save the updated courses.json file
    $optionsData = json_encode($options, JSON_PRETTY_PRINT);
    file_put_contents($filePath, $optionsData);
}
header("Location: ../majoreditor.html");
?>