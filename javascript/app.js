// Importing the state object from the state.js file which contains the coursePlan array. This allows us to manipulate the course plan data from this file globally.
import { state } from './state.js';
import { loadCourses } from "./courseObjectConverter.js";
import { validateStudyPlan } from './planValidator.js';
import { renderCoursePlan } from './renderCoursePlan.js';
import { updatePathwayOptions } from './pathwayManager.js';
import { initPathwayOptions } from './pathwayManager.js';
import './templatesController.js';
import './autopopulateStudyPlan.js';
import { errorDisplay } from './errorDisplay.js';
import { generateDynamicCourseList } from './courseListBuilder.js';
import { initDragAndDrop, initGlobalDeleteZone } from './dragAndDropController.js';
import { initPartTime } from './partTimeScheduleHandler.js';

export let courses = {};
async function init() {

    if (document.readyState === "loading") {
        await new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve));
    }

	courses = await loadCourses();
	console.log(courses);

	document.getElementById('factoryResetButton')?.addEventListener('click', factoryReset);

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
	await initPathwayOptions();
	initPartTime();
}

async function factoryReset() {
	if (!window.confirm('Restore all course-planner data to the factory defaults?')) {
		return;
	}

	try {
		const response = await fetch('./php/factory_reset.php', {
			method: 'POST'
		});
		const result = await response.json();

		if (!response.ok || !result.success) {
			throw new Error(result.error || 'Factory reset failed.');
		}

		window.alert(result.message);
		window.location.reload();
	} catch (error) {
		window.alert(error.message);
	}
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
    generateDynamicCourseList(courses);
    initDragAndDrop(refreshStudyPlan);

}

// This function fetches the available majors and minors from the json files and populates the majorsArray and minorsArray with the data. It then calls the updatePathwayOptions function to update the dropdown options in the HTML form based on the selected pathway.

await init();
