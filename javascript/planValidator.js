// Import sub-validators
import { validateNumberOfCourses } from "./numCoursesValidator.js";
import { validateCourseAppearances } from "./duplicateCoursesValidator.js";
import { validatePrerequisites } from "./prerequisiteValidator.js";
import { validateChoices } from "./courseCounter.js";

// Returns an array of error objects.
export function validateStudyPlan(){
    const errors = [];
    
    const prereqErrors = validatePrerequisites();
    for (let i = 0; i<prereqErrors.length; i++){
        errors.push(prereqErrors[i]);
    }

    const duplicateErrors = validateCourseAppearances();
    for (let i = 0; i<duplicateErrors.length; i++){
        errors.push(duplicateErrors[i]);
    }

    const planErrors = validateNumberOfCourses();
    for (let i = 0; i<planErrors.length; i++){
        errors.push(planErrors[i]);
    }

    const majorErrors = validateChoices()
    for(let i = 0; i<majorErrors.length; i++){
        errors.push(majorErrors[i]);
    }

    console.log(errors);
    return errors;
}