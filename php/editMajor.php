<?php
if($_SERVER["REQUEST_METHOD"] == "POST"){
    $filePath = "../json/majors.json";
    
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
    foreach ($options as $key => $obj) {//go through each entry 
    //echo($obj['Name']);
    //echo($key);
        if($obj['Name'] == $_POST["Name"]){
            $found = true;
            //unset($options["Options"][$key]);
            // Create an associative array to represent the course data
            $option = [
                "Code" => $code,
                "Name" => $_POST["Name"],
                "Requirements" =>  $_POST["Courses"]??"",
                "IsCore" => false,
            ];

           //POST OBJECT CREATION CHANGES
            if(strcmp($option['Code'], "Core") == 0){
                echo($option['Code']);
                echo("vs Core");
                $option['IsCore'] = true;
            }
            //echo $option['Requirements'];
            $temparray = preg_split("/[,]+/", $option['Requirements']);
//split up temparray by commas

            $fullcoursearray = [];//array thatll hold objects
            for( $i = 0; $i < count($temparray);$i++){//go through each element of said split up array
                $tempobject = [
                    "Type" => "Required",
                    "Count" => -1,
                ];
                
                $tempobject["Courses"] = preg_split("/OR+/", $temparray[$i]);
                 for( $c = 0; $c < count($tempobject["Courses"]);$c++){
                    $tempobject["Courses"][$c] = preg_replace('/\s+/', '', $tempobject["Courses"][$c]);
                   // echo("     \n     ");
                    //echo($tempobject["Courses"][$c]);
                 }

                if(count($tempobject["Courses"]) > 1){
                    $tempobject["Type"] = "ChooseN";


                    //EXTRACT COUNT FROM END BRACKETS
                    $countnumber = $tempobject["Courses"][count($tempobject["Courses"])-1];//get end element
                    
                    $tempobject["Courses"][count($tempobject["Courses"])-1] = preg_split('/\[+/', $countnumber)[0];//get non square bracket part and repair course ending element
                    $countnumber = preg_split('/\[+/', $countnumber)[1];//extract square bracket part
                    // echo($countnumber);
                    
                    $countnumber = preg_split('/\]+/', $countnumber);
                    $tempobject['Count'] = intval($countnumber[0]);//get end count





                }
                else{
                    unset($tempobject['Count']);
                }
                array_push($fullcoursearray, $tempobject);
            }

            $option['Requirements'] = $fullcoursearray;
            

            // Add/overwrite the course.
            $options[$key] = $option;
            }
    }


    if($found == false){//if course isnt already in the file
         $option = [
                "Code" => $code,
                "Name" => $_POST["Name"],
                "Requirements" =>  $_POST["Courses"]??"",
                "IsCore" => false,
            ];
            

             //POST OBJECT CREATION CHANGES
            if(strcmp($option['Code'], "Core") == 0){
                echo($option['Code']);
                echo("vs Core");
                $option['IsCore'] = true;
            }
            // /echo $option['Requirements'];
            $temparray = preg_split("/[,]+/", $option['Requirements']);
//split up temparray by commas

            $fullcoursearray = [];//array thatll hold objects
            for( $i = 0; $i < count($temparray);$i++){//go through each element of said split up array
                $tempobject = [
                    "Type" => "Required",
                    "Count" => -1,
                ];
                
                $tempobject["Courses"] = preg_split("/OR+/", $temparray[$i]);
                 for( $c = 0; $c < count($tempobject["Courses"]);$c++){
                    $tempobject["Courses"][$c] = preg_replace('/\s+/', '', $tempobject["Courses"][$c]);
                 }
               
                if(count($tempobject["Courses"]) > 1){
                    $tempobject["Type"] = "ChooseN";
                    $tempobject['Count'] = count($tempobject["Courses"]);
                }
                else{
                    unset($tempobject['Count']);
                }
                array_push($fullcoursearray, $tempobject);
            }
            $option['Requirements'] = $fullcoursearray;
            

            // Add/overwrite the course.
            $options[$option['Code']] = $option;
    }
    // Sort the courses alphabetically by course code.
    ksort($options);

    // Save the updated courses.json file
    $optionsData = json_encode($options, JSON_PRETTY_PRINT);
    file_put_contents($filePath, $optionsData);
}
header("Location: ../majoreditor.html");
?>