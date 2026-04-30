// Importing the state object from the state.js file which contains the coursePlan array. This allows us to manipulate the course plan data from this file globally.
import { state, Pathways } from './javascript/state.js';

// Function to place a course in the course plan at a specific row and column.
async function placeCourse(row, col, code) {
	const path = `json/courses.json`;
	// Get the corresponding json file and convert it to a javascript object.
	const coursesData = await fetch(path);
	const courses = await coursesData.json();
	const course = courses[code];
	console.log(course);
	// Place the course code in the course plan at the specified row and column.
	state.coursePlan[row][col] = course;
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

import { numCoursesValidator } from './javascript/numCoursesValidator.js';
console.log(numCoursesValidator());


async function renderCoursePlan() {
	// Loop through the course plan and update the corresponding cells in the HTML table with the course codes.
	for (let row = 0; row < state.coursePlan.length; row++) {
		for (let col = 0; col < state.coursePlan[row].length; col++) {
			// Get the cell element by its id.
			const cell = document.getElementById(`cell-${row}-${col}`);
			// Get the course code from the course plan at the current row and column.
			const course = state.coursePlan[row][col];
			if (course) {
				// If there is a course, update the cell's text content with the course code and name.
				cell.textContent = `${course.Code}: ${course.Name}` || '';
			} else {
				// If there is no course code, clear the cell's text content.
				cell.textContent = '';
			}
		}
	}
}
await renderCoursePlan();

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
	updatePathwayOptions();
});
state.selectedPathway = Pathways.doubleMajors; // Set default pathway to double majors.

// Arrays to hold the majors and minors options fetched from the json files. These will be used to populate the dropdowns in the HTML form for selecting majors and minors.
const majorsArray = [];
const minorsArray = [];

// This function fetches the available majors and minors from the json files and populates the majorsArray and minorsArray with the data. It then calls the updatePathwayOptions function to update the dropdown options in the HTML form based on the selected pathway.
async function initPathwayOptions()
{
	// Fetch the index.json file which contains the list of available majors and minors.
	const indexResource = await fetch('./json/pathways/options/index.json');
	const index = await indexResource.json();

	// Loop through the list of majors in the index.json file, and push the data into the majorsArray.
	for (const major of index.majors)
	{
		const fileResource = await fetch(`json/pathways/options/${major}.json`);
		const fileData = await fileResource.json();
		majorsArray.push(fileData);
	}

	// Loop through the list of minors in the index.json file, and push the data into the minorsArray.
	for (const minor of index.minors)
	{
		const fileResource = await fetch(`json/pathways/options/${minor}.json`);
		const fileData = await fileResource.json();
		minorsArray.push(fileData);
	}
	// After fetching the majors and minors data, call the updatePathwayOptions function to populate the dropdowns in the HTML form based on the selected pathway.
	updatePathwayOptions();
}
initPathwayOptions();

// This function creates the major dropdowns in the HTML form based on the selected pathway. If the selected pathway is double majors, it creates two major dropdowns. If the selected pathway is double minors or electives, it creates one major dropdown. It also adds event listeners to the dropdowns to handle changes and validate the selected options.
function createMajorDropdowns()
{
	// Major 1 is always present regardless of the pathway, so we create it first.
	// Create the major 1 select element.
	const major1Label = document.createElement('label');
	major1Label.textContent = 'Major 1: ';
	const major1 = document.createElement('select');
	major1.id = major1Label.id = 'major1';
	// Add an event listener to the major 1 select element to handle changes and validate the selected option.
	major1.addEventListener('change', (e) => {
		checkValidOptionChange(major1, 'major1', e.target.value);
	});
	pathwayOptionContainer.appendChild(major1Label);
	major1Label.appendChild(major1);
	// Populate the major 1 select element with options from the majorsArray.
	for (const option of majorsArray)
	{
		const newOption = document.createElement('option');
		newOption.value = option.code;
		newOption.textContent = option.name;
		major1.appendChild(newOption);
	}
	// Set the value of the major 1 select element to the currently selected major in the state, or '---' if no major is selected.
	major1.value = state.selectedMajors[0] || '---';

	// If the selected pathway is double majors, we create the major 2 select element as well.
	if (state.selectedPathway == Pathways.doubleMajors){
		// Create the major 2 select element.
		const major2Label = document.createElement('label');
		major2Label.textContent = 'Major 2: ';
		const major2 = document.createElement('select');
		major2.id = major2Label.id = 'major2';
		// Add an event listener to the major 2 select element to handle changes and validate the selected option.
		major2.addEventListener('change', (e) => {
			checkValidOptionChange(major2, 'major2', e.target.value);
		});
		// Append the major 2 select element to the pathway option container in the HTML form.
		pathwayOptionContainer.appendChild(major2Label);
		major2Label.appendChild(major2);
		// Populate the major 2 select element with options from the majorsArray.
		for (const option of majorsArray)
		{
			const newOption = document.createElement('option');
			newOption.value = option.code;
			newOption.textContent = option.name;
			major2.appendChild(newOption);
		}
		// Set the value of the major 2 select element to the currently selected major in the state, or '---' if no major is selected.
		major2.value = state.selectedMajors[1] || '---';
	}
}

// This function creates the minor dropdowns in the HTML form based on the selected pathway. If the selected pathway is double minors, it creates two minor dropdowns. If the selected pathway is electives, it creates one minor dropdown. It also adds event listeners to the dropdowns to handle changes and validate the selected options.
function createMinorDropdowns()
{
	// If the selected pathway is double minors or electives, we create the minor 1 select element.
	if (state.selectedPathway == Pathways.doubleMinors || state.selectedPathway == Pathways.electives)
	{
		// Create the minor 1 select element.
		const minor1Label = document.createElement('label');
		minor1Label.textContent = 'Minor 1: ';
		const minor1 = document.createElement('select');
		minor1.id = minor1Label.id = 'minor1';
		// Add an event listener to the minor 1 select element to handle changes and validate the selected option.
		minor1.addEventListener('change', (e) => {
			checkValidOptionChange(minor1, 'minor1', e.target.value);
		});
		// Append the minor 1 select element to the pathway option container in the HTML form.
		pathwayOptionContainer.appendChild(minor1Label);
		minor1Label.appendChild(minor1);
		// Populate the minor 1 select element with options from the minorsArray.
		for (const option of minorsArray)
		{
			const newOption = document.createElement('option');
			newOption.value = option.code;
			newOption.textContent = option.name;
			minor1.appendChild(newOption);
		}
		// Set the value of the minor 1 select element to the currently selected minor in the state, or '---' if no minor is selected.
		minor1.value = state.selectedMinors[0] || '---';
	}
	// If the selected pathway is double minors, we create the minor 2 select element as well.
	if (state.selectedPathway == Pathways.doubleMinors)
	{
		// Create the minor 2 select element.
		const minor2Label = document.createElement('label');
		minor2Label.textContent = 'Minor 2: ';
		const minor2 = document.createElement('select');
		minor2.id = minor2Label.id = 'minor2';
		// Add an event listener to the minor 2 select element to handle changes and validate the selected option.
		minor2.addEventListener('change', (e) => {
			checkValidOptionChange(minor2, 'minor2', e.target.value);
		});
		// Append the minor 2 select element to the pathway option container in the HTML form.
		pathwayOptionContainer.appendChild(minor2Label);
		minor2Label.appendChild(minor2);
		// Populate the minor 2 select element with options from the minorsArray.
		for (const option of minorsArray)
		{
			const newOption = document.createElement('option');
			newOption.value = option.code;
			newOption.textContent = option.name;
			minor2.appendChild(newOption);
		}	
		// Set the value of the minor 2 select element to the currently selected minor in the state, or '---' if no minor is selected.
		minor2.value = state.selectedMinors[1] || '---';
	}
}

// This function is a total mess. Focusing on function first though. -C
async function updatePathwayOptions()
{
	const pathwayOptionContainer = document.getElementById(`pathwayOptionContainer`);
	// Clear the container before adding new options.
	pathwayOptionContainer.innerHTML = ''; 

	// Log the current selected majors, minors, and electives for debugging purposes.
	console.log(`Majors Array: ${state.selectedMajors}`);
	console.log(`Minors Array: ${state.selectedMinors}`);
	console.log(`Electives Array: ${state.selectedElectives}`);

	// Based on the selected pathway, create the appropriate dropdowns for majors, minors, and electives.
	createMajorDropdowns();
	createMinorDropdowns();

	// If the selected pathway does not match any of the defined pathways, log an error message to the console.
	if (state.selectedPathway != Pathways.doubleMajors && state.selectedPathway != Pathways.doubleMinors && state.selectedPathway != Pathways.electives)
	{
		console.log(`Could not update pathway options`);
	}
}


async function checkValidOptionChange(self, slot, target)
{
	applyOptionChange(slot, null);
	// Always allow unselection.
	if (target == '---')
	{
		console.log('Unselecting');
		return;
	}

	// Check if the selected option is already selected in another slot. If it is, alert the user and reset the select element to '---'.
	if (state.selectedMajors.includes(target) || state.selectedMinors.includes(target))
	{
		alert(`You cannot take the same major/minor twice.`);
		self.value = '---';
		return;
	}

	// Check if the selected option is Data Science or Artificial Intelligence, and if the other one is already selected in another slot. If it is, alert the user that they cannot be taken together and reset the select element to '---'.
	if 
	(
		(state.selectedMajors.includes('DataScience') || state.selectedMinors.includes('DataScience')) && target == 'ArtificialIntelligence'
		|| (state.selectedMinors.includes('ArtificialIntelligence') && target == 'DataScience')
	)
	{
		alert(`Data Science and Artificial Intelligence cannot be taken together.`);
		self.value = '---';
		return;
	}
	applyOptionChange(slot, target);

}

async function applyOptionChange(slot, target)
{
	switch (slot)
	{
		case 'major1':
			state.selectedMajors[0] = target;
			break;
		case 'major2':
			state.selectedMajors[1] = target;
			break;
		case 'minor1':
			state.selectedMinors[0] = target;
			break;
		case 'minor2':
			state.selectedMinors[1] = target;
			break;
		default:
			console.log('Invalid slot type');
			break;
	}
	console.log('Selected Majors: ' + state.selectedMajors);
	console.log('Selected Minors: ' + state.selectedMinors);
}