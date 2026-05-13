import { state } from './state.js'
console.log("Loaded");

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
            errors.push({
                code: code,
                appearances: count,
                message: `${code} appears ${count} times. You can only take each class once.`
            });
        }
    });
    console.log(errors);
    return errors;
}