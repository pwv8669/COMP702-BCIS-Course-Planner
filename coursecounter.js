import { state,selectedMajors,Pathways } from "./javascript/state";
function ValidateChoices(){
    if(selectedMajors[0] != undefined){
        Validate(selectedMajors[0],false);
    }
    else{
        console.log("First major is missing!");
    }


    if(state.selectedPathway == Pathways.doubleMajors){//if chosen pathway is double major
        if(selectedMajors[1] != undefined){//check other major
            Validate(selectedMajors[1],false);
        }
        else{
            console.log("Second major is missing!");
        }
    }


    else{//else just run it on the first minor since we know that at minimum the user will have picked 1 minor if not using double majors
        if(selectedMinors[0] != undefined){
            Validate(selectedMinors[0],true);//isminor is set to true here
        }
        else{
            console.log("First Minor is missing!");
        }


        if(state.selectedPathway == Pathways.doubleMinors){//if chosen pathway is double minor, check the second minor
            if(selectedMinors[1] != undefined){//check other minor
                Validate(selectedMinors[1],true);
            }
            else{
                console.log("Second Minor is missing!");
            }
        }
        else{//its electives instead of minors
             ValidateElectives();
        }
    }
}



function Validate(MajorCode,IsMinor){
    if(IsMinor == true){
        let coursenumber = 4;//set the required courses to be validated to be 4 instead of 8
    }
    else{
        let coursenumber = 8;//else just set to the default of searching for 8 courses
    } 
   
    const indexResource = await fetch('./json/pathways/pathways.json');//get majors
	const index = await indexResource.json();//turn into json file
    let majorcourses = index.find(obj => obj.Code === MajorCode); //get major from index
    let coursearray = majorcourses.Courses;//grab the course array
    for (let row = 0; row < state.coursePlan.length; row++) {//go through each row of state
        //for each row
		for (let course = 0; course < coursearray.length; course++) {//go through all courses in the major's course array 
			if(state.coursePlan[row].includes(majorcourses[course])){//check if given row contains this course in a major
                coursenumber -= 1;//if it does include it, reduce number of missing courses by 1
            }
		}
	}
    if(coursenumber > 0){
        alert(majorcourses.Name + "is missing " + coursenumber + "courses!");//output error 
    }
}

function ValidateElectives(){//we dont need to take any inputs because its too specific of a use case
    let coursenumber = 4;//see if user has added 4 electives
    for(let course = 0; course < state.selectedElectives.length;course++){//go through electives selected
        if(state.selectedElectives[course] != undefined){//if electives is not undefined
            coursenumber -=1;//minus 1 missing course
        }
    }
    if(coursenumber > 0){//if courses missing is greater than 0
        alert(majorcourses.Name + "is missing " + coursenumber + "courses!");//output error 
    }
}