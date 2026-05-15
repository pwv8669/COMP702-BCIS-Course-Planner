import { state,Pathways } from "./state.js";
import { PlanError } from './objects/planError.js';
var errors = [];
export async function ValidateChoices(){
    if(state.selectedMajors[0] != undefined){
        await Validate(state.selectedMajors[0],false);
    }
    else{
        let message = ("First major is missing!");//output error 
        let errorMsg = new PlanError(null, message);
        errors.push(errorMsg);
    }


    if(state.selectedPathway == Pathways.doubleMajors){//if chosen pathway is double major
        if(state.selectedMajors[1] != undefined){//check other major
            await Validate(state.selectedMajors[1],false);
        }
        else{
            let message = ("Second major is missing!");//output error 
            let errorMsg = new PlanError(null, message);
            errors.push(errorMsg);
        }
    }


    else{//else just run it on the first minor since we know that at minimum the user will have picked 1 minor if not using double majors
        if(state.selectedMinors[0] != undefined){
            await Validate(state.selectedMinors[0],true);//isminor is set to true here
        }
        else{
            let message = ("First Minor is missing!");//output error 
            let errorMsg = new PlanError(null, message);
            errors.push(errorMsg);
        }


        if(state.selectedPathway == Pathways.doubleMinors){//if chosen pathway is double minor, check the second minor
            if(state.selectedMinors[1] != undefined){//check other minor
                await Validate(state.selectedMinors[1],true);
            }
            else{
                let message = ("Second Minor is missing!");//output error 
                let errorMsg = new PlanError(null, message);
                errors.push(errorMsg);
            }
        }
        else{//its electives instead of minors
             ValidateElectives();
        }
    }
    let errorstoreturn = errors.slice();//make copy of errors array, as we'll need to reset the original global array
    
    errors = [];//reset original global array
    return errorstoreturn;//return copy containing errors from this call
}

async function Validate(MajorCode,IsMinor){
    let coursenumber = 0;
    if(IsMinor == true){
        coursenumber = 4;//set the required courses to be validated to be 4 instead of 8
    }
    else{
        coursenumber = 8;//else just set to the default of searching for 8 courses
    } 
    const fetchedoptions = await fetch('json/options.json');//get majors
	const index = await fetchedoptions.json();//turn into json file
    let majorcourses = index.Options.find(({Code}) => Code === MajorCode); //get major from index
     let coursearray = majorcourses.Courses;//grab the course array

    
    let statecopy = state.coursePlan;
    for(let row = 0; row < 6;row++){
        statecopy[row] = state.coursePlan[row].filter((entry) => entry != undefined);
    }

    let coursesnotfound = coursearray.slice();//make a copy of courses, all unfound courses will sit here
    //console.log(coursearray);

    for (let course = 0; course < coursearray.length; course++) {//go through all courses in the major's course array 
        for(let row = 0; row < 6;row++){
            if(statecopy[row].find(Course => Course.code === coursearray[course])){//check if given row contains this course in a major
                let i = coursesnotfound.findIndex(Code => Code === coursesnotfound[course]);//get index
                coursesnotfound.splice(i,1);//remove from missing courses, this is just so we have a point of reference if needed in future
                coursenumber -= 1;//if it does include it, reduce number of missing courses by 1
            }
        }
       
    }
    if(coursenumber > 0){
        let message = (majorcourses.Name + "is missing " + coursenumber + " courses!");//output error 
        let errorMsg = new PlanError(majorcourses.Code, message);
        //console.log(errorMsg.message);
        errors.push(errorMsg);
    }
}

function ValidateElectives(){//we dont need to take any inputs because its too specific of a use case
    let coursenumber = 4;//see if user has added 4 electives
    for(let course = 0; course < state.selectedElectives.length;course++){//go through electives selected
        if(state.selectedElectives[course] != undefined){//if electives is not undefined
            coursenumber -=1;//minus 1 missing course
        }
    }
    if(coursenumber > 0 && majorcourses != undefined){//if courses missing is greater than 0
        let message = (majorcourses.Name + "is missing " + coursenumber + "electives!");//output error 
        let errorMsg = new PlanError(majorcourses.Code, message);
        errors.push(errorMsg);
    }
}