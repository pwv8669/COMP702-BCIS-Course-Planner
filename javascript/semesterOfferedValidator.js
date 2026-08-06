import { state } from "./state.js";
import { PlanError } from './objects/planError.js';

export function validateSemestersOffered() {
    const errors = [];
    for (let semester = 0; semester < state.coursePlan.length; semester++){
        for (let slot = 0; slot < state.coursePlan[semester].length; slot++){
            const currentCourse = state.coursePlan[semester][slot];
            // If the position in the course plan is empty, continue.
            if (!currentCourse) continue;

            const valid = offeredThisSemester(currentCourse, semester);

            if (!valid){
                let message = `The course ${currentCourse.code} is not offered in semester ${(semester + 1) % 2} of a year.`; 
                let id = `MissingPreq-${currentCourse.code}`;
                let errorMsg = new PlanError(currentCourse.code, message, id);
                errorMsg.positions[semester][slot] = true;
                errors.push(errorMsg);
            }
        }
    }
    return errors;
}

function offeredThisSemester(course, semester) {
    const isSemester1 = semester % 2 === 0;

    if (isSemester1) return course.semester1Offered;
    return course.semester2Offered;
}