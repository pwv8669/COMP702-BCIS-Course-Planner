import { placeCourse, PathwayRefresh, refreshStudyPlan } from './app.js';
import { state, Pathways } from './state.js';
import { loadPathways } from "./objects/pathway.js";

const pathways = await loadPathways();
    
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
    const selectedPathway = pathways[state.selectedPathway];
    console.log(`Selected pathway: ${selectedPathway.name}`);
    // Check that the enough majors are selected for the chosen pathway.
    const requiredMajorsCount = selectedPathway.numMajors;
    const selectedMajors = state.selectedMajors;
    const numSelectedMajors = selectedMajors.filter(major => major !== null).length;
    console.log(`Required majors: ${requiredMajorsCount}, Selected majors: ${numSelectedMajors}`);
    if (numSelectedMajors < requiredMajorsCount) {
        alert(`Please select at least ${requiredMajorsCount} major(s) for the chosen pathway.`);
        return;
    }
}
