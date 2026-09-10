import { state } from './state.js'
import { PlanError, ErrorSeverity } from './objects/planError.js';

function getCourseCounts(){
    const appearances = new Map();
    for (let i = 0; i<state.coursePlan.length; i++){
        for (let j = 0; j<state.coursePlan[i].length; j++){
            const course = state.coursePlan[i][j];
            if (!course) continue;
            const code = course.code;

            if (appearances.has(code)){
                const currentValue = appearances.get(code);
                appearances.set(code, currentValue+1);
            } else {
                appearances.set(code, 1);
            }
        }
    }
    return appearances;
}

export function validateCourseAppearances() {
    const errors = [];
    const appearances = getCourseCounts();
    appearances.forEach((count, code) => {
        if (count > 1) {
            let message = `${code} appears in the study plan ${count} times. You can only take each class once.`
            let id = `DuplicateClass-${code}-${count}-Times`;
            let errorMsg = new PlanError(code, message, id, ErrorSeverity.ERROR);
            errorMsg.occurences = count

            for (let semester = 0; semester < state.coursePlan.length; semester++){
                for (let slot = 0; slot < state.coursePlan[semester].length; slot++){
                    const course = state.coursePlan[semester][slot]
                    if (!course) continue;
                    if (course.code === code) {
                        errorMsg.positions[semester][slot] = true;
                    } 
                }
            }

            errors.push(errorMsg);
        }
    });
    return errors;
}