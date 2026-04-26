// Importing the state object from the state.js file which contains the coursePlan array. This allows us to manipulate the course plan data from this file globally.
import { state } from './javascript/state.js';



async function SetupSelections()
{
	const indexResource = await fetch('./json/courses/index.json');//open file
	const index = await indexResource.json();
	
	let text = "<select id=\"courseselectionedit\" onchange=\"setInput()\">"//this will be the 
	
	//selection menu, and will replace the empty coursetoedit <p>
	text += "<option>"+"</option>";//add a null option

	for (const code of index.courses)
	{
		const fileResource = await fetch(`json/courses/${code}.json`);
		const fileData = await fileResource.json();
		courseobjects.push(fileData);
		text += "<option value="+(courseobjects.length-1)+">" + fileData.Code + "</option>";
	}
 	text += "</select>"


	document.getElementById("coursetoedit").innerHTML = text;
}

await SetupSelections();