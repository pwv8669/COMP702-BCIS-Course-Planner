// Importing the state object from the state.js file which contains the coursePlan array. This allows us to manipulate the course plan data from this file globally.
import { state } from './state.js';
import { loadCourses } from "./objects/course.js";
import { validateStudyPlan } from './validation/planValidator.js';
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
// init: This function is called when the site/page initially opens and runs all the functions required to get it setup.
async function init() {

    if (document.readyState === "loading") {
        await new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve));
    }
	// load the courses and output it for debugging purposes.
	courses = await loadCourses();
	console.log(courses);
	// Add the factory reset button in case of issue
	document.getElementById('factoryResetButton')?.addEventListener('click', factoryReset);

	// Example usage of the placeCourse function.
	// This places the core courses when the user initially opens the page.
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
	// wait for the study plan to be refreshed/setup
	await refreshStudyPlan();
	// initialize the pathways the user may take
	await initPathwayOptions();
	// initialize part time button
	initPartTime();
}

// factoryReset: This is called when the factory reset button is clicked
async function factoryReset() {
	//confirm whether or not the user wants to factory reset
	if (!window.confirm('Restore all course-planner data to the factory defaults?')) {
		return;
	}

	//if so, attempt to reset the entries with the factory_reset.php file
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


// placeCourse: Function to place a course in the course plan at a specific row and column.
// Inputs: Takes in the row and column to put the inputted course in
// Outputs: Adjusts the state array to contain the course at the given position
export function placeCourse(row, col, code) {
	state.coursePlan[row][col] = courses[code];
}


// alter state.selectedPathway to the pathway in the html form.
const pathwaySelect = document.getElementById('pathwaySelect');
pathwaySelect.addEventListener('change', (e) => {
    updatePathwayOptions(e.target.value);
});

// PathwayRefresh: function for other js to use to refresh the pathway where needed
export function PathwayRefresh(pathway){
    updatePathwayOptions(pathway);
}

// refreshStudyPlan: this function effectively builds the studyplan from groundup in order to display it
export async function refreshStudyPlan() {
	await renderCoursePlan(state);//render the course plan
    errorDisplay();//set up the error display to check for any
    generateDynamicCourseList(courses);//generate a list of possible courses that may be picked based on user selection
    initDragAndDrop(refreshStudyPlan);//setup the drag and drop functionality

}

// This function fetches the available majors and minors from the json files and populates the majorsArray and minorsArray with the data. It then calls the updatePathwayOptions function to update the dropdown options in the HTML form based on the selected pathway.

await init();
