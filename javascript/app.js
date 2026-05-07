// Importing the state object from the state.js file which contains the coursePlan array. This allows us to manipulate the course plan data from this file globally.
import { state, Pathways } from './state.js';
import { loadCourses } from "./courseObjectConverter.js";

let courses = {};
async function init() {
	courses = await loadCourses();
	console.log(courses);

	// Example usage of the placeCourse function.
	placeCourse(0, 0, 'COMP500');
	placeCourse(0, 1, 'COMP501');
	placeCourse(0, 2, 'COMP508');
	placeCourse(0, 3, 'MATH503');
	placeCourse(1, 0, 'COMP507');
	placeCourse(1, 1, 'DIGD507');
	placeCourse(4, 0, 'COMP702');
	placeCourse(5, 0, 'COMP703');
	
	await renderCoursePlan(state);
	console.log(state.coursePlan);
}
init();


// Function to place a course in the course plan at a specific row and column.
export function placeCourse(row, col, code) {
	state.coursePlan[row][col] = courses[code];
}



import { numCoursesValidator } from './numCoursesValidator.js';
console.log(numCoursesValidator());

import { renderCoursePlan } from './renderCoursePlan.js';
await renderCoursePlan(state);

import { updatePathwayOptions } from './pathwayManager.js';
import { initPathwayOptions } from './pathwayManager.js';

// alter state.selectedPathway to the pathway in the html form.
const pathwaySelect = document.getElementById('pathwaySelect');
pathwaySelect.addEventListener('change', (e) => {
	// Update the selected pathway enum.
	state.selectedPathway = Pathways[e.target.value];
	console.log(`Selected pathway: ${state.selectedPathway}`);
	// Clear the unused selected majors, minors, and electives based on the selected pathway.
	if(state.selectedPathway == Pathways.doubleMajors){
		state.selectedMinors = [null, null];
		state.selectedElectives = [null, null, null, null];
	} else if (state.selectedPathway == Pathways.doubleMinors){
		state.selectedMajors[1] = null;
		state.selectedElectives = [null, null, null, null];
	} else if (state.selectedPathway == Pathways.electives){
		state.selectedMajors[1] = null;
		state.selectedMinors[1] = null;
	}
	updatePathwayOptions(state, Pathways);
});
state.selectedPathway = Pathways.doubleMajors; // Set default pathway to double majors.
export function PathwayRefresh(){
	updatePathwayOptions(state, Pathways);
}

// This function fetches the available majors and minors from the json files and populates the majorsArray and minorsArray with the data. It then calls the updatePathwayOptions function to update the dropdown options in the HTML form based on the selected pathway.

await initPathwayOptions(state, Pathways);

import { validateCourseAppearances } from './duplicateCoursesValidator.js';
validateCourseAppearances();