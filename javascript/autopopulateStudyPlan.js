import { placeCourse, PathwayRefresh, refreshStudyPlan } from './app.js';
import { renderCoursePlan } from './renderCoursePlan.js';
import { state, Pathways } from './state.js';
import { initDragAndDrop } from './dragAndDropController.js';

    
const button = document.getElementById('AutocompletePlanButton');

button.addEventListener('click', () => {
    console.log("Autopopulate Plan button clicked");
    // Call the function to autopopulate the study plan
    autocompleteStudyPlan();
});

function autocompleteStudyPlan() {
    // Check that state has a selected pathway.
    if (!state.selectedPathway) {
        alert("Please select a pathway before autopopulating the study plan.");
        return;
    }
    // Check that the enough majors are selected for the chosen pathway.
    const selectedMajors = state.selectedMajors || [];
    const requiredMajorsCount = Pathways[state.selectedPathway].requiredMajors;
    console.log(`Selected majors: ${selectedMajors.length}, Required majors: ${requiredMajorsCount}`);
    if (selectedMajors.length < requiredMajorsCount) {
        alert(`Please select at least ${requiredMajorsCount} major(s) for the chosen pathway.`);
        return;
    }
}
