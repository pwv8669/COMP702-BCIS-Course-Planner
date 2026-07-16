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
    satisfyChooseNRequirements(selectedCourses);
    //resolveOverlappingRequiredCourses(selectedCourses);
    console.log(selectedCourses)
    return selectedCourses;
}

// --- BuildCourseList() helper functions --- //
// Adds core courses to the selectedCourses.
function addCoreCourses(selectedCourses) {
    const core = majorOptions["Core"]
    if (!core) continue;

    for (const requirement of major.Requirements) {
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
function satisfyChooseNRequirements() {
    const selectedPathway = pathways[state.selectedPathway];
    // Process majors
    for (let i = 0; i < selectedPathway.numMajors; i++) {
        const majorCode = state.selectedMajors[i];
        if (!majorCode) continue;
        
        const major = majorOptions[majorCode];
        if (!major) continue; 

        processChooseNRequirements(major.Requirements, selectedCourses);
    }
    // Process minors
    for (let i = 0; i < selectedPathway.numMinors; i++) {
        const minorCode = state.selectedMinors[i];
        if (!minorCode) continue;
        
        const minor = minorOptions[minorCode];
        if (!minor) continue; 
        
        for (const requirement of minor.Requirements) {
            if (requirement.Type !== "Required") continue;
            
            processChooseNRequirements(major.Requirements, selectedCourses);
        }
    }
}

function processChooseNRequirements(requirements, selectedCourses) {
    for (const requirement of requirements) {
        if (requirement.Type !== "ChooseN") continue;

        const remainingOptions = requirement.Courses.filter(
            course => !selectedCourses.has(course.code)
        );

        remainingOptions.sort((a, b) =>
            getCourseUsefulness(a) - getCourseUsefulness(b)
        );

        const selected = availableCourses.slice(
            0,
            requirement.Count
        );
        
        for (const course of selected) {
            selectedCourses.set(course.code, course);
        }
    }
}
    
function resolveOverlappingRequiredCourses() {

}

function scheduleCourses() {
    
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
            break;
        }
    }
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