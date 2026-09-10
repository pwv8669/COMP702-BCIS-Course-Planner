import { state } from './state.js';
import { NodeType } from './courseObjectConverter.js';
import { ErrorSeverity, PlanError } from './objects/planError.js';
import { loadMajorOptions } from './objects/majorMinorOption.js';

const majorOptions = await loadMajorOptions();

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
                let errorMsg = new PlanError(currentCourse.code, message, id, ErrorSeverity.ERROR);
                errorMsg.positions[semester][slot] = true;
                errors.push(errorMsg);
            }
        }
    }
    return errors;
}
