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
const chooseNSubstitutions = [];
const chooseNRequirements = [];
let selectedOptions = [];

export function validateMajorMinorRequirements(){
    // Clear the errors course sets before validating.
    errors = [];
    attributedCourses.clear();
    coursePlanCourses.clear();
    requiredCourseOverlaps.clear();
    chooseNSubstitutions.length = 0;
    chooseNRequirements.length = 0;
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

    // Core courses occupy degree slots and cannot be used as substitutes.
    attributeCoreCourses();

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

    // Allocate every ChooseN selection and all substitutions in one search.
    if (!attributeChooseNRequirements()) {
        for (const [courseCode, unfulfilledOptionCode] of
            requiredCourseOverlaps) {
            addRequiredSubstitutionError(
                courseCode,
                unfulfilledOptionCode
            );
        }

        for (const choice of getUnfulfilledChooseNRequirements()) {
            addChooseNError(
                choice.majorOrMinor,
                choice.requirement
            );
        }
    }
    
    // Uncomment below to see which courses correspond to which major/minor.
    console.log(attributedCourses);
    return errors;
}

function attributeCoreCourses() {
    const core = majorOptions.Core;
    if (!core) return;

    for (const requirement of core.Requirements) {
        for (const course of requirement.Courses) {
            if (coursePlanCourses.has(course.code)) {
                attributedCourses.set(course.code, core.Code);
            }
        }
    }
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
        chooseNRequirements.push({ majorOrMinor, requirement });
    }
}

function attributeChooseNRequirements(index = 0) {
    if (index === chooseNRequirements.length) {
        return attributeSubstitutions();
    }

    const choice = chooseNRequirements[index];
    const { majorOrMinor, requirement } = choice;
    const availableCourses = requirement.Courses
        .filter(course =>
            coursePlanCourses.has(course.code) &&
            !attributedCourses.has(course.code)
        )
        .sort((a, b) =>
            getCourseUsefulness(a.code, majorOrMinor) -
            getCourseUsefulness(b.code, majorOrMinor)
        );
    const overlappingCourseCount = requirement.Courses.filter(
        course =>
            coursePlanCourses.has(course.code) &&
            attributedCourses.has(course.code)
    ).length;
    const minimumSubstitutionCount = Math.max(
        0,
        requirement.Count - availableCourses.length
    );
    const maximumSubstitutionCount = Math.min(
        requirement.Count,
        overlappingCourseCount
    );

    for (
        let substitutionCount = minimumSubstitutionCount;
        substitutionCount <= maximumSubstitutionCount;
        substitutionCount++
    ) {
        const directCourseCount =
            requirement.Count - substitutionCount;

        for (const combination of getCombinations(
            availableCourses,
            directCourseCount
        )) {
            for (const course of combination) {
                attributedCourses.set(course.code, majorOrMinor.Code);
            }

            if (substitutionCount > 0) {
                chooseNSubstitutions.push({
                    majorOrMinor,
                    requirement,
                    count: substitutionCount
                });
            }

            if (attributeChooseNRequirements(index + 1)) {
                return true;
            }

            if (substitutionCount > 0) {
                chooseNSubstitutions.pop();
            }

            for (const course of combination) {
                attributedCourses.delete(course.code);
            }
        }
    }

    return false;
}

function addChooseNError(majorOrMinor, requirement) {
    const missingCourses = requirement.Courses
        .filter(course => !coursePlanCourses.has(course.code))
        .map(course => course.code);
    const coursesToDisplay = missingCourses.length > 0
        ? missingCourses
        : requirement.Courses.map(course => course.code);

    const message =
        `Missing courses for ${majorOrMinor.Name}: choose at least ` +
        `${requirement.Count} of ${coursesToDisplay.join(", ")}.`;
    const id =
        `MissingReqs-${coursesToDisplay.join("-")}-` +
        `${majorOrMinor.Name}-${requirement.Count}`;

    errors.push(new PlanError(null, message, id));
}

function getUnfulfilledChooseNRequirements() {
    const intrinsicallyShortRequirements = chooseNRequirements.filter(
        choice => {
            const plannedCourseCount = choice.requirement.Courses.filter(
                course => coursePlanCourses.has(course.code)
            ).length;

            return plannedCourseCount < choice.requirement.Count;
        }
    );

    if (intrinsicallyShortRequirements.length > 0) {
        return intrinsicallyShortRequirements;
    }

    // If required overlaps also failed, their specific errors explain the
    // allocation failure without blaming otherwise complete ChooseN groups.
    if (requiredCourseOverlaps.size > 0) {
        return [];
    }

    // A pure ChooseN conflict has no intrinsically missing group. Report the
    // tightest group so the user still receives an actionable course list.
    const orderedRequirements = [...chooseNRequirements].sort((a, b) => {
        const getSlack = choice =>
            choice.requirement.Courses.filter(
                course => coursePlanCourses.has(course.code)
            ).length - choice.requirement.Count;

        return getSlack(a) - getSlack(b);
    });

    return orderedRequirements.slice(0, 1);
}

function attributeSubstitutions(substitutions = null) {
    if (substitutions === null) {
        substitutions = [
            ...Array.from(
                requiredCourseOverlaps,
                ([courseCode, unfulfilledOptionCode]) => ({
                    type: "Required",
                    courseCode,
                    unfulfilledOptionCode,
                    count: 1
                })
            ),
            ...chooseNSubstitutions.map(substitution => ({
                ...substitution,
                type: "ChooseN"
            }))
        ];
    }

    if (substitutions.length === 0) {
        return true;
    }

    const totalSubstitutions =
        requiredCourseOverlaps.size +
        chooseNSubstitutions.reduce(
            (total, substitution) =>
                total + substitution.count,
            0
        );
    let selectedIndex = -1;
    let selectedCandidates = null;
    let smallestCombinationCount = Infinity;

    for (let index = 0; index < substitutions.length; index++) {
        const substitution = substitutions[index];
        const candidates = getSubstitutionCandidates(
            substitution,
            totalSubstitutions
        );

        if (candidates.length < substitution.count) {
            return false;
        }

        const combinationCount = getCombinationCount(
            candidates.length,
            substitution.count
        );

        if (combinationCount < smallestCombinationCount) {
            selectedIndex = index;
            selectedCandidates = candidates;
            smallestCombinationCount = combinationCount;
        }
    }

    const substitution = substitutions[selectedIndex];
    const remainingSubstitutions = substitutions.filter(
        (_, index) => index !== selectedIndex
    );

    for (const combination of getCombinations(
        selectedCandidates,
        substitution.count
    )) {
        const optionCode = substitution.type === "Required"
            ? substitution.unfulfilledOptionCode
            : substitution.majorOrMinor.Code;

        for (const course of combination) {
            attributedCourses.set(
                course.code,
                optionCode
            );
        }

        if (attributeSubstitutions(remainingSubstitutions)) {
            return true;
        }

        for (const course of combination) {
            attributedCourses.delete(course.code);
        }
    }

    return false;
}

function getSubstitutionCandidates(substitution, totalSubstitutions) {
    if (substitution.type === "Required") {
        return getRequiredSubstitutionCandidates(substitution);
    }

    return getChooseNSubstitutionCandidates(
        substitution,
        totalSubstitutions
    );
}

function getRequiredSubstitutionCandidates(substitution) {
    const possessingOptionCode = attributedCourses.get(
        substitution.courseCode
    );
    const possessingOption = selectedOptions.find(option =>
        option.Code === possessingOptionCode
    );
    const unfulfilledOption = selectedOptions.find(option =>
        option.Code === substitution.unfulfilledOptionCode
    );
    const requiredCourse = findCourseInOption(
        substitution.courseCode,
        unfulfilledOption
    );
    const canUseUnrestrictedSubstitute =
        state.selectedPathway === "doubleMajors" &&
        requiredCourseOverlaps.size <= 2;
    const possibleCourses = canUseUnrestrictedSubstitute
        ? getCourseObjectsFromPlan()
        : [
            ...getCoursesOfferedBy(possessingOption),
            ...getCoursesOfferedBy(unfulfilledOption)
        ];

    return possibleCourses
        .filter(course =>
            course.code !== substitution.courseCode &&
            coursePlanCourses.has(course.code) &&
            !attributedCourses.has(course.code) &&
            (
                canUseUnrestrictedSubstitute ||
                course.level >= requiredCourse.level
            )
        )
        .sort((a, b) =>
            getCourseUsefulness(a.code, unfulfilledOption) -
            getCourseUsefulness(b.code, unfulfilledOption)
        );
}

function getChooseNSubstitutionCandidates(
    substitution,
    totalSubstitutions
) {
    const isUnrestrictedDoubleMajorSubstitution =
        state.selectedPathway === "doubleMajors" &&
        totalSubstitutions <= 2;
    const minimumLevel = Math.min(
        ...substitution.requirement.Courses.map(
            course => course.level
        )
    );
    const optionCourseCodes = new Set(
        selectedOptions.flatMap(option =>
            option.Requirements.flatMap(requirement =>
                requirement.Courses.map(course => course.code)
            )
        )
    );

    return getCourseObjectsFromPlan()
        .filter(course => {
            if (attributedCourses.has(course.code)) {
                return false;
            }

            if (isUnrestrictedDoubleMajorSubstitution) {
                return true;
            }

            return (
                optionCourseCodes.has(course.code) &&
                course.level >= minimumLevel
            );
        })
        .sort((a, b) => a.level - b.level);
}

function getCourseObjectsFromPlan() {
    const courses = new Map();

    for (const semester of state.coursePlan) {
        for (const course of semester) {
            if (course) {
                courses.set(course.code, course);
            }
        }
    }

    return Array.from(courses.values());
}

function* getCombinations(
    courses,
    count,
    startIndex = 0,
    combination = []
) {
    if (count < 0 || count > courses.length) {
        return;
    }

    if (combination.length === count) {
        yield [...combination];
        return;
    }

    const coursesStillNeeded = count - combination.length;
    const finalStartIndex = courses.length - coursesStillNeeded;

    for (let index = startIndex; index <= finalStartIndex; index++) {
        combination.push(courses[index]);
        yield* getCombinations(
            courses,
            count,
            index + 1,
            combination
        );
        combination.pop();
    }
}

function getCombinationCount(numberOfCourses, count) {
    if (count < 0 || count > numberOfCourses) {
        return 0;
    }

    const smallerCount = Math.min(
        count,
        numberOfCourses - count
    );
    let result = 1;

    for (let i = 1; i <= smallerCount; i++) {
        result *= (numberOfCourses - smallerCount + i) / i;
    }

    return result;
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

function addRequiredSubstitutionError(
    courseCode,
    unfulfilledMajorOrMinorCode
) {
    const possessingOptionCode = attributedCourses.get(courseCode);
    const possessingOption = selectedOptions.find(option =>
        option.Code === possessingOptionCode
    );
    const unfulfilledOption = selectedOptions.find(option =>
        option.Code === unfulfilledMajorOrMinorCode
    );

    errors.push(new PlanError(
        courseCode,
        `Course ${courseCode} is required for ${unfulfilledOption.Name} but is already attributed to ${possessingOption.Name}, and no suitable substitute course was found.`,
        `TooManyOverLaps-${courseCode}-${unfulfilledOption.Name}-${possessingOption.Name}`
    ));
}

function getCoursesOfferedBy(majorOrMinor) {
    const courseMap = new Map();

    for (const requirement of majorOrMinor.Requirements) {
        for (const course of requirement.Courses) {
            courseMap.set(course.code, course);
        }
    }

    return [...courseMap.values()];
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
