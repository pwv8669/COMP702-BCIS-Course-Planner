import { placeCourse, PathwayRefresh, refreshStudyPlan } from './app.js';
import { state, Pathways } from './state.js';
import { loadPathways } from "./objects/pathway.js";
import { loadMajorOptions, loadMinorOptions } from "./objects/majorMinorOption.js";
import { evaluatePrerequisiteTree } from './prerequisiteValidator.js';

const pathways = await loadPathways();
const majorOptions = await loadMajorOptions();
const minorOptions = await loadMinorOptions();
    
const button = document.getElementById('AutocompletePlanButton');

const coursesToSubstitute = new Map();

button.addEventListener('click', () => {
    console.log("Autopopulate Plan button clicked");
    // Call the function to autopopulate the study plan
    autocompleteStudyPlan();
});

function autocompleteStudyPlan() {
    if (!checkIfMajorsAndMinorsSelected()) return;
    const selectedCourses = buildCourseList();
    scheduleCourses(selectedCourses);
    refreshStudyPlan();
}

function buildCourseList() {
    const selectedCourses = new Map();
    
    addCoreCourses(selectedCourses);
    addRequiredCourses(selectedCourses);
    
    const chooseNRequirements = getAllChooseNRequirements();
    if(!tryChooseNRequirements(
        chooseNRequirements,
        0,
        selectedCourses
    )) {
        alert("Unable to generate a valid study plan.");
        return null;
    }

    resolveOverlappingRequiredCourses(selectedCourses);
    console.log(selectedCourses)
    return selectedCourses;
}

// --- BuildCourseList() helper functions --- //
// Adds core courses to the selectedCourses.
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
                if (selectedCourses.has(course.code)) continue;
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
                if (selectedCourses.has(course.code)) continue;
                selectedCourses.set(course.code, course);
            }
        }
    }
}

// 
function tryChooseNRequirements(requirements, index, selectedCourses) {
    // Base case
    if (index === requirements.length) {
        return scheduleCourses(new Map(selectedCourses));
    }

    const requirement = requirements[index];

    const availableCourses = requirement.Courses.filter(
        course => !selectedCourses.has(course.code)
    );

    const combinations = getCombinations(
        availableCourses,
        requirement.Count
    );

    for (const combination of combinations) {

        // Add this combination
        for (const course of combination) {
            selectedCourses.set(course.code, course);
        }

        // Recurse to next requirement
        if (
            tryChooseNRequirements(
                requirements,
                index + 1,
                selectedCourses
            )
        ) {
            return true;
        }

        // Backtrack
        for (const course of combination) {
            selectedCourses.delete(course.code);
        }
    }

    return false;
}

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

function satisfyChooseNRequirements(selectedCourses) {
    const chooseNRequirements = getAllChooseNRequirements();

    // Prioritise requirements with fewer available choices.
    chooseNRequirements.sort((a, b) => {
        const availableA = getAvailableCourses(a, selectedCourses).length;
        const availableB = getAvailableCourses(b, selectedCourses).length;

        if (availableA !== availableB) {
            return availableA - availableB
        }

        return b.Count - a.Count
    });

    for (const requirement of chooseNRequirements) {
        const availableCourses = getAvailableCourses(requirement, selectedCourses);

        if(availableCourses.length < requirement.Count) {
            continue;
        }

        const selected = availableCourses.slice(0, requirement.Count);

        for (const course of selected) {
            selectedCourses.set(course.code, course);
        }
    }
}

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

function getAvailableCourses(requirement, selectedCourses) {
    return requirement.Courses.filter(
        course => !selectedCourses.has(course.code)
    );
}
    
function resolveOverlappingRequiredCourses(selectedCourses) {
    const selectedPathway = pathways[state.selectedPathway];
    const numSelectedCourses = selectedCourses.size;
    const maxCourses = 24;
    const missingCourses = maxCourses - numSelectedCourses;
    let maxElectives = 0;
    if (selectedPathway === pathways['doubleMajors']) {
        maxElectives = 2;
    } if (selectedPathway === pathways['electives']) {
        maxElectives = 4;
    }

    console.log(`There are ${numSelectedCourses} courses selected, the chosen pathway allows ${maxElectives} electives, meaning that ${missingCourses - maxElectives} courses from the Major/Minor(s) with overlapping must be selected, and they must be at the level of the overlapping required course.`);
}

function clearCoursePlan() {
    for (let semester = 0; semester < state.coursePlan.length; semester++) {
        for (let slot = 0; slot < state.coursePlan[semester].length; slot++) {
            state.coursePlan[semester][slot] = null;
        }
    }
}

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

function canPlaceCourse(course, semester, placedCourses) {
    return (
        offeredThisSemester(course, semester) &&
        prerequisitesMet(course, semester, placedCourses)
    );
}

function offeredThisSemester(course, semester) {
    const isSemester1 = semester % 2 === 0;

    if (isSemester1) return course.semester1Offered;
    return course.semester2Offered;
}

function prerequisitesMet(course, semester, placedCourses) {
    const completedCourses = getCompletedCoursesForSemester(placedCourses, semester);
    return evaluatePrerequisiteTree(course.prerequisites, completedCourses);
}

function getCompletedCoursesForSemester(placedCourses, semester) {
    const completedCourses = new Set();

    for (const [courseCode, completedSemester] of placedCourses) {
        if (completedSemester < semester) {
            completedCourses.add(courseCode);
        }
    }
    return completedCourses;
}

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