// Importing the state object from the state.js file which contains the coursePlan array. This allows us to manipulate the course plan data from this file globally.
import { state } from './javascript/state.js';



async function SetupSelections()
{
	const coursesData = await fetch('./json/courses.json');//open file
	const courses = await coursesData.json();
	
	let text = "<select id=\"courseselectionedit\" onchange=\"setInput()\">"//this will be the 
	
	//selection menu, and will replace the empty coursetoedit <p>
	text += "<option>"+"</option>";//add a null option

	// For each course in courses, add an option to the selection menu with the course code as the display text and the index of the course in the courseobjects array as the value.
	let courseobjects = [];//this will be an array of the course objects, which will be used to get the course data when the user selects a course from the selection menu.
	for (const code in courses)
	{
		courseobjects.push(courses[code]);//add the course to the courseobjects array
		text += "<option value="+(courseobjects.length-1)+">" + courses[code].Code + "</option>";
	}
 	text += "</select>"


	document.getElementById("coursetoedit").innerHTML = text;
}

await SetupSelections();