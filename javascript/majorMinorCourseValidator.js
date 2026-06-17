import { loadPathways } from "./objects/pathway.js";
import { loadMajorOptions, loadMinorOptions } from "./objects/majorMinorOption.js";

import { state } from "./state.js";
import { PlanError } from './objects/planError.js';

const pathways = await loadPathways();
const majorOptions = await loadMajorOptions();
const minorOptions = await loadMinorOptions();

var errors = [];
const attributedCourses = new Map();
const coursePlanCourses = new Set();

export function validateMajorMinorRequirements(){
    // Clear the errors course sets before validating.
    errors = [];
    attributedCourses.clear();
    coursePlanCourses.clear();
    // Fill the course plan courses set with all courses in the course plan for easy lookup.
    for (let semester = 0; semester < state.coursePlan.length; semester++){
		for (let slot = 0; slot < state.coursePlan[semester].length; slot++){
            if (!state.coursePlan[semester][slot]) continue;
            coursePlanCourses.add(state.coursePlan[semester][slot].code);
		}
	}

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
            validate(majorOptions[state.selectedMajors[i]]);
        } else{
            let message = `Major ${i+1} is missing!`;
            let errorMsg = new PlanError(null, message);
            errors.push(errorMsg);
        }
    }
    for (let i = 0; i < pathway.numMinors; i++){
        if(state.selectedMinors[i]){
            validate(minorOptions[state.selectedMinors[i]]);
        } else{
            let message = `Minor ${i+1} is missing!`;
            let errorMsg = new PlanError(null, message);
            errors.push(errorMsg);
        }
    }

    return errors;
}

function validate(major){
    let requirements = major.Requirements;
    
    // Loop through the requirements and make error messages for unmet requirements.
    for (let requirement of requirements){
        let type = requirement.Type;
        let courses = requirement.Courses;
        
        let requirementSatisfied = true;
        if (type === "Required"){
            // If the requirement is of type "Required", then we need to check that all courses in the requirement are present in the course plan and that they are not already attributed to another requirement.
            // First, we check that every course required is present in the course plan set.
            let allCoursesPresent = courses.every(course => coursePlanCourses.has(course.code));
            if (!allCoursesPresent){
                requirementSatisfied = false;
                let missingCourses = courses.filter(course => !coursePlanCourses.has(course.code)).map(course => course.code);
                let message = `Missing required courses for ${major.Name}: ${missingCourses.join(", ")}.`;
                let errorMsg = new PlanError(null, message);
                errors.push(errorMsg);
            }
            // Check that each of the required courses are not already attributed to another requirement. If not, add them to the set of attributed courses.
            for (let course of courses){
                if (attributedCourses.has(course.code) && coursePlanCourses.has(course.code)){
                    requirementSatisfied = false;
                    let otherMajorOrMinor = majorOptions[attributedCourses.get(course.code)] || minorOptions[attributedCourses.get(course.code)];
                    let message = `Course ${course.code} is required for ${major.Name} but is already attributed to ${otherMajorOrMinor.Name}. I need to update the code at a later stage to handle this case better, but for now I will just report an error.`;
                    let errorMsg = new PlanError(course.code, message);
                    errors.push(errorMsg);
                } else {
                    attributedCourses.set(course.code, major.Code);
                }
            }
        } else if (type === "ChooseN"){
            // If the requirement is of type "ChooseN", then we need to check that at least N courses in the requirement are present in the course plan.
            // First, we check if at least N courses in the requirement are present in the course plan set.
            let count = courses.filter(course => coursePlanCourses.has(course.code)).length;
            // We subtract from the count the number of courses that are already attributed to another requirement, since those courses cannot be counted towards satisfying this requirement.
            count -= courses.filter(course => attributedCourses.has(course.code) && coursePlanCourses.has(course.code)).length;
            let enoughCoursesPresent = count >= requirement.Count;
            // If not, we report an error with the list of missing courses.
            if (!enoughCoursesPresent){
                // Check to see if a course is present but already attributed to another requirement, if so we check to see if the other requirement is a chooseN requirement that could be satisfied by another course in the requirement.
                for (let course of courses){
                    let otherMajorOrMinor = majorOptions[attributedCourses.get(course.code)] || minorOptions[attributedCourses.get(course.code)];
                    for (let otherRequirement of otherMajorOrMinor.Requirements){
                        for (let otherCourse of otherRequirement.Courses){
                            if (otherCourse.code === course.code && otherRequirement.Type === "ChooseN"){
                                // If the other requirement is a chooseN requirement, we check if there are enough other courses in the requirement that are present in the course plan and not attributed to another requirement to satisfy the other requirement without this course.
                                let otherCount = otherRequirement.Courses.filter(c => coursePlanCourses.has(c.code) && c.code !== course.code).length;
                                otherCount -= otherRequirement.Courses.filter(c => attributedCourses.has(c.code) && coursePlanCourses.has(c.code) && c.code !== course.code).length;
                                if (otherCount >= otherRequirement.Count){
                                    // If there are enough other courses, find all courses in the other requirement that are present in the course plan and not attributed to another requirement.
                                    for (let c of otherRequirement.Courses){
                                        if (coursePlanCourses.has(c.code) && !attributedCourses.has(c.code)){
                                            attributedCourses.set(c.code, otherMajorOrMinor.Code);
                                            attributedCourses.set(course.code, major.Code);
                                        }
                                    }
                                }
                                break;
                            }
                        }
                    }
                }
                

                let missingCourses = courses.filter(course => !coursePlanCourses.has(course.code)).map(course => course.code);
                let courseNames = courses.map(course => course.code);
                let message = `Missing courses for ${major.Name}: choose at least ${requirement.Count} of ${courseNames.join(", ")}.`;
                let errorMsg = new PlanError(null, message);
                errors.push(errorMsg);
            } else {
                // If there are enough courses present, we need to attribute the courses that are present in the course plan to this requirement, so that they cannot be counted towards satisfying another requirement.
                for (let course of courses){
                    if (coursePlanCourses.has(course.code) && !attributedCourses.has(course.code)){
                        attributedCourses.set(course.code, major.Code);
                    }
                }
            }
        }
    }
}