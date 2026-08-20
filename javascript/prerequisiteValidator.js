import { state } from './state.js';
import { NodeType } from './courseObjectConverter.js';
import { PlanError } from './objects/planError.js';

// Returns all codes for courses completed prior to a given semester.
export function getCompletedCourses(currentSemester){
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

// Returns all codes for courses taken in one specific semester.
function getCoursesInSemester(semester) {
    const courses = new Set();

    if (semester < 0 || semester >= state.coursePlan.length) {
        return courses;
    }

    for (const course of state.coursePlan[semester]) {
        if (course) {
            courses.add(course.code);
        }
    }

    return courses;
}

export function evaluatePrerequisiteTree(node, completedCourses) {
    // No Prerequisites
    if (!node) return true;

    switch (node.type){
        case NodeType.COURSE:
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

export function validatePrerequisites(){
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
                let message = `The prerequisites for ${currentCourse.code} are not met by semester ${semester+1}.`; 
                let id = `MissingPreq-${currentCourse.code}`;
                let errorMsg = new PlanError(currentCourse.code, message, id);
                errorMsg.positions[semester][slot] = true;
                errors.push(errorMsg);
                continue;
            }

            if (
                currentCourse.mustBeTakenConsequtively &&
                !evaluatePrerequisiteTree(
                    currentCourse.prerequisites,
                    getCoursesInSemester(semester - 1)
                )
            ) {
                const message =
                    `The prerequisites for ${currentCourse.code} must be ` +
                    `taken in the immediately preceding semester.`;
                const id = `NonConsecutivePreq-${currentCourse.code}`;
                const errorMsg = new PlanError(
                    currentCourse.code,
                    message,
                    id
                );
                errorMsg.positions[semester][slot] = true;
                errors.push(errorMsg);
            }
        }
    }
    return errors;
}

export function validateCorequisites(){
    const errors = [];
    for (let semester = 0; semester < state.coursePlan.length; semester++){
        const completedCourses = getCompletedCourses(semester + 1);

        for (let slot = 0; slot < state.coursePlan[semester].length; slot++){
            const currentCourse = state.coursePlan[semester][slot];
            // If the position in the course plan is empty, continue.
            if (!currentCourse) continue;

            const valid = evaluatePrerequisiteTree(
                currentCourse.corequisites,
                completedCourses
            )

            if (!valid){
                let message = `The corequisites for ${currentCourse.code} are not met by semester ${semester+1}.`;
                let id = `MissingCoreq-${currentCourse.code}`;
                let errorMsg = new PlanError(currentCourse.code, message, id);
                errorMsg.positions[semester][slot] = true;
                errors.push(errorMsg);
            }
        }
    }
    return errors;
}
