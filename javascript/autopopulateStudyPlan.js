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

// Rigging event listener to button that triggers autopopulation
const button = document.getElementById('AutocompletePlanButton');
button.addEventListener('click', () => {
    console.log("Autopopulate Plan button clicked");
    // Call the function to autopopulate the study plan
    autocompleteStudyPlan();
});

// Entry point for autocompletion logic
function autocompleteStudyPlan() {
    // Checks that pathway and options have been selected, fails otherwise
    if (!checkIfMajorsAndMinorsSelected()) return;

    // Wipes the substitution list, as it should not contain leftover data.
    coursesToSubstitute.clear();

    // Builds a list of courses, if it could not build a valid study plan, it fails.
    const selectedCourses = buildCourseList();
    if (!selectedCourses) {
        alert("Unable to generate a valid study plan.");
        return;
    }

    refreshStudyPlan();
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
function tryChooseNRequirements(requirements, index, selectedCourses) {
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

    const combinations = getCombinations(
        availableCourses,
        requirement.Count
    );

    for (const combination of combinations) {

        // Add this ChooseN combination.
        for (const course of combination) {
            selectedCourses.set(
                course.code,
                course
            );
        }

        // Try to satisfy the next ChooseN requirement.
        if (
            tryChooseNRequirements(
                requirements,
                index + 1,
                selectedCourses
            )
        ) {
            return true;
        }

        // Backtrack.
        for (const course of combination) {
            selectedCourses.delete(course.code);
        }
    }

    return false;
}

// Generate all combinations of 'count' items from 'courses' array.
function getCombinations(courses, count) {
    const combinations = [];

    function buildCombination(startIndex, currentCombination) {
        if (currentCombination.length === count) {
            combinations.push([...currentCombination]);
            return;
        }

        for (let i = startIndex; i < courses.length; i++) {
            currentCombination.push(courses[i]);

            buildCombination(i + 1, currentCombination);

            currentCombination.pop();
        }
    }

    buildCombination(0, []);

    return combinations;
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
    const replacementGroups =
        getReplacementGroups();

    return tryReplacementGroups(
        replacementGroups,
        0,
        selectedCourses
    );
}

// Try each replacement group via backtracking similar to ChooseN handling.
function tryReplacementGroups(
    replacementGroups,
    index,
    selectedCourses
) {
    // All overlap replacements have been selected.
    if (index === replacementGroups.length) {
        return scheduleCourses(
            new Map(selectedCourses)
        );
    }

    const group =
        replacementGroups[index];

    const availableCourses =
        getAvailableReplacementCourses(
            group.duplicatedCourse,
            selectedCourses
        );

    const combinations =
        getCombinations(
            availableCourses,
            group.count
        );

    for (const combination of combinations) {

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
                replacementGroups,
                index + 1,
                selectedCourses
            )
        ) {
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

// Sets every entry in state.courseplan to null.
function clearCoursePlan() {
    for (let semester = 0; semester < state.coursePlan.length; semester++) {
        for (let slot = 0; slot < state.coursePlan[semester].length; slot++) {
            state.coursePlan[semester][slot] = null;
        }
    }
}

// Schedule selected courses into the state.coursePlan
// - Reserves COMP702 and COMP703 at fixed positions (hard-coded placements)
// - Sorts remaining courses by level and attempts to place them greedily
function scheduleCourses(selectedCourses) {
    clearCoursePlan();
    state.coursePlan[4][0] = selectedCourses.get("COMP702");
    state.coursePlan[5][0] = selectedCourses.get("COMP703");

    const coursesToPlace = Array.from(selectedCourses.values())
        .filter(course =>
            course.code !== "COMP702" &&
            course.code !== "COMP703"
        );
    coursesToPlace.sort((a, b) => a.level - b.level);

    const placedCourses = getPlacedCourses();
    return placeCourses(coursesToPlace, placedCourses);
}

// Read currently placed courses from state.coursePlan into a Map for quick lookup
function getPlacedCourses() {
    const placedCourses = new Map();
    for (let semester = 0; semester < state.coursePlan.length; semester++) {
        for (let slot = 0; slot < state.coursePlan[semester].length; slot++) {
            const course = state.coursePlan[semester][slot];
            if (!course) continue
            
            placedCourses.set(course.code, semester);
        }
    }
    return placedCourses;
}

// Greedy placement loop:
// - Iterate through coursesToPlace repeatedly and try to place any course that can be placed
// - If no course can be placed in a full pass, scheduling fails
function placeCourses(coursesToPlace, placedCourses) {
    while (coursesToPlace.length > 0) {
        let placedSomething = false;

        for (let i = 0; i < coursesToPlace.length; i++) {
            const course = coursesToPlace[i];
            let placed = false;
            
            for (let semester = 0; semester < state.coursePlan.length && !placed; semester++) {
                if (!canPlaceCourse(course, semester, placedCourses)) continue;

                for (let slot = 0; slot < state.coursePlan[semester].length; slot++) {
                    if (state.coursePlan[semester][slot] !== null) continue;
                    
                    placedCourses.set(course.code, semester);
                    state.coursePlan[semester][slot] = course;

                    coursesToPlace.splice(i, 1);
                    i--;

                    placed = true;
                    placedSomething = true;
                    break;
                }
            }
        }

        if (!placedSomething) {
            console.warn("Unable to place remaining courses:", coursesToPlace);
            return false;
        }
    }
    return true;
}

// Check both offering and prerequisites before placing
function canPlaceCourse(course, semester, placedCourses) {
    return (
        offeredThisSemester(course, semester) &&
        prerequisitesMet(course, semester, placedCourses)
    );
}

// Check whether the given course is offered in the target semester
function offeredThisSemester(course, semester) {
    const isSemester1 = semester % 2 === 0;

    if (isSemester1) return course.semester1Offered;
    return course.semester2Offered;
}

// Evaluate prerequisites for 'course' using the evaluatePrerequisiteTree helper,
// where completedCourses contains course codes completed before 'semester'.
function prerequisitesMet(course, semester, placedCourses) {
    const completedCourses = getCompletedCoursesForSemester(placedCourses, semester);
    return evaluatePrerequisiteTree(course.prerequisites, completedCourses);
}

// Build a Set of courses completed strictly before the provided semester
function getCompletedCoursesForSemester(placedCourses, semester) {
    const completedCourses = new Set();

    for (const [courseCode, completedSemester] of placedCourses) {
        if (completedSemester < semester) {
            completedCourses.add(courseCode);
        }
    }
    return completedCourses;
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