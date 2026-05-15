// Import sub-validators
import { validateNumberOfCourses } from "./numCoursesValidator.js";
import { validateCourseAppearances } from "./duplicateCoursesValidator.js";
import { validatePrerequisites } from "./prerequisiteValidator.js";
import { ValidateChoices } from "./coursecounter.js";

// Returns an array of error objects.
export async function validateStudyPlan(){
    const errors = [];

    const courseCountErrors = await ValidateChoices();
    for (let i = 0; i<courseCountErrors.length; i++){
        await errors.push(courseCountErrors[i]);
    }

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
    return errors;
}