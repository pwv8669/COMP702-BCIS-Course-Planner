function init(){
    	const Button = document.getElementById("SaveFileButton");
	Button.addEventListener("click", SaveFile, false);
}

await init();
// Importing json files
import {placeCourse, PathwayRefresh} from "./app.js";
import { state, Pathways } from './javascript/state.js';
export function importschedule(JsonInput) {
		try{
	const arraytoparse = JsonInput.schedule;
 	for(let semester = 0; semester < arraytoparse.length; semester++){
        for(let course = 0; course < arraytoparse[semester].length; course++){
          placeCourse(semester, course, arraytoparse[semester][course]);
        }
    }

	const pathwaySelect = document.getElementById('pathwaySelect');
	pathwaySelect.value = JsonInput.selectedPathway;
	// Update the selected pathway enum.
	state.selectedPathway = JsonInput.selectedPathway;
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
	PathwayRefresh();
	state.selectedElectives = JsonInput.selectedElectives;
	state.selectedMajors = JsonInput.selectedMajors;
	state.selectedMinors = JsonInput.selectedMinors;
	const major1 = document.getElementById('major1');
	const major2 = document.getElementById('major2');
	const minor1 = document.getElementById('minor1');
	const minor2 = document.getElementById('minor2');
	

	console.log(major1);
	major1.value = state.selectedMajors[0];


	
	if(state.selectedPathway == Pathways.doubleMajors){
		major2.value = state.selectedMajors[1];
	}
	else{
		minor1.value = state.selectedMinors[0];
		if(state.selectedPathway == Pathways.doubleMinors){
			minor2.value = state.selectedMinors[1];
		}
	}
}
catch{
alert(`Incompatible File!`);
}
	console.log(state);
}




// Function for saving files
function SaveFile(){
	let text = "{\n";
	text += "\"selectedPathway\":\""+ state.selectedPathway+"\",\n";
	text += "\"selectedMajors\": [\""+ state.selectedMajors[0]+"\",\""+state.selectedMajors[1]+"\"],\n";
	text += "\"selectedMinors\": [\""+ state.selectedMinors[0]+"\",\""+state.selectedMinors[1]+"\"],\n";
	text += "\"selectedElectives\": [\""+ state.selectedElectives[0]+"\",\""+state.selectedElectives[1]+"\",\""+state.selectedElectives[2]+"\",\""+state.selectedElectives[3]+"\"],\n";
	text += "\"schedule\": [";
	for (let row = 0; row < state.coursePlan.length; row++) {
		text += "[";
		for (let col = 0; col < state.coursePlan[row].length; col++) {
			if(state.coursePlan[row][col] != undefined){
				console.log( state.coursePlan[row][col].Code);
				const course = state.coursePlan[row][col].Code;
				text += "\""+ course+"\"";

			}
			else{
				text += "\"undefined\"";
			}
			if(col < 3){
				text += ","
			}
		}
		text += "]"
		if(row < 5){
			text += ",\n"
		}
	}
	text += "]\n}";

	console.log(text);

    let blobdtMIME = new Blob([text], { type: "application/json" });
    let url = URL.createObjectURL(blobdtMIME);
    let anele = document.createElement("a");
    anele.setAttribute("download", "Schedule");
    anele.href = url;
    anele.click();
    console.log(blobdtMIME)
}

