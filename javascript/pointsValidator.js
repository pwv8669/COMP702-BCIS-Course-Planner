import { state } from "./state.js";
import { PlanError } from './objects/planError.js';
import { courses } from "./app.js";

let errors = [];
let attributedCourses = state.attributedCourses;

/* 
validatePoints: Counts the total points of each option in the pathway.
Inputs: N/A
Outputs: errors (array of PlanError objects)
*/ 
export function validatePoints() {
    errors = [];
    attributedCourses = state.attributedCourses;

    const pathway = state.selectedPathway;
    if(!pathway) {
        let message = "No valid pathway is selected, cannot validate points.";
        let id = `InvalidPathway`;
        let errorMsg = new PlanError(null, message, id);
        errors.push(errorMsg);
        return errors;
    }

    let totalPoints = 0;
    for (const [courseCode, option] of attributedCourses) {
        totalPoints += courses[courseCode].points;
    }

    validateCore();
    if (state.selectedPathway.numMajors == 2) {
        validateMajor(state.selectedMajors[0]);
        validateMajor(state.selectedMajors[1]);
    }
    else if (state.selectedPathway.numMinors == 2) {
        validateMajor(state.selectedMajors[0]);
        validateMinor(state.selectedMinors[0]);
        validateMinor(state.selectedMinors[1]);
    }
    else if (state.selectedPathway.numElectives > 0) {
        validateMajor(state.selectedMajors[0]);
        validateMinor(state.selectedMinors[0]);
        validateElectives();
    }

    if (totalPoints < 360) {
        errors.push(new PlanError(
            null,
            `Graduation criteria requires 360 points but this study plan only has ${totalPoints} (${360-totalPoints} missing).`,
            `TotalPointsBelow360`
        ));
    }
    return errors;
}

/* 
validateCore: Validates total points from Core courses. Condition of 120 points.
Inputs: N/A
Outputs: N/A
*/ 
function validateCore() {
    let corePoints = 0;
    for (const [courseCode, option] of attributedCourses) {
        if (option === "Core") {
            corePoints += courses[courseCode].points; 
        }   
    }
    if (corePoints < 120) {
        errors.push(new PlanError(
            null,
            `Graduation criteria requires 120 points from Core courses. You have ${corePoints} (${120-corePoints} missing).`,
            `CorePointsBelow120`
        ));
    }
}

/* 
validateMajor: Validates total points from Major courses. Condition of 120 points.
Inputs: MajorOption (object)
Outputs: N/A
*/ 
function validateMajor(major){
    // Return early if major is unselected (null)
    if (major == null) return;
    let majorPoints = 0;
    for (const [courseCode, option] of attributedCourses) {
        if (option === major.Code) {
            majorPoints += courses[courseCode].points;
        }
        // Double majors can have overlap up to 30 points, in cases of multiple attribution, split by & and search for the major code.
        else if (option.split(" & ").includes(major.Code)) {
            majorPoints += courses[courseCode].points;
        }
    }
    if (majorPoints < 120) {
        errors.push(new PlanError(
            null,
            `Graduation criteria requires 120 points from ${major.Name} courses. You have ${majorPoints} (${120-majorPoints} missing).`,
            `${major.Code}PointsBelow120`
        ));
    }
}

/* 
validateMinor: Validates total points from Minor courses. Condition of 60 points.
Inputs: MinorOption (object)
Outputs: N/A
*/ 
function validateMinor(minor) {
    // Return early if minor is unselected (null)
    if (minor == null) return;
    let minorPoints = 0;
    for (const [courseCode, option] of attributedCourses) {
        if (option === minor.Code) {
            minorPoints += courses[courseCode].points;
        }
    }
    if (minorPoints < 60)
    {
        errors.push(new PlanError(
            null,
            `Graduation criteria requires 60 points from ${minor.Name} courses. You have ${minorPoints} (${60-minorPoints} missing).`,
            `${minor.Code}PointsBelow60`
        ));
    }
}

/* 
validateElectives: Validates total points from Elective courses. Condition of 60 points.
Inputs: N/A
Outputs: N/A
*/ 
function validateElectives() {
    let electivePoints = 0;
    for (const [courseCode, option] of attributedCourses) {
        if (option === "Elective") {
            electivePoints += courses[courseCode].points;
        }
    }
    if (electivePoints < 60) {
        errors.push(new PlanError(
            null,
            `Graduation criteria requires 60 points from Elective courses. You have ${electivePoints} (${60-electivePoints} missing).`,
            `ElectivePointsBelow60`
        ));
    }
}