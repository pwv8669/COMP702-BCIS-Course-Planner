// Autopopulate study plan module
// This script aims to build a set containing courses which satisfy the major/minor requirements
// It tries all combinations of ChooseN requirement choices & duplicate Required substitutions until a valid solution is found.
// It then schedules the courses in a valid way.

// Imports ---------- //
import { refreshStudyPlan } from './app.js';
import { state } from './state.js';
import { loadPathways } from "./objects/pathway.js";
import { loadMajorOptions, loadMinorOptions } from "./objects/majorMinorOption.js";
import { evaluatePrerequisiteTree } from './prerequisiteValidator.js';
import { loadCourses } from './courseObjectConverter.js';

// Global consts ---------- //
const pathways = await loadPathways();
const coursesObject = await loadCourses();
const majorOptions = await loadMajorOptions();
const minorOptions = await loadMinorOptions();

// Map to track how many substitutes are required for each course.
// Courses must be substituted when 2+ majors/minors require the same course.
// Key: course.code, Value: Number of substitutions required.
const coursesToSubstitute = new Map();

const chooseNSubstitutions = [];

/*
 * Course data and semester rules are static for the lifetime of the page, so
 * the same selected course set always has the same scheduling result. This
 * cache also avoids solving an identical set reached through different
 * requirement-choice paths.
 */
const scheduleCache = new Map();

// Rigging event listener to button that triggers autopopulation
const button = document.getElementById('AutocompletePlanButton');
button.addEventListener('click', () => {
    console.log("Autopopulate Plan button clicked");
    // Call the function to autopopulate the study plan
    autocompleteStudyPlan();
});

// Entry point for autocompletion logic
function autocompleteStudyPlan() {
    if (!generateStudyPlan()) {
        return;
    }

    refreshStudyPlan();
}

/*
 * Generate and commit a plan without rendering it. Keeping generation
 * separate from the button/UI work makes the solver reusable and keeps its
 * performance straightforward to test.
 */
export function generateStudyPlan() {
    // Checks that pathway and options have been selected, fails otherwise
    if (!checkIfMajorsAndMinorsSelected()) {
        return false;
    }

    // Wipes the substitution list, as it should not contain leftover data.
    coursesToSubstitute.clear();
    chooseNSubstitutions.length = 0;

    // Builds a list of courses, if it could not build a valid study plan, it fails.
    const selectedCourses = buildCourseList();
    if (!selectedCourses) {
        alert("Unable to generate a valid study plan.");
        return false;
    }

    return true;
}

// Builds a map of all the selected courses.
function buildCourseList() {
    const selectedCourses = new Map();

    addCoreCourses(selectedCourses);
    addRequiredCourses(selectedCourses);

    const chooseNRequirements =
        getAllChooseNRequirements();

    if (!tryChooseNRequirements(
        chooseNRequirements,
        0,
        selectedCourses
    )) {
        return null;
    }

    return selectedCourses;
}

// --- BuildCourseList() helper functions --- //
// Adds core courses to the selectedCourses map.
function addCoreCourses(selectedCourses) {
    const core = majorOptions["Core"]
    if (!core) return;

    for (const requirement of core.Requirements) {
        if (requirement.Type !== "Required") continue;
            
        for (const course of requirement.Courses) {
            if (selectedCourses.has(course.code)) continue;
            selectedCourses.set(course.code, course);
        }
    }
}

// Adds only the required courses to the selectedCourses map.
// If there are overlaps, it adds the course to corsesToSubstitute so that we can revisit it.
function addRequiredCourses(selectedCourses) {
    const selectedPathway = pathways[state.selectedPathway];
    // Add major required courses
    for (let i = 0; i < selectedPathway.numMajors; i++) {
        const majorCode = state.selectedMajors[i];
        if (!majorCode) continue;
        
        const major = majorOptions[majorCode];
        if (!major) continue; 
        
        for (const requirement of major.Requirements) {
            if (requirement.Type !== "Required") continue;
            
            for (const course of requirement.Courses) {
                if (selectedCourses.has(course.code)) {
                    if (!coursesToSubstitute.has(course.code)) {
                        coursesToSubstitute.set(course.code, 0);
                    }

                    coursesToSubstitute.set(course.code, coursesToSubstitute.get(course.code) + 1);
                    continue;
                }
                selectedCourses.set(course.code, course);
            }
        }
    }
    // Add minor required courses
    for (let i = 0; i < selectedPathway.numMinors; i++) {
        const minorCode = state.selectedMinors[i];
        if (!minorCode) continue;

        const minor = minorOptions[minorCode];
        if (!minor) continue; 

        for (const requirement of minor.Requirements) {
            if (requirement.Type !== "Required") continue;
            
            for (const course of requirement.Courses) {
                if (selectedCourses.has(course.code)) {
                    if (!coursesToSubstitute.has(course.code)) {
                        coursesToSubstitute.set(course.code, 0);
                    }

                    coursesToSubstitute.set(course.code, coursesToSubstitute.get(course.code) + 1);
                    continue;
                }
                selectedCourses.set(course.code, course);
            }
        }
    }
}

// Recursive backtracking to satisfy all ChooseN requirements.
function tryChooseNRequirements(
    requirements,
    index,
    selectedCourses
) {
    // All ChooseN requirements have been processed.
    if (index === requirements.length) {
        return tryOverlapSubstitutions(
            selectedCourses
        );
    }

    const requirement = requirements[index];

    const availableCourses =
        requirement.Courses.filter(
            course =>
                !selectedCourses.has(course.code)
        );
    const orderedAvailableCourses =
        orderRequirementCourses(
            availableCourses,
            selectedCourses
        );
    const overlappingCourseCount =
        requirement.Courses.length -
        availableCourses.length;
    const minimumSubstitutionCount =
        Math.max(
            0,
            requirement.Count -
                orderedAvailableCourses.length
        );
    const maximumSubstitutionCount =
        Math.min(
            requirement.Count,
            overlappingCourseCount
        );

    /*
     * Prefer unused requirement courses, but also explore using an already
     * attributed requirement course plus a substitute. This alternative is
     * important when the unused course cannot be scheduled because its own
     * prerequisites are absent.
     */
    for (
        let substitutionCount =
            minimumSubstitutionCount;
        substitutionCount <=
            maximumSubstitutionCount;
        substitutionCount++
    ) {
        const newCourseCount =
            requirement.Count -
            substitutionCount;

        for (const combination of getCombinations(
            orderedAvailableCourses,
            newCourseCount
        )) {
            for (const course of combination) {
                selectedCourses.set(
                    course.code,
                    course
                );
            }

            if (substitutionCount > 0) {
                chooseNSubstitutions.push({
                    requirement,
                    count: substitutionCount
                });
            }

            if (
                tryChooseNRequirements(
                    requirements,
                    index + 1,
                    selectedCourses
                )
            ) {
                return true;
            }

            if (substitutionCount > 0) {
                chooseNSubstitutions.pop();
            }

            for (const course of combination) {
                selectedCourses.delete(
                    course.code
                );
            }
        }
    }

    return false;
}

/*
 * Within a Choose-N requirement, first try courses whose prerequisites are
 * already present. The JSON order is preserved within each group so this
 * heuristic does not otherwise alter the preferred academic ordering.
 */
function orderRequirementCourses(
    courses,
    selectedCourses
) {
    const selectedCourseCodes =
        new Set(selectedCourses.keys());

    return courses
        .map(
            (course, originalIndex) => ({
                course,
                originalIndex,
                prerequisitesAvailable:
                    prerequisiteTreeIsCovered(
                        course.prerequisites,
                        selectedCourseCodes
                    )
            })
        )
        .sort((a, b) => {
            if (
                a.prerequisitesAvailable !==
                b.prerequisitesAvailable
            ) {
                return a.prerequisitesAvailable
                    ? -1
                    : 1;
            }

            return (
                a.originalIndex -
                b.originalIndex
            );
        })
        .map(entry => entry.course);
}

/*
 * Yield combinations one at a time. This keeps the search lazy: as soon as a
 * valid plan is found, no later combinations are built or stored in memory.
 */
function* getCombinations(
    courses,
    count,
    startIndex = 0,
    currentCombination = []
) {
    if (count < 0 || count > courses.length) {
        return;
    }

    if (currentCombination.length === count) {
        yield [...currentCombination];
        return;
    }

    const coursesStillNeeded =
        count - currentCombination.length;
    const finalStartIndex =
        courses.length - coursesStillNeeded;

    for (
        let i = startIndex;
        i <= finalStartIndex;
        i++
    ) {
        currentCombination.push(courses[i]);

        yield* getCombinations(
            courses,
            count,
            i + 1,
            currentCombination
        );

        currentCombination.pop();
    }
}

// Collectt all ChooseN requirements from selected majors and minors.
function getAllChooseNRequirements() {
    const requirements = [];
    const selectedPathway = pathways[state.selectedPathway];

    // Majors
    for (let i = 0; i < selectedPathway.numMajors; i++) {
        const majorCode = state.selectedMajors[i];
        if (!majorCode) continue;

        const major = majorOptions[majorCode];
        if (!major) continue;

        requirements.push(
            ...major.Requirements.filter(
                requirement => requirement.Type === "ChooseN"
            )
        );
    }

    // Minors
    for (let i = 0; i < selectedPathway.numMinors; i++) {
        const minorCode = state.selectedMinors[i];
        if (!minorCode) continue;

        const minor = minorOptions[minorCode];
        if (!minor) continue;

        requirements.push(
            ...minor.Requirements.filter(
                requirement => requirement.Type === "ChooseN"
            )
        );
    }

    return requirements;
}

// Substitute overlapping courses.
function tryOverlapSubstitutions(selectedCourses) {
    const replacementGroups = [
        ...getReplacementGroups(),
        ...getChooseNReplacementGroups()
    ];
    const selectedPathway =
        pathways[state.selectedPathway];

    if (selectedPathway.numElectives > 0) {
        replacementGroups.push({
            isElective: true,
            count: selectedPathway.numElectives
        });
    }

    return tryReplacementGroups(
        replacementGroups,
        selectedCourses
    );
}

/*
 * Try replacement groups using the most-constrained group first. Candidate
 * lists change as courses are selected, so this choice is recalculated at
 * every level of the search.
 */
function tryReplacementGroups(
    replacementGroups,
    selectedCourses
) {
    // All overlap replacements have been selected.
    if (replacementGroups.length === 0) {
        return scheduleCourses(
            new Map(selectedCourses)
        );
    }

    let selectedGroupIndex = -1;
    let availableCourses = null;
    let smallestBranchCount = Infinity;
    const candidateLists = [];
    const potentiallySelectableCourseCodes =
        new Set(selectedCourses.keys());

    for (
        let index = 0;
        index < replacementGroups.length;
        index++
    ) {
        const group = replacementGroups[index];
        const candidates =
            getReplacementCandidates(
                group,
                selectedCourses
            );
        candidateLists.push(candidates);

        for (const candidate of candidates) {
            potentiallySelectableCourseCodes.add(
                candidate.code
            );
        }
    }

    /*
     * A selected course may currently be waiting for a prerequisite supplied
     * by a later replacement group. If even the union of every remaining
     * candidate cannot provide that prerequisite, this entire branch can be
     * rejected before generating combinations.
     */
    for (const course of selectedCourses.values()) {
        if (
            !prerequisiteTreeIsCovered(
                course.prerequisites,
                potentiallySelectableCourseCodes
            )
        ) {
            return false;
        }
    }

    for (
        let index = 0;
        index < replacementGroups.length;
        index++
    ) {
        const group = replacementGroups[index];
        const candidates =
            candidateLists[index].filter(
                course =>
                    prerequisiteTreeIsCovered(
                        course.prerequisites,
                        potentiallySelectableCourseCodes
                    )
            );

        if (candidates.length < group.count) {
            return false;
        }

        const branchCount =
            getCombinationCount(
                candidates.length,
                group.count
            );

        if (branchCount < smallestBranchCount) {
            selectedGroupIndex = index;
            availableCourses = candidates;
            smallestBranchCount = branchCount;
        }
    }

    const group =
        replacementGroups[selectedGroupIndex];
    const remainingGroups =
        replacementGroups.filter(
            (_, index) =>
                index !== selectedGroupIndex
        );

    for (const combination of getCombinations(
        availableCourses,
        group.count
    )) {

        // Add this replacement combination.
        for (const course of combination) {
            selectedCourses.set(
                course.code,
                course
            );
        }

        // Try the next replacement group.
        if (
            tryReplacementGroups(
                remainingGroups,
                selectedCourses
            )
        ) {
            if (group.isElective) {
                state.selectedElectives =
                    combination.map(
                        course => course.code
                    );
            }

            return true;
        }

        // Backtrack.
        for (const course of combination) {
            selectedCourses.delete(
                course.code
            );
        }
    }

    return false;
}

function getReplacementCandidates(
    group,
    selectedCourses
) {
    let candidates;

    if (group.isElective) {
        candidates =
            getAvailableElectiveCourses(
                selectedCourses
            );
    } else if (group.requirement) {
        candidates =
            getAvailableChooseNReplacementCourses(
                group,
                selectedCourses
            );
    } else {
        candidates =
            getAvailableReplacementCourses(
                group.duplicatedCourse,
                selectedCourses
            );
    }

    return orderCandidateCourses(
        candidates,
        selectedCourses
    );
}

/*
 * Try candidates whose prerequisites are already represented by the current
 * course set first. Flexible offerings and lower-level courses are used as
 * tie-breakers. This changes search order only; every candidate remains
 * available to the complete backtracking search.
 */
function orderCandidateCourses(
    candidates,
    selectedCourses
) {
    const selectedCourseCodes =
        new Set(selectedCourses.keys());
    const neededPrerequisiteCounts =
        new Map();

    for (
        const selectedCourse
        of selectedCourses.values()
    ) {
        const prerequisiteCodes =
            new Set();

        collectPrerequisiteCodes(
            selectedCourse.prerequisites,
            prerequisiteCodes
        );

        for (
            const prerequisiteCode
            of prerequisiteCodes
        ) {
            if (
                selectedCourseCodes.has(
                    prerequisiteCode
                )
            ) {
                continue;
            }

            neededPrerequisiteCounts.set(
                prerequisiteCode,
                (
                    neededPrerequisiteCounts.get(
                        prerequisiteCode
                    ) ?? 0
                ) + 1
            );
        }
    }

    return [...candidates].sort((a, b) => {
        const prerequisiteUsefulnessDifference =
            (
                neededPrerequisiteCounts.get(
                    b.code
                ) ?? 0
            ) -
            (
                neededPrerequisiteCounts.get(
                    a.code
                ) ?? 0
            );

        if (
            prerequisiteUsefulnessDifference !==
            0
        ) {
            return prerequisiteUsefulnessDifference;
        }

        const aPrerequisitesAvailable =
            prerequisiteTreeIsCovered(
                a.prerequisites,
                selectedCourseCodes
            );
        const bPrerequisitesAvailable =
            prerequisiteTreeIsCovered(
                b.prerequisites,
                selectedCourseCodes
            );

        if (
            aPrerequisitesAvailable !==
            bPrerequisitesAvailable
        ) {
            return aPrerequisitesAvailable
                ? -1
                : 1;
        }

        const aOfferingCount =
            Number(a.semester1Offered) +
            Number(a.semester2Offered);
        const bOfferingCount =
            Number(b.semester1Offered) +
            Number(b.semester2Offered);

        if (aOfferingCount !== bOfferingCount) {
            return (
                bOfferingCount -
                aOfferingCount
            );
        }

        return a.level - b.level;
    });
}

function prerequisiteTreeIsCovered(
    node,
    courseCodes
) {
    if (!node) {
        return true;
    }

    if (node.type === "COURSE") {
        return courseCodes.has(node.value);
    }

    if (node.type === "AND") {
        return node.children.every(
            child =>
                prerequisiteTreeIsCovered(
                    child,
                    courseCodes
                )
        );
    }

    if (node.type === "OR") {
        return node.children.some(
            child =>
                prerequisiteTreeIsCovered(
                    child,
                    courseCodes
                )
        );
    }

    return false;
}

function getCombinationCount(
    numberOfCourses,
    count
) {
    if (
        count < 0 ||
        count > numberOfCourses
    ) {
        return 0;
    }

    const smallerCount =
        Math.min(
            count,
            numberOfCourses - count
        );
    let result = 1;

    for (
        let i = 1;
        i <= smallerCount;
        i++
    ) {
        result *=
            (numberOfCourses - smallerCount + i) /
            i;
    }

    return result;
}

// Build replacement groups from coursesToSubstitute map.
function getReplacementGroups() {
    const replacementGroups = [];

    for (
        const [
            duplicatedCourseCode,
            numberOfSubstitutes
        ]
        of coursesToSubstitute
    ) {
        const duplicatedCourse =
            getCourseByCode(duplicatedCourseCode);

        if (!duplicatedCourse) {
            continue;
        }

        replacementGroups.push({
            duplicatedCourse,
            count: numberOfSubstitutes
        });
    }

    replacementGroups.sort(
        (a, b) =>
            a.count - b.count
    );

    return replacementGroups;
}

function getChooseNReplacementGroups() {
    return chooseNSubstitutions.map(
        substitution => ({
            duplicatedCourse: null,
            requirement: substitution.requirement,
            count: substitution.count
        })
    );
}

// Determine candidate courses that can substitute for a duplicated required course.
// - For double majors with <=2 total substitutes needed, electives are allowed
// - Otherwise only courses from selected majors/minors are considered
// - Filters out courses already selected and, for safety, courses below the duplicated course's level
function getAvailableReplacementCourses(
    duplicatedCourse,
    selectedCourses
) {
    const isDoubleMajor =
        state.selectedPathway === "doubleMajors";

    const totalSubstitutes =
        getNumberOfSubstitutesNeeded();

    const canUseElectives =
        isDoubleMajor &&
        totalSubstitutes <= 2;

    if (canUseElectives) {
        return getAvailableElectiveCourses(
            selectedCourses
        );
    }

    const courses =
        getCoursesFromSelectedMajorsAndMinors();

    return courses
        .filter(course => {
            if (selectedCourses.has(course.code)) {
                return false;
            }

            if (
                course.level <
                duplicatedCourse.level
            ) {
                return false;
            }

            return true;
        })
        .sort((a, b) => a.level - b.level);
}

function getAvailableChooseNReplacementCourses(
    group,
    selectedCourses
) {
    const isDoubleMajor =
        state.selectedPathway === "doubleMajors";

    const totalSubstitutes =
        getNumberOfSubstitutesNeeded();

    const totalChooseNSubstitutes =
        chooseNSubstitutions.reduce(
            (total, substitution) =>
                total + substitution.count,
            0
        );

    const totalSubstitutions =
        totalSubstitutes +
        totalChooseNSubstitutes;

    /*
     * Double majors can use up to two unrestricted electives
     * for substitutions.
     */
    if (
        isDoubleMajor &&
        totalSubstitutions <= 2
    ) {
        return getAvailableElectiveCourses(
            selectedCourses
        );
    }

    /*
     * Once the two double-major elective slots are exhausted,
     * replacements must come from courses offered by the
     * selected majors/minors.
     *
     * The replacement must be at least the level of the
     * ChooseN course(s) being replaced.
     */
    const minimumLevel =
        Math.min(
            ...group.requirement.Courses.map(
                course => course.level
            )
        );

    return getCoursesFromSelectedMajorsAndMinors()
        .filter(course => {

            if (
                selectedCourses.has(
                    course.code
                )
            ) {
                return false;
            }

            return (
                course.level >=
                minimumLevel
            );
        })
        .sort(
            (a, b) =>
                a.level - b.level
        );
}

// Total count of needed substitutes (sum of values in coursesToSubstitute)
function getNumberOfSubstitutesNeeded() {
    let total = 0;

    for (
        const numberOfSubstitutes
        of coursesToSubstitute.values()
    ) {
        total += numberOfSubstitutes;
    }

    return total;
}

function getAvailableElectiveCourses(selectedCourses) {
    return Object.values(coursesObject).filter(
        course => !selectedCourses.has(course.code)
    );
}

// Collect all courses that appear in the selected majors and minors
function getCoursesFromSelectedMajorsAndMinors() {
    const courses = new Map();

    const selectedPathway =
        pathways[state.selectedPathway];


    // Selected majors
    for (
        let i = 0;
        i < selectedPathway.numMajors;
        i++
    ) {
        const majorCode =
            state.selectedMajors[i];

        if (!majorCode) continue;

        const major =
            majorOptions[majorCode];

        if (!major) continue;

        addCoursesFromOption(
            major,
            courses
        );
    }


    // Selected minors
    for (
        let i = 0;
        i < selectedPathway.numMinors;
        i++
    ) {
        const minorCode =
            state.selectedMinors[i];

        if (!minorCode) continue;

        const minor =
            minorOptions[minorCode];

        if (!minor) continue;

        addCoursesFromOption(
            minor,
            courses
        );
    }


    return Array.from(courses.values());
}

function addCoursesFromOption(
    majorOrMinor,
    courses
) {
    for (
        const requirement
        of majorOrMinor.Requirements
    ) {
        for (
            const course
            of requirement.Courses
        ) {
            courses.set(
                course.code,
                course
            );
        }
    }
}

function getCourseByCode(courseCode) {
    return coursesObject[courseCode];
}

const FIXED_COURSE_PLACEMENTS = new Map([
    ["COMP500", { semester: 0, slot: 0 }],
    ["COMP501", { semester: 0, slot: 1 }],
    ["COMP508", { semester: 0, slot: 2 }],
    ["MATH503", { semester: 0, slot: 3 }],
    ["COMP507", { semester: 1, slot: 0 }],
    ["DIGD507", { semester: 1, slot: 1 }],
    ["COMP702", { semester: 4, slot: 0 }],
    ["COMP703", { semester: 5, slot: 0 }]
]);

/*
 * Schedule a course set as a constraint-satisfaction problem.
 *
 * Apart from the explicitly fixed core courses, a course is assigned to a
 * semester rather than a particular table slot because the remaining slots
 * in the same semester are interchangeable. The search uses domain
 * propagation, chooses the course with the fewest semester choices, and
 * backtracks immediately when a remaining course has no possible semester.
 *
 * All work is done against local data. state.coursePlan is updated only after
 * a complete valid schedule has been found.
 */
function scheduleCourses(selectedCourses) {
    const courses =
        new Map(selectedCourses);
    const semesterCount =
        state.coursePlan.length;
    const semesterCapacity =
        state.coursePlan[0].length;

    if (
        courses.size >
        semesterCount * semesterCapacity
    ) {
        return false;
    }

    const courseSetKey =
        Array.from(courses.keys())
            .sort()
            .join("|");

    if (scheduleCache.has(courseSetKey)) {
        const cachedAssignments =
            scheduleCache.get(courseSetKey);

        if (!cachedAssignments) {
            return false;
        }

        const cachedPlan =
            buildCoursePlan(
                courses,
                new Map(cachedAssignments),
                semesterCount,
                semesterCapacity
            );

        if (!cachedPlan) {
            return false;
        }

        commitCoursePlan(cachedPlan);
        return true;
    }

    const selectedCourseCodes =
        new Set(courses.keys());

    for (const course of courses.values()) {
        if (
            !prerequisiteTreeIsCovered(
                course.prerequisites,
                selectedCourseCodes
            )
        ) {
            scheduleCache.set(
                courseSetKey,
                null
            );
            return false;
        }
    }

    const domains =
        buildInitialSemesterDomains(
            courses,
            semesterCount
        );

    if (!domains) {
        scheduleCache.set(courseSetKey, null);
        return false;
    }

    const assignments = new Map();
    const semesterLoads =
        Array(semesterCount).fill(0);

    for (
        const [courseCode, placement]
        of FIXED_COURSE_PLACEMENTS
    ) {
        if (!courses.has(courseCode)) {
            continue;
        }

        assignments.set(
            courseCode,
            placement.semester
        );
        semesterLoads[
            placement.semester
        ]++;
    }

    const dependencyCounts =
        buildDependencyCounts(courses);
    const failedStates = new Set();

    const completedAssignments =
        searchSemesterAssignments(
            courses,
            domains,
            assignments,
            semesterLoads,
            semesterCapacity,
            dependencyCounts,
            failedStates
        );

    if (!completedAssignments) {
        scheduleCache.set(courseSetKey, null);
        return false;
    }

    const completedPlan =
        buildCoursePlan(
            courses,
            completedAssignments,
            semesterCount,
            semesterCapacity
        );

    if (!completedPlan) {
        scheduleCache.set(courseSetKey, null);
        return false;
    }

    scheduleCache.set(
        courseSetKey,
        Array.from(completedAssignments)
    );
    commitCoursePlan(completedPlan);
    return true;
}

function offeredThisSemester(course, semester) {
    const isSemester1 = semester % 2 === 0;

    if (isSemester1) return course.semester1Offered;
    return course.semester2Offered;
}

function buildInitialSemesterDomains(
    courses,
    semesterCount
) {
    const domains = new Map();

    for (const course of courses.values()) {
        const fixedPlacement =
            FIXED_COURSE_PLACEMENTS.get(
                course.code
            );

        if (fixedPlacement) {
            const fixedSemester =
                fixedPlacement.semester;

            if (
                fixedSemester >= semesterCount ||
                !offeredThisSemester(
                    course,
                    fixedSemester
                )
            ) {
                return null;
            }

            domains.set(
                course.code,
                [fixedSemester]
            );
            continue;
        }

        const possibleSemesters = [];

        for (
            let semester = 0;
            semester < semesterCount;
            semester++
        ) {
            if (
                offeredThisSemester(
                    course,
                    semester
                )
            ) {
                possibleSemesters.push(
                    semester
                );
            }
        }

        if (possibleSemesters.length === 0) {
            return null;
        }

        domains.set(
            course.code,
            possibleSemesters
        );
    }

    return domains;
}

function searchSemesterAssignments(
    courses,
    domains,
    assignments,
    semesterLoads,
    semesterCapacity,
    dependencyCounts,
    failedStates
) {
    const propagatedDomains =
        propagateSemesterDomains(
            courses,
            domains,
            assignments,
            semesterLoads,
            semesterCapacity
        );

    if (!propagatedDomains) {
        return null;
    }

    if (assignments.size === courses.size) {
        return assignmentsAreValid(
            courses,
            assignments
        )
            ? assignments
            : null;
    }

    const stateKey =
        getAssignmentStateKey(assignments);

    if (failedStates.has(stateKey)) {
        return null;
    }

    const courseCode =
        selectMostConstrainedCourse(
            courses,
            propagatedDomains,
            assignments,
            dependencyCounts
        );
    const semesters =
        orderSemesterChoices(
            courseCode,
            propagatedDomains,
            assignments,
            semesterLoads,
            semesterCapacity,
            dependencyCounts
        );

    for (const semester of semesters) {
        if (
            semesterLoads[semester] >=
            semesterCapacity
        ) {
            continue;
        }

        const nextAssignments =
            new Map(assignments);
        const nextDomains =
            cloneDomains(
                propagatedDomains
            );
        const nextSemesterLoads =
            [...semesterLoads];

        nextAssignments.set(
            courseCode,
            semester
        );
        nextDomains.set(
            courseCode,
            [semester]
        );
        nextSemesterLoads[semester]++;

        const result =
            searchSemesterAssignments(
                courses,
                nextDomains,
                nextAssignments,
                nextSemesterLoads,
                semesterCapacity,
                dependencyCounts,
                failedStates
            );

        if (result) {
            return result;
        }
    }

    failedStates.add(stateKey);
    return null;
}

function propagateSemesterDomains(
    courses,
    domains,
    assignments,
    semesterLoads,
    semesterCapacity
) {
    const propagatedDomains =
        cloneDomains(domains);
    let changed = true;

    while (changed) {
        changed = false;

        for (
            const [courseCode, course]
            of courses
        ) {
            if (assignments.has(courseCode)) {
                const semester =
                    assignments.get(courseCode);

                if (
                    !prerequisiteTreeCanBeSatisfied(
                        course.prerequisites,
                        semester,
                        assignments,
                        propagatedDomains
                    )
                ) {
                    return null;
                }

                continue;
            }

            const previousDomain =
                propagatedDomains.get(
                    courseCode
                );
            const nextDomain =
                previousDomain.filter(
                    semester =>
                        semesterLoads[semester] <
                            semesterCapacity &&
                        prerequisiteTreeCanBeSatisfied(
                            course.prerequisites,
                            semester,
                            assignments,
                            propagatedDomains
                        )
                );

            if (nextDomain.length === 0) {
                return null;
            }

            if (
                nextDomain.length !==
                previousDomain.length
            ) {
                propagatedDomains.set(
                    courseCode,
                    nextDomain
                );
                changed = true;
            }
        }

        for (const course of courses.values()) {
            const dependentDomain =
                propagatedDomains.get(
                    course.code
                );
            const result =
                restrictPrerequisiteDomains(
                    course.prerequisites,
                    dependentDomain,
                    assignments,
                    propagatedDomains
                );

            if (!result.valid) {
                return null;
            }

            if (result.changed) {
                changed = true;
            }
        }

        const capacityResult =
            propagateCapacityConstraints(
                propagatedDomains,
                assignments,
                semesterLoads,
                semesterCapacity
            );

        if (!capacityResult.valid) {
            return null;
        }

        if (capacityResult.changed) {
            changed = true;
        }
    }

    return propagatedDomains;
}

/*
 * Prerequisite checking normally narrows a dependent course from left to
 * right. This complementary pass also narrows prerequisite courses from
 * right to left. For example, because COMP702 is fixed in semester five, all
 * six of its mandatory prerequisites are immediately restricted to the
 * first four semesters.
 */
function restrictPrerequisiteDomains(
    node,
    dependentDomain,
    assignments,
    domains
) {
    if (!node) {
        return {
            valid: true,
            changed: false
        };
    }

    if (node.type === "COURSE") {
        if (assignments.has(node.value)) {
            const prerequisiteSemester =
                assignments.get(node.value);

            return {
                valid:
                    dependentDomain.some(
                        dependentSemester =>
                            prerequisiteSemester <
                            dependentSemester
                    ),
                changed: false
            };
        }

        const previousDomain =
            domains.get(node.value);

        if (!previousDomain) {
            return {
                valid: false,
                changed: false
            };
        }

        const nextDomain =
            previousDomain.filter(
                prerequisiteSemester =>
                    dependentDomain.some(
                        dependentSemester =>
                            prerequisiteSemester <
                            dependentSemester
                    )
            );

        if (nextDomain.length === 0) {
            return {
                valid: false,
                changed: false
            };
        }

        const changed =
            nextDomain.length !==
            previousDomain.length;

        if (changed) {
            domains.set(
                node.value,
                nextDomain
            );
        }

        return {
            valid: true,
            changed
        };
    }

    if (node.type === "AND") {
        let changed = false;

        for (const child of node.children) {
            const result =
                restrictPrerequisiteDomains(
                    child,
                    dependentDomain,
                    assignments,
                    domains
                );

            if (!result.valid) {
                return result;
            }

            if (result.changed) {
                changed = true;
            }
        }

        return {
            valid: true,
            changed
        };
    }

    if (node.type === "OR") {
        const viableChildren =
            node.children.filter(
                child =>
                    dependentDomain.some(
                        semester =>
                            prerequisiteTreeCanBeSatisfied(
                                child,
                                semester,
                                assignments,
                                domains
                            )
                    )
            );

        if (viableChildren.length === 0) {
            return {
                valid: false,
                changed: false
            };
        }

        /*
         * With multiple viable OR branches, restricting either individual
         * branch would discard valid solutions. Once only one branch remains,
         * it becomes mandatory and can safely be propagated.
         */
        if (viableChildren.length === 1) {
            return restrictPrerequisiteDomains(
                viableChildren[0],
                dependentDomain,
                assignments,
                domains
            );
        }

        return {
            valid: true,
            changed: false
        };
    }

    return {
        valid: false,
        changed: false
    };
}

/*
 * Check all 63 non-empty subsets of the six semesters. If more courses are
 * confined to a subset than the subset has free slots, the branch is
 * impossible. If the counts are equal, those slots are reserved and can be
 * removed from every other course's domain.
 */
function propagateCapacityConstraints(
    domains,
    assignments,
    semesterLoads,
    semesterCapacity
) {
    const semesterCount =
        semesterLoads.length;
    const finalMask =
        1 << semesterCount;
    let changed = false;

    for (
        let semesterMask = 1;
        semesterMask < finalMask;
        semesterMask++
    ) {
        let availableCapacity = 0;

        for (
            let semester = 0;
            semester < semesterCount;
            semester++
        ) {
            if (
                semesterMask &
                (1 << semester)
            ) {
                availableCapacity +=
                    semesterCapacity -
                    semesterLoads[semester];
            }
        }

        const confinedCourseCodes = [];

        for (
            const [courseCode, domain]
            of domains
        ) {
            if (assignments.has(courseCode)) {
                continue;
            }

            const isConfined =
                domain.every(
                    semester =>
                        semesterMask &
                        (1 << semester)
                );

            if (isConfined) {
                confinedCourseCodes.push(
                    courseCode
                );
            }
        }

        if (
            confinedCourseCodes.length >
            availableCapacity
        ) {
            return {
                valid: false,
                changed: false
            };
        }

        if (
            confinedCourseCodes.length !==
            availableCapacity
        ) {
            continue;
        }

        const confinedCourseCodeSet =
            new Set(confinedCourseCodes);

        for (
            const [courseCode, domain]
            of domains
        ) {
            if (
                assignments.has(courseCode) ||
                confinedCourseCodeSet.has(
                    courseCode
                )
            ) {
                continue;
            }

            const nextDomain =
                domain.filter(
                    semester =>
                        !(
                            semesterMask &
                            (1 << semester)
                        )
                );

            if (nextDomain.length === 0) {
                return {
                    valid: false,
                    changed: false
                };
            }

            if (
                nextDomain.length !==
                domain.length
            ) {
                domains.set(
                    courseCode,
                    nextDomain
                );
                changed = true;
            }
        }
    }

    return {
        valid: true,
        changed
    };
}

/*
 * Return whether a prerequisite expression can still be completed before the
 * proposed semester. For an unassigned prerequisite, at least one value in
 * its current domain must be earlier than the proposed semester.
 */
function prerequisiteTreeCanBeSatisfied(
    node,
    semester,
    assignments,
    domains
) {
    if (!node) {
        return true;
    }

    if (node.type === "COURSE") {
        if (assignments.has(node.value)) {
            return (
                assignments.get(node.value) <
                semester
            );
        }

        const prerequisiteDomain =
            domains.get(node.value);

        return Boolean(
            prerequisiteDomain &&
            prerequisiteDomain.some(
                prerequisiteSemester =>
                    prerequisiteSemester <
                    semester
            )
        );
    }

    if (node.type === "AND") {
        return node.children.every(
            child =>
                prerequisiteTreeCanBeSatisfied(
                    child,
                    semester,
                    assignments,
                    domains
                )
        );
    }

    if (node.type === "OR") {
        return node.children.some(
            child =>
                prerequisiteTreeCanBeSatisfied(
                    child,
                    semester,
                    assignments,
                    domains
                )
        );
    }

    return false;
}

function selectMostConstrainedCourse(
    courses,
    domains,
    assignments,
    dependencyCounts
) {
    const unassignedCourses =
        Array.from(courses.values())
            .filter(
                course =>
                    !assignments.has(
                        course.code
                    )
            );

    unassignedCourses.sort((a, b) => {
        const domainDifference =
            domains.get(a.code).length -
            domains.get(b.code).length;

        if (domainDifference !== 0) {
            return domainDifference;
        }

        const dependencyDifference =
            dependencyCounts.get(b.code) -
            dependencyCounts.get(a.code);

        if (dependencyDifference !== 0) {
            return dependencyDifference;
        }

        return a.level - b.level;
    });

    return unassignedCourses[0].code;
}

function orderSemesterChoices(
    courseCode,
    domains,
    assignments,
    semesterLoads,
    semesterCapacity,
    dependencyCounts
) {
    const semesters =
        [...domains.get(courseCode)];
    const hasDependents =
        dependencyCounts.get(courseCode) > 0;

    semesters.sort((a, b) => {
        const pressureDifference =
            getSemesterPressure(
                a,
                courseCode,
                domains,
                assignments,
                semesterLoads,
                semesterCapacity
            ) -
            getSemesterPressure(
                b,
                courseCode,
                domains,
                assignments,
                semesterLoads,
                semesterCapacity
            );

        if (pressureDifference !== 0) {
            return pressureDifference;
        }

        /*
         * Prerequisites are generally most useful early. Courses which are
         * not prerequisites for anything else are tried later first, keeping
         * early capacity available for prerequisite chains.
         */
        return hasDependents
            ? a - b
            : b - a;
    });

    return semesters;
}

function getSemesterPressure(
    semester,
    selectedCourseCode,
    domains,
    assignments,
    semesterLoads,
    semesterCapacity
) {
    let competingCourses = 0;

    for (
        const [courseCode, domain]
        of domains
    ) {
        if (
            courseCode === selectedCourseCode ||
            assignments.has(courseCode)
        ) {
            continue;
        }

        if (domain.includes(semester)) {
            competingCourses +=
                1 / domain.length;
        }
    }

    const remainingCapacity =
        semesterCapacity -
        semesterLoads[semester];

    return (
        competingCourses /
        remainingCapacity
    );
}

function buildDependencyCounts(courses) {
    const dependencyCounts =
        new Map(
            Array.from(courses.keys())
                .map(
                    courseCode =>
                        [courseCode, 0]
                )
        );

    for (const course of courses.values()) {
        const prerequisiteCodes =
            new Set();

        collectPrerequisiteCodes(
            course.prerequisites,
            prerequisiteCodes
        );

        for (
            const prerequisiteCode
            of prerequisiteCodes
        ) {
            if (
                dependencyCounts.has(
                    prerequisiteCode
                )
            ) {
                dependencyCounts.set(
                    prerequisiteCode,
                    dependencyCounts.get(
                        prerequisiteCode
                    ) + 1
                );
            }
        }
    }

    return dependencyCounts;
}

function collectPrerequisiteCodes(
    node,
    prerequisiteCodes
) {
    if (!node) {
        return;
    }

    if (node.type === "COURSE") {
        prerequisiteCodes.add(node.value);
        return;
    }

    for (const child of node.children) {
        collectPrerequisiteCodes(
            child,
            prerequisiteCodes
        );
    }
}

function assignmentsAreValid(
    courses,
    assignments
) {
    for (
        const [courseCode, semester]
        of assignments
    ) {
        const course =
            courses.get(courseCode);
        const completedCourses =
            getCompletedCoursesForSemester(
                assignments,
                semester
            );

        if (
            !offeredThisSemester(
                course,
                semester
            ) ||
            !evaluatePrerequisiteTree(
                course.prerequisites,
                completedCourses
            )
        ) {
            return false;
        }
    }

    return true;
}

function getCompletedCoursesForSemester(
    assignments,
    semester
) {
    const completedCourses = new Set();

    for (
        const [courseCode, completedSemester]
        of assignments
    ) {
        if (completedSemester < semester) {
            completedCourses.add(courseCode);
        }
    }

    return completedCourses;
}

function getAssignmentStateKey(assignments) {
    return Array.from(assignments)
        .sort(
            ([courseCodeA], [courseCodeB]) =>
                courseCodeA.localeCompare(
                    courseCodeB
                )
        )
        .map(
            ([courseCode, semester]) =>
                `${courseCode}:${semester}`
        )
        .join("|");
}

function cloneDomains(domains) {
    return new Map(
        Array.from(domains)
            .map(
                ([courseCode, semesters]) =>
                    [
                        courseCode,
                        [...semesters]
                    ]
            )
    );
}

function buildCoursePlan(
    courses,
    assignments,
    semesterCount,
    semesterCapacity
) {
    const coursePlan =
        Array.from(
            { length: semesterCount },
            () =>
                Array(
                    semesterCapacity
                ).fill(null)
        );

    // Insert fixed courses into their exact semester and slot positions.
    for (
        const [courseCode, placement]
        of FIXED_COURSE_PLACEMENTS
    ) {
        if (!assignments.has(courseCode)) {
            continue;
        }

        if (
            placement.semester >= semesterCount ||
            placement.slot >= semesterCapacity ||
            coursePlan[
                placement.semester
            ][placement.slot] !== null
        ) {
            return null;
        }

        coursePlan[
            placement.semester
        ][placement.slot] =
            courses.get(courseCode);
    }

    for (
        const [courseCode, semester]
        of assignments
    ) {
        if (
            FIXED_COURSE_PLACEMENTS.has(
                courseCode
            )
        ) {
            continue;
        }

        const availableSlot =
            coursePlan[semester]
                .findIndex(
                    course =>
                        course === null
                );

        if (availableSlot === -1) {
            return null;
        }

        coursePlan[semester][availableSlot] =
            courses.get(courseCode);
    }

    return coursePlan;
}

function commitCoursePlan(coursePlan) {
    for (
        let semester = 0;
        semester < coursePlan.length;
        semester++
    ) {
        for (
            let slot = 0;
            slot < coursePlan[semester].length;
            slot++
        ) {
            state.coursePlan[semester][slot] =
                coursePlan[semester][slot];
        }
    }
}


// Ensure pathway is selected and that the required number of majors/minors are chosen
function checkIfMajorsAndMinorsSelected() {
    // Check that state has a selected pathway.
    if (!state.selectedPathway) {
        alert("Please select a pathway before autopopulating the study plan.");
        return false;
    }
    const selectedPathway = pathways[state.selectedPathway];
    // Check that the enough majors are selected for the chosen pathway.
    const requiredMajorsCount = selectedPathway.numMajors;
    const selectedMajors = state.selectedMajors;
    const numSelectedMajors = selectedMajors.filter(major => major !== null).length;
    if (numSelectedMajors < requiredMajorsCount) {
        alert(`Please select at least ${requiredMajorsCount} major(s) for the chosen pathway.`);
        return false;
    }

    // Check that the enough minors are selected for the chosen pathway.
    const requiredMinorsCount = selectedPathway.numMinors;
    const selectedMinors = state.selectedMinors;
    const numSelectedMinors = selectedMinors.filter(minor => minor !== null).length;
    if (numSelectedMinors < requiredMinorsCount) {
        alert(`Please select at least ${requiredMinorsCount} minor(s) for the chosen pathway.`);
        return false;
    }
    return true;
}
