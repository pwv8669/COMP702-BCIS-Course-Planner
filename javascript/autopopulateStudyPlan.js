import { placeCourse, PathwayRefresh, refreshStudyPlan } from './app.js';
import { state, Pathways } from './state.js';
import { loadPathways } from "./objects/pathway.js";
import { loadMajorOptions, loadMinorOptions } from "./objects/majorMinorOption.js";
import { evaluatePrerequisiteTree } from './prerequisiteValidator.js';
import { getCourseUsefulness } from './majorMinorRequirementsValidator.js';

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
    buildCourseList();
    scheduleCourses();
    refreshStudyPlan();
}

function buildCourseList() {
    
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