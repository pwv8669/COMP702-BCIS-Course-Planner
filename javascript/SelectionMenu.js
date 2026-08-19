// Importing the state object from the state.js file which contains the coursePlan array. This allows us to manipulate the course plan data from this file globally.
import { state } from './state.js';



export async function SetupSelections()
{
	try{
		const coursesData = await fetch('json/courses.json', { cache: 'no-store' });//open file
		const courses = await coursesData.json();
		
		let text = "<select id=\"courseselectionedit\" onchange=\"setInput()\">"//this will be the 
		
		//selection menu, and will replace the empty coursetoedit <p>
		text += "<option>"+"</option>";//add a null option

		// For each course in courses, add an option to the selection menu with the course code as the display text and the index of the course in the courseobjects array as the value.
		let courseobjects = [];//this will be a temporary array of the course objects, which will be used to get the course data when the user selects a course from the selection menu.
		for (const code in courses)
		{
			courseobjectsstore.push(courses[code]);//push to the autofill array
			courseobjects.push(courses[code]);//add the course to the courseobjects array
			text += "<option value="+(courseobjects.length-1)+">" + courses[code].Code + "</option>";
		}
		text += "</select>"
		document.getElementById("coursetoedit").innerHTML = text;
	}
	catch{

	}
}


export async function SetupMajorMinorSelections()
{
	let majorminor = "";
	if(document.getElementById("MajorMinorSelection").value != undefined){
		majorminor = document.getElementById("MajorMinorSelection").value;
	}
	else{
		majorminor = "Major";
	}
	let optionsData  = await fetch('json/majors.json', { cache: 'no-store' });
	if(majorminor == "Minor"){
			optionsData = await fetch('json/minors.json', { cache: 'no-store' });//open file
	}
	const options = await optionsData.json();
	console.log(options);
	const optionarray = options;
	let text = "<select id=\"majorselectionedit\" onchange=\"setInput()\">"//this will be the 
	
	//selection menu, and will replace the empty coursetoedit <p>
	text += "<option>"+"</option>";//add a null option

	// For each course in courses, add an option to the selection menu with the course code as the display text and the index of the course in the courseobjects array as the value.
	let optionobjects = [];//this will be a temporary array of the course objects, which will be used to get the course data when the user selects a course from the selection menu.
			optionobjectsstore = [];
	for (const code in optionarray)
	{

		optionobjectsstore.push(optionarray[code]);//push to the autofill array
		optionobjects.push(optionarray[code]);//add the course to the courseobjects array
		text += "<option value="+(optionobjects.length-1)+">" + optionarray[code].Code + "</option>";
	}
 	text += "</select>"


	document.getElementById("majortoedit").innerHTML = text;

}

await SetupSelections();
await SetupMajorMinorSelections();
