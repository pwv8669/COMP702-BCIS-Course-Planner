// Importing the state object from the state.js file which contains the coursePlan array. This allows us to manipulate the course plan data from this file globally.
import { state, Pathways } from './javascript/state.js';

// Function to place a course in the course plan at a specific row and column.
async function placeCourse(row, col, code) {
	const path = `json/courses/${code}.json`;
	// Get the corresponding json file and convert it to a javascript object.
	const courseData = await fetch(path);
	const course = await courseData.json();
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
	updatePathwayOptions();
});
state.selectedPathway = Pathways.doubleMajors; // Set default pathway to double majors.

// This function is a total mess. Focusing on function first though. -C
async function updatePathwayOptions()
{
	const pathwayOptionContainer = document.getElementById(`pathwayOptionContainer`);
	// Clear current options. Not ideal solution to reset when changing pathway option, but can be revisited later. -C
	pathwayOptionContainer.innerHTML = ''; 
	state.selectedMajors = [null, null];
	state.selectedMinors = [null, null];

	// Major 1
	const major1Label = document.createElement('label');
	major1Label.textContent = 'Major 1: ';
	const major1 = document.createElement('select');
	major1.id = major1Label.id = 'major1';

	major1.addEventListener('change', (e) => {
		checkValidOptionChange(major1, 'major1', e.target.value);
	});
	pathwayOptionContainer.appendChild(major1Label);
	major1Label.appendChild(major1);

	for (const option of majorsArray)
	{
		
		const newOption = document.createElement('option');
		newOption.value = option.code;
		newOption.textContent = option.name;
		major1.appendChild(newOption);
	}

	if (state.selectedPathway == Pathways.doubleMajors)
	{
		// Major 2
		const major2Label = document.createElement('label');
		major2Label.textContent = 'Major 2: ';
		const major2 = document.createElement('select');
		major2.id = major2Label.id = 'major2';

		major2.addEventListener('change', (e) => {
			checkValidOptionChange(major2, 'major2', e.target.value);
		});

		pathwayOptionContainer.appendChild(major2Label);
		major2Label.appendChild(major2);

		for (const option of majorsArray)
		{
			const newOption = document.createElement('option');
			newOption.value = option.code;
			newOption.textContent = option.name;
			major2.appendChild(newOption);
		}
	}
	else if (state.selectedPathway == Pathways.doubleMinors)
	{
		// Minor 1
		const minor1Label = document.createElement('label');
		minor1Label.textContent = 'Minor 1: ';
		const minor1 = document.createElement('select');
		minor1.id = minor1Label.id = 'minor1';

		minor1.addEventListener('change', (e) => {
			checkValidOptionChange(minor1, 'minor1', e.target.value);
		});

		pathwayOptionContainer.appendChild(minor1Label);
		minor1Label.appendChild(minor1);

		for (const option of minorsArray)
		{
			const newOption = document.createElement('option');
			newOption.value = option.code;
			newOption.textContent = option.name;
			minor1.appendChild(newOption);
		}

		// Minor 2
		const minor2Label = document.createElement('label');
		minor2Label.textContent = 'Minor 2: ';
		const minor2 = document.createElement('select');
		minor2.id = minor2Label.id = 'minor2';

		minor2.addEventListener('change', (e) => {
			checkValidOptionChange(minor2, 'minor2', e.target.value);
		});

		pathwayOptionContainer.appendChild(minor2Label);
		minor2Label.appendChild(minor2);

		for (const option of minorsArray)
		{
			const newOption = document.createElement('option');
			newOption.value = option.code;
			newOption.textContent = option.name;
			minor2.appendChild(newOption);
		}
	}
	else if (state.selectedPathway == Pathways.electives)
	{
		// Minor 1
		const minor1Label = document.createElement('label');
		minor1Label.textContent = 'Minor 1: ';
		const minor1 = document.createElement('select');
		minor1.id = minor1Label.id = 'minor1';

		minor1.addEventListener('change', (e) => {
			checkValidOptionChange(minor1, 'minor1', e.target.value);
		});

		pathwayOptionContainer.appendChild(minor1Label);
		minor1Label.appendChild(minor1);

		for (const option of minorsArray)
		{
			const newOption = document.createElement('option');
			newOption.value = option.code;
			newOption.textContent = option.name;
			minor1.appendChild(newOption);
		}
	}
	else
	{
		console.log(`Could not update pathway options`);
	}
}
async function checkValidOptionChange(self, slot, target)
{
	applyOptionChange(slot, null);
	// Always allow unselection
	if (target == '---')
	{
		console.log('Unselecting');
		return;
	}

	// No duplicates
	if (state.selectedMajors.includes(target) || state.selectedMinors.includes(target))
	{
		alert(`You cannot take the same major/minor twice.`);
		self.value = '---';
		return;
	}

	// Data Science with AI 
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
	console.log(state.selectedMajors);
	console.log(state.selectedMinors);

}
const coursearray = [];
const select = document.getElementById('groupSelect');
const container = document.getElementById('boxContainer');

async function initGroupSelect()
{
	const indexResource = await fetch('./json/courses/index.json');
	const index = await indexResource.json();

	for (const code of index.courses)
	{
		const fileResource = await fetch(`json/courses/${code}.json`);
		const fileData = await fileResource.json();
		coursearray.push(fileData);
		const newOption = document.createElement('option');
		newOption.value = code;
		newOption.textContent = fileData.Name;
		select.appendChild(newOption);
	}
	
}
initGroupSelect();

const majorsArray = [];
const minorsArray = [];
async function initPathwayOptions()
{
	const indexResource = await fetch('./json/pathways/options/index.json');
	const index = await indexResource.json();

	for (const major of index.majors)
	{
		const fileResource = await fetch(`json/pathways/options/${major}.json`);
		const fileData = await fileResource.json();
		majorsArray.push(fileData);
	}

	for (const minor of index.minors)
	{
		const fileResource = await fetch(`json/pathways/options/${minor}.json`);
		const fileData = await fileResource.json();
		minorsArray.push(fileData);
	}
	updatePathwayOptions();
}
initPathwayOptions();