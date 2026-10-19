import { state } from "../state.js";
import { PlanError, ErrorSeverity } from '../objects/planError.js';
import { scheduleConfig } from "../state.js";

/* 
validateSemestersOffered: Validates if the semester a course is placed in is one of the semesters it is offered in.
Inputs: N/A
Outputs: errors (Array of PlanError)
*/ 
export function validateSemestersOffered() {
    const errors = [];
    for (let semester = 0; semester < scheduleConfig.semesters; semester++){
        for (let slot = 0; slot < scheduleConfig.slotsPerSemester; slot++){
            const currentCourse = state.coursePlan[semester][slot];
            // If the position in the course plan is empty, continue.
            if (!currentCourse) continue;

            const valid = offeredThisSemester(currentCourse, semester);

            if (!valid){
                const semesterOrdinal = semester % 2 === 0 ? "1st" : "2nd";
                let message = `The course ${currentCourse.code} is not offered in the ${semesterOrdinal} semester of a year.`;
                let id = `SemesterNotOffered-${currentCourse.code}-${semester}`;
                let errorMsg = new PlanError(currentCourse.code, message, id, ErrorSeverity.ERROR);
                errorMsg.positions[semester][slot] = true;
                errors.push(errorMsg);
            }
        }
    }
    return errors;
}

// Helper function to determine if a course is offered in the given semester
function offeredThisSemester(course, semester) {
    const isSemester1 = semester % 2 === 0;

    if (isSemester1) return course.semester1Offered;
    return course.semester2Offered;
}
