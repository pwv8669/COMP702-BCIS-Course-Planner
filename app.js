// Importing the state object from the state.js file which contains the coursePlan array. This allows us to manipulate the course plan data from this file globally.
import { state } from './javascript/state.js';

// Function to place a course in the course plan at a specific row and column.
async function placeCourse(row, col, code) {
	const path = `json/courses/${code}.json`;
	// Get the corresponding json file and convert it to a javascript object.
	const courseData = await fetch(path);
	const course = await courseData.json();
	// Place the course code in the course plan at the specified row and column.
	state.coursePlan[row][col] = course.code;
	
}

// Example usage of the placeCourse function.
await placeCourse(0, 0, 'COMP500');
await placeCourse(0, 1, 'COMP501');
await placeCourse(0, 2, 'COMP508');
await placeCourse(0, 3, 'MATH503');
await placeCourse(1, 0, 'COMP507');
await placeCourse(1, 1, 'DIGD507');
await placeCourse(4, 0, 'COMP702');
await placeCourse(5, 0, 'COMP703');

console.log(state.coursePlan);

async function renderCoursePlan() {
	// Loop through the course plan and update the corresponding cells in the HTML table with the course codes.
	for (let row = 0; row < state.coursePlan.length; row++) {
		for (let col = 0; col < state.coursePlan[row].length; col++) {
			// Get the cell element by its id.
			const cell = document.getElementById(`cell-${row}-${col}`);
			// Get the course code from the course plan at the current row and column.
			const courseCode = state.coursePlan[row][col];
			if (courseCode) {
				// If there is a course code, fetch the course data and update the cell's text content with the course code and name.
				const path = `json/courses/${courseCode}.json`;
				const courseData = await fetch(path);
				const course = await courseData.json();
				cell.textContent = `${courseCode}: ${course.name}` || '';
			} else {
				// If there is no course code, clear the cell's text content.
				cell.textContent = '';
			}
		}
	}
}
await renderCoursePlan();


const coursearray = [];
const select = document.getElementById('groupSelect');
const container = document.getElementById('boxContainer');

async function initGroupSelect()
{
	const indexResource = await fetch('./json/courses/courses.json');
	const index = await indexResource.json();

	for (const group of index.files)
	{
		const fileResource = await fetch(`json/courses/${group}`);
		const fileData = await fileResource.json();
		coursearray.push(fileData);
		const newOption = document.createElement('option');
		newOption.value = group;
		newOption.textContent = fileData.name;
		select.appendChild(newOption);
	}

	// // Load first group by default
	// if(index.files.length > 0)
	// {
	// 	loadBoxGroup(index.files[0]);
	// 	console.log('loaded first group: '+index.files[0]);
	// }

	// // e is for event as i find out
	// select.addEventListener('change', (e) => {
	// 	loadBoxGroup(e.target.value);
	// });
	
}

initGroupSelect();
