import { placeCourse, PathwayRefresh, refreshStudyPlan } from './app.js';
import { state, Pathways } from './state.js';
import { loadPathways } from "./objects/pathway.js";
import { loadMajorOptions, loadMinorOptions } from "./objects/majorMinorOption.js";
import { getCompletedCourses, evaluatePrerequisiteTree } from './prerequisiteValidator.js';

const pathways = await loadPathways();
const majorOptions = await loadMajorOptions();
const minorOptions = await loadMinorOptions();
    
const button = document.getElementById('AutocompletePlanButton');

button.addEventListener('click', () => {
    console.log("Autopopulate Plan button clicked");
    // Call the function to autopopulate the study plan
    autocompleteStudyPlan();
    refreshStudyPlan();
});

function autocompleteStudyPlan() {
    if (!checkIfMajorsAndMinorsSelected()) return;
    const missingRequiredCourses = getMissingRequiredCourses();
}

function getMissingRequiredCourses() {
    const coursesToPlace = [];

    const placedCourses = new Map();
    for (let semester = 0; semester < state.coursePlan.length; semester++) {
        for (let slot = 0; slot < state.coursePlan[semester].length; slot++) {
            const course = state.coursePlan[semester][slot];
            if (!course) continue
            
            placedCourses.set(course.code, semester);
        }
    }
    console.log("Courses to place:");
    console.table(coursesToPlace.map(course => ({
        code: course.code,
        prerequisites: course.prerequisites
    })));

    const selectedPathway = pathways[state.selectedPathway];
    for (let i = 0; i < selectedPathway.numMajors; i++) {
        if (state.selectedMajors[i] && majorOptions[state.selectedMajors[i]]) {
            const major = majorOptions[state.selectedMajors[i]];
            for (const requirement of major.Requirements) {
                if (requirement.Type === "Required"){
                    for (const course of requirement.Courses) {
                        if (placedCourses.has(course.code)) continue; // TEMP NEED TO INSTEAD FIND REPLACEMENT COURSE.

                        coursesToPlace.push(course);
                    }
                }
            }
        }
    }
    for (let i = 0; i < selectedPathway.numMinors; i++) {
        if (state.selectedMinors[i]) {
            
        }
    }
    while (coursesToPlace.length > 0) {
        let placedSomething = false;

        for (let i = 0; i < coursesToPlace.length; i++) {
            const course = coursesToPlace[i];
            let placed = false;
            
            for (let semester = 0; semester < state.coursePlan.length && !placed; semester++) {
                console.log(`Trying ${course.code} in semester ${semester + 1}`);
                if (!canPlaceCourse(course, semester, placedCourses)) continue;
                if (!offeredThisSemester(course, semester)) {
                    console.log(`${course.code} not offered in semester ${semester + 1}`);
                    continue;
                }

                if (!prerequisitesMet(course, semester, placedCourses)) {
                    console.log(`${course.code} prerequisites not met in semester ${semester + 1}`);
                    continue;
                }

                for (let slot = 0; slot < state.coursePlan[semester].length; slot++) {
                    if (state.coursePlan[semester][slot] !== null) continue;

                    state.coursePlan[semester][slot] = course;
                    console.log(`Placed ${course.code} in semester ${semester + 1}`);
                    
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
    console.log(`Selected pathway: ${selectedPathway.name}`);
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