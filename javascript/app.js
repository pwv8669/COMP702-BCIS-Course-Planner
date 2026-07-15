// Importing the state object from the state.js file which contains the coursePlan array. This allows us to manipulate the course plan data from this file globally.
import { state, Pathways } from './state.js';
import { loadCourses } from "./courseObjectConverter.js";
import { validateStudyPlan } from './planValidator.js';
import { renderCoursePlan } from './renderCoursePlan.js';
import { updatePathwayOptions } from './pathwayManager.js';
import { initPathwayOptions } from './pathwayManager.js';
import './templatesController.js';
import { errorDisplay } from './errorDisplay.js';
import { generateDynamicCourseList } from './courseListBuilder.js';
import { initDragAndDrop, initGlobalDeleteZone } from './dragAndDropController.js';

export let courses = {};
async function init() {

    if (document.readyState === "loading") {
        await new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve));
    }

	courses = await loadCourses();
	console.log(courses);

	generateDynamicCourseList(courses);
	// Example usage of the placeCourse function.
	placeCourse(0, 0, 'COMP500');
	placeCourse(0, 1, 'COMP501');
	placeCourse(0, 2, 'COMP508');
	placeCourse(0, 3, 'MATH503');

	placeCourse(1, 0, 'COMP507');
	placeCourse(1, 1, 'DIGD507');

	placeCourse(4, 0, 'COMP702');
	placeCourse(5, 0, 'COMP703');

	initGlobalDeleteZone(async () => {
	    await refreshStudyPlan();
	})
	
	await refreshStudyPlan();
	await initPathwayOptions(state, Pathways);
}


// Function to place a course in the course plan at a specific row and column.
export function placeCourse(row, col, code) {
	state.coursePlan[row][col] = courses[code];
}


// alter state.selectedPathway to the pathway in the html form.
const pathwaySelect = document.getElementById('pathwaySelect');
pathwaySelect.addEventListener('change', (e) => {
    updatePathwayOptions(e.target.value);
});

export function PathwayRefresh(pathway){
    updatePathwayOptions(pathway);
}

export async function refreshStudyPlan() {
    await renderCoursePlan(state);
    errorDisplay();
    initDragAndDrop(refreshStudyPlan);
}

// This function fetches the available majors and minors from the json files and populates the majorsArray and minorsArray with the data. It then calls the updatePathwayOptions function to update the dropdown options in the HTML form based on the selected pathway.

await init();
