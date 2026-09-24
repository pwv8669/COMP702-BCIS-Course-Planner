import { validateStudyPlan } from './validation/planValidator.js';
import { loadPathways } from './objects/pathway.js';
import { loadMajorOptions, loadMinorOptions } from './objects/majorMinorOption.js';
import { state } from './state.js';

const pathways = await loadPathways();
const majorOptions = await loadMajorOptions();
const minorOptions = await loadMinorOptions();

// Arrays to hold the majors and minors options fetched from the json files. These will be used to populate the dropdowns in the HTML form for selecting majors and minors.
let majorsArray = [];
let minorsArray = [];

/* 
updatePathwayOptions: Updates the selected pathway in state and refreshes the dropdowns for major/minors based on the pathway.
Inputs: Pathway (object)
Outputs: N/A
*/ 
export function updatePathwayOptions(pathway) {
    if (pathway) {
        // If the user changed the selected pathway in the dropdown, change it in state.
        console.log(pathway);
        state.selectedPathway = pathways[pathway];
    }
    else {
        // If they didn't, no argument is passed, so the 'pathway' argument is undefined.
        console.log("Set selected pathway to Double Majors by default.");
        state.selectedPathway = pathways.doubleMajors;
    }
    
    // Update the selected pathway enum.
	console.log(`Selected pathway: ${state.selectedPathway.name}`);
	// Clear selections that are not used by the selected pathway.
	state.selectedMajors = state.selectedMajors.map((major, index) =>
		index < state.selectedPathway.numMajors ? major : null
	);
	state.selectedMinors = state.selectedMinors.map((minor, index) =>
		index < state.selectedPathway.numMinors ? minor : null
	);
	state.selectedElectives = state.selectedElectives.map((elective, index) =>
		index < state.selectedPathway.numElectives ? elective : null
	);

    const pathwayOptionContainer = document.getElementById(`pathwayOptionContainer`);
    // Clear the container before adding new options.
    pathwayOptionContainer.innerHTML = ''; 

    // Based on the selected pathway, create the appropriate dropdowns for majors, minors, and electives.
    createMajorDropdowns();
    createMinorDropdowns();

    // If the selected pathway does not match any of the defined pathways, log an error message to the console.
    if (state.selectedPathway != pathways.doubleMajors && state.selectedPathway != pathways.doubleMinors && state.selectedPathway != pathways.electives) {
        console.log(`Could not update pathway options because of invalid pathway selection: ${state.selectedPathway}`);
    }
}

// This function fetches the available majors and minors from the json files and populates the majorsArray and minorsArray with the data. It then calls the updatePathwayOptions function to update the dropdown options in the HTML form based on the selected pathway.
export async function initPathwayOptions()
{
    // Clear the majors and minors arrays before fetching new data.
    majorsArray = [];
    minorsArray = [];

	// Fetch the options.json file which contains the list of available majors and minors.
	const majorOptionsResource = await fetch('./json/majors.json');
    const minorOptionsResource = await fetch('./json/minors.json');
	const majorOptions = await majorOptionsResource.json();
	const minorOptions = await minorOptionsResource.json();

	// Populate the majorsArray and minorsArray with the data from the json files. We filter out the core options from the majors array since they are not selectable by the user.
	majorsArray = Object.values(majorOptions).filter(option => !option.IsCore);
    minorsArray = Object.values(minorOptions);
    // After fetching the majors and minors data, call the updatePathwayOptions function to populate the dropdowns in the HTML form based on the selected pathway.
    updatePathwayOptions();
}

/* 
createMajorDropdowns: Creates the number of major dropdowns required by the selected pathway.
Inputs: N/A
Outputs: N/A

This function also adds event listeners to the dropdowns to handle changes and validate the selected options.
*/ 
function createMajorDropdowns()
{
    // Return early if less than 1 major (this should never happen).
    if (state.selectedPathway.numMajors < 1) {
        return;
    }

    // Create the major 1 select element.
    const major1Label = document.createElement('label');
    major1Label.textContent = 'Major 1: ';
    const major1 = document.createElement('select');
   	major1.id = 'major1';
	major1Label.id = 'major1label';
    // Add an event listener to the major 1 select element to handle changes and validate the selected option.
    major1.addEventListener('change', (e) => {
        checkValidOptionChange(major1, 'major1', e.target.value);
    });
    pathwayOptionContainer.appendChild(major1Label);
    major1Label.appendChild(major1);
    // Populate the major 1 select element with options from the majorsArray.
    for (const option of majorsArray) {
        const newOption = document.createElement('option');
        newOption.value = option.Code;
        newOption.textContent = option.Name;
        major1.appendChild(newOption);
    }
    // Set the value of the major 1 select element to the currently selected major in the state, or '---' if no major is selected.
    addPlaceholderOption(major1);
    major1.value = state.selectedMajors[0]?.Code
        ?? state.selectedMajors[0]
        ?? "";

    // Create the second major dropdown when the selected pathway requires it.
    if (state.selectedPathway.numMajors >= 2) {
        // Create the major 2 select element.
        const major2Label = document.createElement('label');
        major2Label.textContent = 'Major 2: ';
        const major2 = document.createElement('select');
        	major2.id = 'major2'; 
		major2Label.id = 'major2label';
        // Add an event listener to the major 2 select element to handle changes and validate the selected option.
        major2.addEventListener('change', (e) => {
            checkValidOptionChange(major2, 'major2', e.target.value);
        });
        // Append the major 2 select element to the pathway option container in the HTML form.
        pathwayOptionContainer.appendChild(major2Label);
        major2Label.appendChild(major2);1
        // Populate the major 2 select element with options from the majorsArray.
        for (const option of majorsArray) {
            const newOption = document.createElement('option');
            newOption.value = option.Code;
            newOption.textContent = option.Name;
            major2.appendChild(newOption);
        }
        // Set the value of the major 2 select element to the currently selected major in the state, or '---' if no major is selected.
        addPlaceholderOption(major2);
        major2.value = state.selectedMajors[1]?.Code
            ?? state.selectedMajors[1]
            ?? "";
    }
}

/* 
createMinorDropdowns: Creates the number of minor dropdowns required by the selected pathway.
Inputs: N/A
Outputs: N/A

This function also adds event listeners to the dropdowns to handle changes and validate the selected options.
*/ 
function createMinorDropdowns()
{
    // Create the first minor dropdown when the selected pathway requires it.
    if (state.selectedPathway.numMinors >= 1) {
        // Create the minor 1 select element.
        const minor1Label = document.createElement('label');
        minor1Label.textContent = 'Minor 1: ';
        const minor1 = document.createElement('select');
        minor1.id  = 'minor1'; 
		minor1Label.id = 'minor1label';
        // Add an event listener to the minor 1 select element to handle changes and validate the selected option.
        minor1.addEventListener('change', (e) => {
            checkValidOptionChange(minor1, 'minor1', e.target.value);
        });
        // Append the minor 1 select element to the pathway option container in the HTML form.
        pathwayOptionContainer.appendChild(minor1Label);
        minor1Label.appendChild(minor1);
        // Populate the minor 1 select element with options from the minorsArray.
        for (const option of minorsArray) {
            const newOption = document.createElement('option');
            newOption.value = option.Code;
            newOption.textContent = option.Name;
            minor1.appendChild(newOption);
        }
        // Set the value of the minor 1 select element to the currently selected minor in the state, or '---' if no minor is selected.
        addPlaceholderOption(minor1);
        minor1.value = state.selectedMinors[0]?.Code
            ?? state.selectedMinors[0]
            ?? "";
    }
    // Create the second minor dropdown when the selected pathway requires it.
    if (state.selectedPathway.numMinors >= 2) {
        // Create the minor 2 select element.
        const minor2Label = document.createElement('label');
        minor2Label.textContent = 'Minor 2: ';
        const minor2 = document.createElement('select');
       minor2.id = 'minor2';
		 minor2Label.id = 'minor2label';
        // Add an event listener to the minor 2 select element to handle changes and validate the selected option.
        minor2.addEventListener('change', (e) => {
            checkValidOptionChange(minor2, 'minor2', e.target.value);
        });
        // Append the minor 2 select element to the pathway option container in the HTML form.
        pathwayOptionContainer.appendChild(minor2Label);
        minor2Label.appendChild(minor2);
        // Populate the minor 2 select element with options from the minorsArray.
        for (const option of minorsArray) {
            const newOption = document.createElement('option');
            newOption.value = option.Code;
            newOption.textContent = option.Name;
            minor2.appendChild(newOption);
        }	
        // Set the value of the minor 2 select element to the currently selected minor in the state, or '---' if no minor is selected.
        addPlaceholderOption(minor2);
        minor2.value = state.selectedMinors[1]?.Code
            ?? state.selectedMinors[1]
            ?? "";
    }
}

/* 
checkValidOptionChange: Checks if the option selected in the dropdown is valid.
Inputs: self (select element), slot (string), target (string)
Outputs: N/A

Inputs info:
Self is the select element that triggered the change event.
Slot is the slot being changed (major1, major2, minor1, minor2).
Target is the new option being selected in the dropdown.

Rules:
Always allows unselection.
Checks for duplicate selections (e.g taking the same major twice).
Checks for incompatible selections (e.g. taking Data Science major/minor and AI minor).
*/ 
async function checkValidOptionChange(self, slot, target)
{
    await applyOptionChange(slot, null);
    // Always allow unselection.
    if (target == "") {
        console.log('Unselecting');
        return;
    }

    // Compare the option code because selected majors/minors may be stored as objects.
    // The string fallback keeps selections imported from older templates compatible.
    const selectedCodes = [
        ...state.selectedMajors,
        ...state.selectedMinors
    ]
        .filter(Boolean)
        .map(option =>
            typeof option === 'string' ? option : option.Code
        );

    // Check if the selected option is already selected in another slot. If it is, alert the user and reset the select element to '---'.
    if (selectedCodes.includes(target)) {
        alert(`You cannot take the same major/minor twice.`);
        self.value = "";
        return;
    }

    const incompatibility = findIncompatibility(slot, target);
    if (incompatibility) {
        alert(`${incompatibility.selectedName} and ${incompatibility.existingName} cannot be taken together.`);
        self.value = "";
        return;
    }
    await applyOptionChange(slot, target);
    if(target != "") {
        let errors = validateStudyPlan();
    }
}

/* 
findIncompatibility: Checks if there are incompatibilities between the selected option and the existing selections in other slots.
Inputs: slot (string), target (string)
Outputs: N/A

Inputs info:
Slot is the slot being changed (major1, major2, minor1, minor2).
Target is the new option being selected in the dropdown.
*/ 
function findIncompatibility(slot, target)
{
    const selectingMajor = slot.startsWith('major');
    const selectedOption = (selectingMajor ? majorsArray : minorsArray)
        .find(option => option.Code === target);
    const existingOptions = [
    ...state.selectedMajors.map(option => ({
        code: typeof option === 'string' ? option : option?.Code,
        isMajor: true
    })),
    ...state.selectedMinors.map(option => ({
        code: typeof option === 'string' ? option : option?.Code,
        isMajor: false
    }))
    ].filter(option => option.code);

    for (const existing of existingOptions) {
        const existingOption = (existing.isMajor ? majorsArray : minorsArray)
            .find(option => option.Code === existing.code);
        const selectedIncompatibilities = selectingMajor
            ? getIncompatibleMajors(existingOption)
            : getIncompatibleMinors(existingOption);
        const existingIncompatibilities = existing.isMajor
            ? getIncompatibleMajors(selectedOption)
            : getIncompatibleMinors(selectedOption);

        if (selectedIncompatibilities.includes(target) || existingIncompatibilities.includes(existing.code)) {
            return {
                selectedName: selectedOption?.Name ?? target,
                existingName: existingOption?.Name ?? existing.code
            };
        }
    }

    return null;
}

/* 
getIncompatibleMajors & getIncompatibleMinors: Helper functions to retrieve the incompatible majors or minors for a given option.
Inputs: option (object)
Outputs: Array of incompatible options
*/ 
function getIncompatibleMajors(option)
{
    return option?.incompatibleMajors ?? option?.IncompatibleMajors ?? [];
}

function getIncompatibleMinors(option)
{
    return option?.incompatibleMinors ?? option?.IncompatibleMinors ?? [];
}

/* 
applyOptionChange: Helper function to update the state based on the selection for a given slot.
Inputs: slot (string), target (string)
Outputs: None
*/ 
async function applyOptionChange(slot, target)
{
    switch (slot) {
        case 'major1':
            state.selectedMajors[0] = majorOptions[target] ?? null;
            break;
        case 'major2':
            state.selectedMajors[1] = majorOptions[target] ?? null;
            break;
        case 'minor1':
            state.selectedMinors[0] = minorOptions[target] ?? null;
            break;
        case 'minor2':
            state.selectedMinors[1] = minorOptions[target] ?? null;
            break;
        default:
            console.log('Invalid slot type');
            break;
    }   
}

import { errorDisplay } from './errorDisplay.js';
import { refreshStudyPlan } from './app.js';

document.getElementById('pathwayOptionContainer')?.addEventListener('change', () => {
    setTimeout(() => {
        refreshStudyPlan();
        errorDisplay();
    }, 50); 
});

const originalUpdatePathwayOptions = updatePathwayOptions;
updatePathwayOptions = async function(pathway) {
    originalUpdatePathwayOptions(pathway);
    refreshStudyPlan();
};

// Helper function to add a placeholder option to a select element.
function addPlaceholderOption(selectElement) {
    const placeholder = document.createElement('option');
    placeholder.value = "";
    placeholder.textContent = "---";
    selectElement.appendChild(placeholder);
}
