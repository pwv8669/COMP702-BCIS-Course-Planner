import { state } from './state.js';
import { NodeType } from './courseObjectConverter.js';

// Returns all codes for courses completed prior to a given semester.
function getCompletedCourses(currentSemester){
    // We create a set to keep track of all the previously completed courses' codes.
    const completed = new Set()
    // Iterates through the previously completed courses and adds them to the set.
    for (let i = 0; i<currentSemester; i++){
        for (const course of state.coursePlan[i]){
            if (course){
                completed.add(course.code);
            }
        }
    }
    return completed;
}

function evaluatePrerequisiteTree(node, completedCourses) {
    // No Prerequisites
    if (!node) return true;

    switch (node.type){
        case NodeType.COURSE:
            console.log("Checking:", node.value, "→", completedCourses.has(node.value));
            return completedCourses.has(node.value);
        case NodeType.AND:
            return node.children.every(child =>
                evaluatePrerequisiteTree(child, completedCourses)
            );
        case NodeType.OR:
            return node.children.some(child =>
                evaluatePrerequisiteTree(child, completedCourses)
            );
    }

    return false;
}

export async function validatePrerequisites(){
    const errors = [];
    for (let semester = 0; semester < state.coursePlan.length; semester++){
        const completedCourses = getCompletedCourses(semester);

        for (let slot = 0; slot < state.coursePlan[semester].length; slot++){
            const currentCourse = state.coursePlan[semester][slot];
            // If the position in the course plan is empty, continue.
            if (!currentCourse) continue;

            const valid = evaluatePrerequisiteTree(
                currentCourse.prerequisites,
                completedCourses
            )

            if (!valid){
                errors.push({
                    code: currentCourse.code,
                    message: `The prerequisites for ${currentCourse.code} are not met by semester ${semester+1}.`
                });
            }
        }
    }
    console.log(errors);
    return errors;
}