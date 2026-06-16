import { loadPathways } from "./objects/pathway.js";
import { loadMajorOptions, loadMinorOptions } from "./objects/majorMinorOption.js";

import { state } from "./state.js";
import { PlanError } from './objects/planError.js';

const pathways = await loadPathways();
const majorOptions = await loadMajorOptions();
const minorOptions = await loadMinorOptions();

var errors = [];
export function validateMajorMinorRequirements(){
    errors = [];
    // Derive the json data for the selected pathway in order to determine the number of majors and minors required.
    const selectedPathway = state.selectedPathway;
    const pathway = pathways[selectedPathway];

    if(!pathway) {
        let message = "No valid pathway is selected.";
        let errorMsg = new PlanError(null, message);
        errors.push(errorMsg);
        return errors;
    }

    // Loop through the slected majors and minors to ensure that they are selected.
    for (let i = 0; i < pathway.numMajors; i++){
        if(state.selectedMajors[i]){
            validate(state.selectedMajors[i], true);
        } else{
            let message = `Major ${i+1} is missing!`;
            let errorMsg = new PlanError(null, message);
            errors.push(errorMsg);
        }
    }
    for (let i = 0; i < pathway.numMinors; i++){
        if(state.selectedMinors[i]){
            validate(state.selectedMinors[i], false);
        } else{
            let message = `Minor ${i+1} is missing!`;
            let errorMsg = new PlanError(null, message);
            errors.push(errorMsg);
        }
    }
    for (let i = 0; i < pathway.numElectives; i++){
        if(state.selectedElectives[i]){
            validate(state.selectedElectives[i], false);
        } else{
            let message = `Elective ${i+1} is missing!`;
            let errorMsg = new PlanError(null, message);
            errors.push(errorMsg);
        }
    }

    return errors;
}

function validate(majorCode, isMajor){
    let major = isMajor ? majorOptions[majorCode] : minorOptions[majorCode];
    let requirements = major.Requirements;
    let coursePlan = state.coursePlan;

    // Create a set of all courses in the course plan for easy lookup.
    let courseSet = new Set();
    for (let semester = 0; semester < coursePlan.length; semester++){
		for (let slot = 0; slot < state.coursePlan[semester].length; slot++){
            if (!coursePlan[semester][slot]) continue;
            courseSet.add(coursePlan[semester][slot].code);
		}
	}
    
    let requirementsSatisfied = true;
    // Loop through the requirements and make error messages for unmet requirements.
    for (let requirement of requirements){
        let type = requirement.Type;
        let courses = requirement.Courses;
        
        let requirementSatisfied = false;
        if (type === "Required"){
            // Check that all courses in the requirement are present in the course plan.
            requirementSatisfied = courses.every(course => courseSet.has(course.code));
            if (!requirementSatisfied){
                let missingCourses = courses.filter(course => !courseSet.has(course.code)).map(course => course.code);
                let message = `Missing required courses for ${major.Name}: ${missingCourses.join(", ")}.`;
                let errorMsg = new PlanError(null, message);
                errors.push(errorMsg);
            }
        } else if (type === "ChooseN"){
            // Check that at least N courses in the requirement are present in the course plan.
            let count = courses.filter(course => courseSet.has(course.code)).length;
            requirementSatisfied = count >= requirement.Count;
            if (!requirementSatisfied){
                let missingCourses = courses.filter(course => !courseSet.has(course.code)).map(course => course.code);
                let message = `Missing courses for ${major.Name}: choose at least ${requirement.Count} of ${missingCourses.join(", ")}.`;
                let errorMsg = new PlanError(null, message);
                errors.push(errorMsg);
            }
        }
        if (!requirementSatisfied){
            requirementsSatisfied = false;
        }
    }
}