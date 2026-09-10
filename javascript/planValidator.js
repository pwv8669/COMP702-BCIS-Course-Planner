// Import sub-validators
import { validateNumberOfCourses } from "./numCoursesValidator.js";
import { validateCourseAppearances } from "./duplicateCoursesValidator.js";
import { validatePrerequisites, validateCorequisites } from "./prerequisiteValidator.js";
import { validateMajorMinorRequirements } from "./majorMinorRequirementsValidator.js";
import { validateSemestersOffered } from "./semesterOfferedValidator.js";
import { validatePoints } from "./pointsValidator.js";

//Import state for error notes
import { state } from "./state.js";

// Returns an array of error objects.
export function validateStudyPlan(){
    const errors = [];
    
    const prereqErrors = validatePrerequisites();
    for (let i = 0; i < prereqErrors.length; i++) {
        const error = prereqErrors[i];
        if (state.ignoredErrors[error.id]) continue; //Skips error message if it is contained in state.ignoredErrors
        errors.push(error);
    }

    const coreqErrors = validateCorequisites();
    for (let i = 0; i < coreqErrors.length; i++) {
        const error = coreqErrors[i];
        if (state.ignoredErrors[error.id]) continue;
        errors.push(error);
    }

    const duplicateErrors = validateCourseAppearances();
    for (let i = 0; i < duplicateErrors.length; i++) {
        const error = duplicateErrors[i];
        if (state.ignoredErrors[error.id]) continue; 
        errors.push(error);
    }

    const planErrors = validateNumberOfCourses();
    for (let i = 0; i < planErrors.length; i++) {
        const error = planErrors[i];
        if (state.ignoredErrors[error.id]) continue;
        errors.push(error);
    }

    const majorErrors = validateMajorMinorRequirements();
    for (let i = 0; i < majorErrors.length; i++) {
        const error = majorErrors[i];
        if (state.ignoredErrors[error.id]) continue;
        errors.push(error);
    }

    const semestersOfferedErrors = validateSemestersOffered();
    for (let i = 0; i < semestersOfferedErrors.length; i++) {
        const error = semestersOfferedErrors[i];
    }
    
    const pointErrors = validatePoints();
    for (let i = 0; i < pointErrors.length; i++) {
        const error = pointErrors[i];
        if (state.ignoredErrors[error.id]) continue;
        errors.push(error);
    }

    console.log(errors);
    return errors;
}
