import { loadPathways } from "./objects/pathway.js";
import { loadMajorOptions, loadMinorOptions } from "./objects/majorMinorOption.js";

import { state } from "./state.js";
import { PlanError } from './objects/planError.js';

const pathways = await loadPathways();
const majorOptions = await loadMajorOptions();
const minorOptions = await loadMinorOptions();

var errors = [];
const attributedCourses = new Map();
const coursePlanCourses = new Set();
const requiredCourseOverlaps = new Map();
let selectedOptions = [];

export function validateMajorMinorRequirements(){
    // Clear the errors course sets before validating.
    errors = [];
    attributedCourses.clear();
    coursePlanCourses.clear();
    // Fill the course plan courses set with all courses in the course plan for easy lookup.
    for (let semester = 0; semester < state.coursePlan.length; semester++){
		for (let slot = 0; slot < state.coursePlan[semester].length; slot++){
            if (!state.coursePlan[semester][slot]) continue;
            coursePlanCourses.add(state.coursePlan[semester][slot].code);
		}
	}

    // Derive the json data for the selected pathway in order to determine the number of majors and minors required.
    const pathway = pathways[state.selectedPathway];

    if(!pathway) {
        let message = "No valid pathway is selected.";
        let id = `InvalidPathway`;
        let errorMsg = new PlanError(null, message, id);
        errors.push(errorMsg);
        return errors;
    }

    // Check if any majors and minors are unselected.
    for (let i = 0; i < pathway.numMajors; i++){
        if(!state.selectedMajors[i]){
            let message = `Major ${i+1} is missing!`;
            let id = `MissingMajor-${i+1}`;
            let errorMsg = new PlanError(null, message, id);
            errors.push(errorMsg);
        }
    }
    for (let i = 0; i < pathway.numMinors; i++){
        if(!state.selectedMinors[i]){
            let message = `Minor ${i+1} is missing!`;
            let id = `MissingMinor-${i+1}`;
            let errorMsg = new PlanError(null, message, id);
            errors.push(errorMsg);
        }
    }

    // Populate an array of all selected options.
    selectedOptions = [];
    for (let i = 0; i < pathway.numMajors; i++) {
        if (state.selectedMajors[i]) {
            selectedOptions.push(majorOptions[state.selectedMajors[i]]);
        }
    }
    for (let i = 0; i < pathway.numMinors; i++) {
        if (state.selectedMinors[i]) {
            selectedOptions.push(minorOptions[state.selectedMinors[i]]);
        }
    }

    // Assign required courses only, to make overlap solving easier in the future.
    for (let i = 0; i < pathway.numMajors; i++) {
        if (state.selectedMajors[i]) {
            attributeRequiredCourses(
                majorOptions[state.selectedMajors[i]]
            );
        }
    }
    for (let i = 0; i < pathway.numMinors; i++) {
        if (state.selectedMinors[i]) {
            attributeRequiredCourses(
                minorOptions[state.selectedMinors[i]]
            );
        }
    }

    // Assign ChooseN courses
    for (let i = 0; i < pathway.numMajors; i++) {
        if (state.selectedMajors[i]) {
            attributeChooseNCourses(
                majorOptions[state.selectedMajors[i]]
            );
        }
    }
    for (let i = 0; i < pathway.numMinors; i++) {
        if (state.selectedMinors[i]) {
            attributeChooseNCourses(
                minorOptions[state.selectedMinors[i]]
            );
        }
    }

    // Check for overlaps of "Required" courses, substitute with any still unassigned courses in either major/minor.
    for (const [courseCode, unfufilledMajorOrMinor] of requiredCourseOverlaps) {
        substituteCourse(courseCode, unfufilledMajorOrMinor);
    }
    
    // Uncomment below to see which courses correspond to which major/minor.
    console.log(attributedCourses);
    return errors;
}

function attributeRequiredCourses(majorOrMinor){
    for (let requirement of majorOrMinor.Requirements){
        if (requirement.Type !== "Required"){
            continue;
        }

        let courses = requirement.Courses

        for (let course of courses){
            // Course not in study plan
            if (!coursePlanCourses.has(course.code)){
                let missingCourses = courses.filter(course => !coursePlanCourses.has(course.code)).map(course => course.code);
                let message = `Missing required courses for ${majorOrMinor.Name}: ${missingCourses.join(", ")}.`;
                let id = `MissingCourse-${missingCourses.join("-")}-${majorOrMinor.Name}`;
                let errorMsg = new PlanError(null, message, id);
                errors.push(errorMsg);
                continue;
            }
            // Course already attributed to another requirement
            if (attributedCourses.has(course.code)){
                requiredCourseOverlaps.set(course.code, majorOrMinor.Code);
                continue;
            }
            // Attribute course to this major/minor
            attributedCourses.set(course.code, majorOrMinor.Code);
        }
    }
}

function attributeChooseNCourses(majorOrMinor){
    for (let requirement of majorOrMinor.Requirements){
        if (requirement.Type !== "ChooseN"){
            continue;
        }

        let courses = requirement.Courses;
        let availableCourses = courses.filter(course => coursePlanCourses.has(course.code) && !attributedCourses.has(course.code));

        availableCourses.sort((a, b) => {
            return getCourseUsefulness(a.code, majorOrMinor)
                - getCourseUsefulness(b.code, majorOrMinor);
        });

        if (availableCourses.length < requirement.Count){
            const missingCourses = requirement.Courses
                .filter(course => !coursePlanCourses.has(course.code))
                .map(course => course.code);

            let message = `Missing courses for ${majorOrMinor.Name}: choose at least ${requirement.Count} of ${missingCourses.join(", ")}.`;
            let id = `MissingReqs-${missingCourses.join("-")}-${majorOrMinor.Name}-${requirement.Count}`;
            let errorMsg = new PlanError(null, message, id);
            errors.push(errorMsg);
            continue;
        }

        for (let i = 0; i < requirement.Count; i++){
            attributedCourses.set(availableCourses[i].code, majorOrMinor.Code);
        }
    }
}

function getCourseUsefulness(courseCode, currentMajorOrMinor) {
    let usefulness = 0;

    for (let option of selectedOptions) {
        if (option.Code === currentMajorOrMinor.Code) {
            continue;
        }

        for (let requirement of option.Requirements) {
            if (requirement.Type !== "ChooseN") {
                continue;
            }

            let courseIsInRequirement = requirement.Courses.some(
                course => course.code === courseCode
            );

            if (courseIsInRequirement) {
                usefulness++;
            }
        }
    }

    return usefulness;
}

function findReplacementCourse(majorOrMinor, blockedCourseCode) {
    for (let requirement of majorOrMinor.Requirements) {
        if (requirement.Type !== "ChooseN") {
            continue;
        }

        for (let course of requirement.Courses) {
            if (
                course.code !== blockedCourseCode &&
                coursePlanCourses.has(course.code) &&
                !attributedCourses.has(course.code)
            ) {
                return course;
            }
        }
    }

    return null;
}

function substituteCourse(courseCode, unfulfilledMajorOrMinorCode) {
    const possessingOptionCode = attributedCourses.get(courseCode);

    const possessingOption = selectedOptions.find(option =>
        option.Code === possessingOptionCode
    );

    const unfulfilledOption = selectedOptions.find(option =>
        option.Code === unfulfilledMajorOrMinorCode
    );

    console.log(`${unfulfilledOption.Name} needs a substitute for ${courseCode}.`);

    const requiredCourse = findCourseInOption(courseCode, unfulfilledOption);

    const possibleCourses = [
        ...getCoursesOfferedBy(possessingOption),
        ...getCoursesOfferedBy(unfulfilledOption)
    ];

    const replacementCourses = possibleCourses.filter(course =>
        course.code !== courseCode &&
        coursePlanCourses.has(course.code) &&
        !attributedCourses.has(course.code) &&
        course.level >= requiredCourse.level
    );

    replacementCourses.sort((a, b) =>
        getCourseUsefulness(a.code, unfulfilledOption) -
        getCourseUsefulness(b.code, unfulfilledOption)
    );

    const replacementCourse = replacementCourses[0];

    if (!replacementCourse) {
        errors.push(new PlanError(
            courseCode,
            `Course ${courseCode} is required for ${unfulfilledOption.Name} but is already attributed to ${possessingOption.Name}, and no suitable substitute course was found.`,
            `TooManyOverLaps-${courseCode}-${unfulfilledOption.Name}-${possessingOption.Name}`
        ));
        return;
    }

    attributedCourses.set(replacementCourse.code, unfulfilledOption.Code);

    console.log(`${replacementCourse.code} substituted for ${courseCode} in ${unfulfilledOption.Name}.`);
}

function getCoursesOfferedBy(majorOrMinor) {
    const courseMap = new Map();

    if (majorOrMinor != null)
    {
        for (const requirement of majorOrMinor.Requirements) {
            for (const course of requirement.Courses) {
                courseMap.set(course.code, course);
            }
        }

        return [...courseMap.values()];
    }
    else 
    {
        return;
    }
}

function findCourseInOption(courseCode, majorOrMinor) {
    for (const requirement of majorOrMinor.Requirements) {
        for (const course of requirement.Courses) {
            if (course.code === courseCode) {
                return course;
            }
        }
    }

    return null;
}