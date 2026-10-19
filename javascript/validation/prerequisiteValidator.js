import { state, scheduleConfig } from '../state.js';
import { NodeType } from '../objects/course.js';
import { ErrorSeverity, PlanError } from '../objects/planError.js';
import { loadMajorOptions } from '../objects/majorMinorOption.js';

const majorOptions = await loadMajorOptions();

/* 
getCompletedCourses: Returns all codes for courses completed prior to a given semester.
Inputs: currentSemester (number)
Outputs: completed (Set of coursecode string)
*/ 
export function getCompletedCourses(currentSemester){
    // We create a set to keep track of all the previously completed courses' codes.
    const completed = new Set()
    // Iterates through the previously completed courses and adds them to the set.
    for (let i = 0; i<currentSemester; i++){
        for (let j = 0; j < scheduleConfig.slotsPerSemester; j++){
            const course = state.coursePlan[i][j];
            if (course){
                completed.add(course.code);
            }
        }
    }
    return completed;
}

/* 
getCoursesInSemester: Returns all codes for courses taken in one specific semester.
Inputs: semester (number)
Outputs: courses (Set of coursecode string)
*/ 
function getCoursesInSemester(semester) {
    const courses = new Set();

    if (semester < 0 || semester >= scheduleConfig.semesters) {
        return courses;
    }

    for (const course of state.coursePlan[semester]) {
        if (course) {
            courses.add(course.code);
        }
    }

    return courses;
}

/* 
evaluatePrerequisiteTree: Recursive function which checks prerequisite nodes until none are left
Inputs: node (Node object), completedCourses (Set of courses)
Outputs: true (if no prerequisites), false (if prerequisites)
*/ 
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

/* 
evaluateCoreAndMajorRequirements: Checks if core and major requirements are met (amount of required courses)
Inputs: maximumLevel (number), completedCourses (Set of Course objects)
Outputs: true / false
*/ 
export function evaluateCoreAndMajorRequirements(
    maximumLevel,
    completedCourses
) {
    const options = [
        majorOptions.Core,
        ...state.selectedMajors.filter(major => major)
    ].filter(option => option);

    return options.every(option =>
        option.Requirements.every(requirement => {
            const applicableCourses = requirement.Courses.filter(
                course => course.level <= maximumLevel
            );

            // This requirement only contains courses above the configured
            // level, so it is outside the scope of this prerequisite rule.
            if (applicableCourses.length === 0) {
                return true;
            }

            if (requirement.Type === "Required") {
                return applicableCourses.every(course =>
                    completedCourses.has(course.code)
                );
            }

            if (requirement.Type === "ChooseN") {
                const completedCount = applicableCourses.filter(course =>
                    completedCourses.has(course.code)
                ).length;

                return completedCount >= requirement.Count;
            }

            return false;
        })
    );
}

/* 
validatePointPrerequisites: Validates point prerequisites for courses, returning errors if not met.
Inputs: N/A
Outputs: errors (Array of PlanError object)

This is not point validation for the entire course plan. That is handled in pointsValidator.
*/ 
export function validatePointPrerequisites(){
    const errors = [];

    for (let semester = 0; semester < state.coursePlan.length; semester++) {
        const completedPointsByLevel = new Map([
            [5, 0],
            [6, 0],
            [7, 0]
        ]);
        const countedCourseCodes = new Set();

        // Point prerequisites only count courses completed before the
        // semester containing the course being validated.
        for (let completedSemester = 0;
            completedSemester < semester;
            completedSemester++) {
            for (const course of state.coursePlan[completedSemester]) {
                if (!course || countedCourseCodes.has(course.code)) {
                    continue;
                }

                countedCourseCodes.add(course.code);
                const level = Number(course.level);
                const points = Number(course.points);
                if (
                    !completedPointsByLevel.has(level) ||
                    !Number.isFinite(points)
                ) {
                    continue;
                }

                completedPointsByLevel.set(
                    level,
                    completedPointsByLevel.get(level) + points
                );
            }
        }

        for (let slot = 0;
            slot < state.coursePlan[semester].length;
            slot++) {
            const currentCourse = state.coursePlan[semester][slot];
            if (!currentCourse) continue;

            const requirements = [
                [5, Number(currentCourse.level5PointsRequired ?? 0)],
                [6, Number(currentCourse.level6PointsRequired ?? 0)],
                [7, Number(currentCourse.level7PointsRequired ?? 0)]
            ];
            const unmetRequirements = requirements.filter(
                ([level, requiredPoints]) =>
                    requiredPoints > completedPointsByLevel.get(level)
            );

            if (unmetRequirements.length === 0) continue;

            const requirementDetails = unmetRequirements.map(
                ([level, requiredPoints]) =>
                    `level ${level} requires ${requiredPoints} points but ` +
                    `${completedPointsByLevel.get(level)} have been completed`
            ).join("; ");
            const message =
                `The point prerequisites for ${currentCourse.code} are not ` +
                `met by semester ${semester + 1}: ${requirementDetails}.`;
            const id = `MissingPointPreq-${currentCourse.code}`;
            const errorMsg = new PlanError(
                currentCourse.code,
                message,
                id,
                ErrorSeverity.ERROR
            );
            errorMsg.positions[semester][slot] = true;
            errors.push(errorMsg);
        }
    }

    return errors;
}

/* 
validatePrerequisites: Validates all course prerequisites (and runs the point prerequisite function).
Inputs: N/A
Outputs: errors (Array of PlanError object)
*/ 
export function validatePrerequisites(){
    const errors = [];
    for (let semester = 0; semester < scheduleConfig.semesters; semester++){
        const completedCourses = getCompletedCourses(semester);

        for (let slot = 0; slot < scheduleConfig.slotsPerSemester; slot++){
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
                let errorMsg = new PlanError(currentCourse.code, message, id, ErrorSeverity.ERROR);
                errorMsg.positions[semester][slot] = true;
                errors.push(errorMsg);
                continue;
            }

            const maximumRequirementLevel =
                currentCourse
                    .requiresAllCoreAndMajorRequirementsUpToLevel;

            if (
                maximumRequirementLevel !== null &&
                maximumRequirementLevel !== undefined &&
                !evaluateCoreAndMajorRequirements(
                    maximumRequirementLevel,
                    completedCourses
                )
            ) {
                const message =
                    `The core and selected major requirements up to level ` +
                    `${maximumRequirementLevel} for ${currentCourse.code} ` +
                    `are not met by semester ${semester + 1}.`;
                const id =
                    `MissingCoreAndMajorReqsUpToLevel-` +
                    `${currentCourse.code}-${maximumRequirementLevel}`;
                const errorMsg = new PlanError(
                    currentCourse.code,
                    message,
                    id,
                    ErrorSeverity.ERROR
                );
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
                    id,
                    ErrorSeverity.ERROR
                );
                errorMsg.positions[semester][slot] = true;
                errors.push(errorMsg);
            }
        }
    }
    errors.push(...validatePointPrerequisites());
    return errors;
}

/* 
validateCorequisites: Similar to prerequisite function, but can be in the same semester instead of strictly in the previous semester.
Inputs: N/A
Outputs: errors (Array of PlanError)
*/ 
export function validateCorequisites(){
    const errors = [];
    for (let semester = 0; semester < scheduleConfig.semesters; semester++){
        const completedCourses = getCompletedCourses(semester + 1);

        for (let slot = 0; slot < scheduleConfig.slotsPerSemester; slot++){
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
                let errorMsg = new PlanError(currentCourse.code, message, id, ErrorSeverity.ERROR);
                errorMsg.positions[semester][slot] = true;
                errors.push(errorMsg);
            }
        }
    }
    return errors;
}
