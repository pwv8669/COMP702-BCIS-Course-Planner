import { loadPathways } from "./objects/pathway.js";
import { loadMajorMinorOptions } from "./objects/majorMinorOption.js";

import { state, Pathways } from "./state.js";
import { PlanError } from './objects/planError.js';
import { Pathway } from "./objects/pathway.js";

const pathways = await loadPathways();
const majorMinorOptions = await loadMajorMinorOptions();

export function validateChoices(){
    var errors = [];
    // Derive the json data for the selected pathway in order to determine the number of majors and minors required.
    const selectedPathway = state.selectedPathway;
    const pathway = pathways[selectedPathway];

    // Loop through the slected majors and minors to ensure that they are selected.
    for (let i = 0; i < pathway.numMajors; i++){
        if(state.selectedMajors[i] != undefined){
            validate(state.selectedMajors[i], true);
        } else{
            let message = `Major ${i} is missing!`;
            let errorMsg = new PlanError(null, message);
            errors.push(errorMsg);
        }
    }
    for (let i = 0; i < pathway.numMinors; i++){
        if(state.selectedMinors[i] != undefined){
            validate(state.selectedMinors[i], false);
        } else{
            let message = `Minor ${i} is missing!`;
            let errorMsg = new PlanError(null, message);
            errors.push(errorMsg);
        }
    }
    for (let i = 0; i < pathway.numElectives; i++){
        if(state.selectedElectives[i] != undefined){
            validate(state.selectedElectives[i], false);
        } else{
            let message = `Elective ${i} is missing!`;
            let errorMsg = new PlanError(null, message);
            errors.push(errorMsg);
        }
    }

    return errors;
}

function validate(majorCode, isMajor){
    // Set minimum courses to 4, unless this is a major, in which it will be 8. 
    let minimumCourses = isMajor ? 8 : 4;

    let major = majorMinorOptions[majorCode];
    let coursearray = major.Courses;
    let coursePlan = state.coursePlan;

    let coursesPresent = 0;
    for (let semester = 0; semester < coursePlan.length; semester++){
		for (let slot = 0; slot < state.coursePlan[semester].length; slot++){
			if (coursearray.includes(coursePlan[semester][slot].Code)) {
			    coursesPresent++;
                console.log(`${majorCode}: ${coursePlan[semester][slot]} found.`)
			}
		}
	}
}