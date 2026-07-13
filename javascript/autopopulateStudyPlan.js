import { placeCourse, PathwayRefresh, refreshStudyPlan } from './app.js';
import { state, Pathways } from './state.js';
import { loadPathways } from "./objects/pathway.js";
import { loadMajorOptions, loadMinorOptions } from "./objects/majorMinorOption.js";

const pathways = await loadPathways();
const majorOptions = await loadMajorOptions();
const minorOptions = await loadMinorOptions();
    
const button = document.getElementById('AutocompletePlanButton');

button.addEventListener('click', () => {
    console.log("Autopopulate Plan button clicked");
    // Call the function to autopopulate the study plan
    autocompleteStudyPlan();
    refreshStudyPlan();
    console.log(state.coursePlan);
});

function autocompleteStudyPlan() {
    if (!checkIfMajorsAndMinorsSelected()) return;
    const missingRequiredCourses = getMissingRequiredCourses();
}

function getMissingRequiredCourses() {
    const courseSet = new Set();
    for (let semester = 0; semester < state.coursePlan.length; semester++) {
        for (let slot = 0; slot < state.coursePlan[semester].length; slot++) {
            if (state.coursePlan[semester][slot]) {
                const course = state.coursePlan[semester][slot];
                courseSet.add(course);
            }
        }
    }

    const selectedPathway = pathways[state.selectedPathway];
    for (let i = 0; i < selectedPathway.numMajors; i++) {
        if (state.selectedMajors[i] && majorOptions[state.selectedMajors[i]]) {
            const major = majorOptions[state.selectedMajors[i]];
            for (const requirement of major.Requirements) {
                if (requirement.Type === "Required"){
                    for (const course of requirement.Courses) {
                        if (courseSet.has(course)) continue;

                        let placed = false;
                        for (let semester = 0; semester < state.coursePlan.length && !placed; semester++) {
                            const isSem1 = semester % 2 === 0;
                            if (isSem1 && !course.semester1Offered) continue;
                            if (!isSem1 && !course.semester2Offered) continue;

                            for (let slot = 0; slot < state.coursePlan[semester].length; slot++) {
                            
                                if (state.coursePlan[semester][slot] === null) {
                                    state.coursePlan[semester][slot] = course;
                                    courseSet.add(course);
                                    placed = true;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    for (let i = 0; i < state.selectedPathway.numMinors; i++) {
        if (state.selectedMinors[i]) {
            
        }
    }
}

function canPlaceCourse(course, semester) {
    return (
        prereq
    )
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