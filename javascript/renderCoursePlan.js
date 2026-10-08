import { attributedCourses } from "./validation/majorMinorRequirementsValidator.js";
import { scheduleConfig, mapCoursePlanToDom } from "./state.js";
import { validateMajorMinorRequirements } from "./validation/majorMinorRequirementsValidator.js";

function formatAttribution(attribution) {//This formats the text given by the cell attribution so we can tidily display it.
    //Inputs:A cell's attributed text
    //Outputs:A string that formats it tidily
    return attribution
        .split(" & ")
        .map(optionCode =>
            optionCode.replace(/([A-Z])/g, ' $1').trim()
        )
        .join(" & ");
}

function parsePrereqs(node) {//This function exists to find the prerequisites of a given node
    //Inputs:A node
    //Outputs: A string that attempts to give the user a node's prerequisites
    //Do note that despite the name, it can also be used to find co-requisites
    if (!node) return "No prerequisites";//If theres nothing, return that information (used to be displayed, but now just shows no text instead)

    // COURSE node
    if (node.type === "COURSE") {
        return node.value || (node.course?.code ?? "Unknown course");
    }

    // AND / OR nodes
    if (node.type === "AND" || node.type === "OR") {

        const op = node.type.toLowerCase(); // "and" / "or"
        const children = Array.isArray(node.children) ? node.children : [];

        // Single child so no operator needed
        if (children.length === 1) {
            return parsePrereqs(children[0]);
        }

        // No children so fallback
        if (children.length === 0) {
            return node.value || "Unknown prerequisite";
        }

        // Parse children recursively
        const parsedChildren = children.map(child => parsePrereqs(child));

        // OR groups always have parentheses + "or"
        if (node.type === "OR") {
            return `(${parsedChildren.join(` ${op} `)})`;
        }

        // AND groups have commas + "and" before last item
        if (node.type === "AND") {
            if (parsedChildren.length === 2) {
             
                return `${parsedChildren[0]} and ${parsedChildren[1]}`;
            }

            // More than 2 items:
            // "A, B, C, and D"
            const last = parsedChildren.pop();
            return `${parsedChildren.join(", ")}, and ${last}`;
        }
    }

    return "Unknown prerequisite structure";
}


function TypeOfCell(coursecode, cell, state){//this is a function that sets the given cell's color and returns the given major/minor/reason its in the table
    //Inputs: Course Code, The cell associated with this course, the state for its arrays
    //Outputs: A modified class list of the given cell and a string cnotaining its attributed course.

    try{//we do a try function here as when the site initially opens, it places the core courses. This is called before the system
    //can even attribute them to anything so it will always create an error.
    //Unless the user is somehow able to add courses before the site even finishes loading,
    //this should be fine because it should be only doing
    //this for the initial core courses.
    cell.classList = ''//clear the list
    // Default to core while the page is starting and no pathway is selected.
    if (!state.selectedPathway) return "Core";

    if(attributedCourses.get(coursecode) == "Elective"){//if the courses has an attributed major/minor/core, we can assume its not an elective
        cell.classList = 'cell-elective';//else give it an elective color and label
        return "Elective";//return attributed text
    }
    const formattedAttribution = formatAttribution(
        attributedCourses.get(coursecode)
    );//Call function to get string showing course attribution
    if(formattedAttribution != "Core"){//If the attributed course isnt core
        if(state.selectedPathway.name != "Double Majors"){//If not taking double majors
            if(state.selectedMajors[0].Code == attributedCourses.get(coursecode)){//Check first major, if it matches the course
                cell.classList = 'cell-required';//add to class list (this one is the major color)
                 return formattedAttribution;//return attribution
            }
            for (let minor = 0; minor < state.selectedMinors.length; minor++) {//for loop for the extraordinarily unlikely futureproof of allowing 3 minors
                if(state.selectedMinors[minor] != null){//if unselected minor, skip it
                    if(state.selectedMinors[minor].Code == attributedCourses.get(coursecode)){//if minor is found
                        switch (minor){//check if it was the first or second minor
                            case 0://If it's the first minor
                                cell.classList = 'cell-required-minor';//add class list
                                break;
                            case 1://If it's the second instead
                                cell.classList = 'cell-required-minor-second';//add class list
                                break;
                        }
                        break;//stop looking if its added the class
                    }
                }
            }
            if(!(cell.classList.contains('cell-required-minor') || cell.classList.contains('cell-required-minor-second') )){
                //if a minor wasnt added we can assume its a major by process of elimination
                cell.classList = 'cell-required';//make it required class color
            }
        }
        else{//If the given pathway is double majors and its neither an elective or core, we can assume its a major
            if(state.selectedMajors[0].Code == attributedCourses.get(coursecode)){//Check first major, if it matches the course
                cell.classList = 'cell-required';//add to class list (this one is the major color)
            }
            else{
                cell.classList = 'cell-required-minor';//to differenciate between first and second major we give it a different color (uses the minor 1st color since its in the same spot as it)
            }
                            return formattedAttribution;//return attribution
        }
    }
    else{
        cell.classList = ''; //else make it the default color (core uses default green as of this time)
    }
    return formattedAttribution;//return the attributed course name e.g. the major/minor/core
}
catch{
    return "Core";//return core as a "just in case"
    //this should only be the case when the site is just starting and the core placements are in without
    //validatemajorminorrequirements working in time
}
}

export async function renderCoursePlan(state) {//this function assigns colors and text information for a given cell, as well as anything else inside (e.g. information buttons)
    //INPUT: State (holds all course, pathways major/minor information)
    //OUTPUT: Sets up the site display specifically for the table
    await validateMajorMinorRequirements();//this is called beforehand as it attributes the major and minor requirements for courses/cells
    for (let row = 0; row < scheduleConfig.semesters; row++) {//for loops to go through all cells
        for (let col = 0; col < scheduleConfig.slotsPerSemester; col++) {

        const { UIRow, UICol } = mapCoursePlanToDom( row, col );
            const cell = document.getElementById(`cell-${UIRow}-${UICol}`);//get cell from a given part of a table
            if (!cell) continue;

            const course = state.coursePlan[row][col];//get course from row and column

            if (!course) {//if no course, make it blank and reset it
                cell.textContent = "";
                cell.classList.remove(//remove all classlists that may influence its color
                    "cell-required",
                    "cell-elective",
                    "cell-red-error",
                    "cell-yellow-warning"
                    );
                //set it to the warning color
                cell.classList.add("cell-yellow-warning");
                continue;
            }
            const prereqText = parsePrereqs(course.prerequisites);//parse prereqs 
            const typecell = TypeOfCell(course.code, cell, state);
            const coreqText = parsePrereqs(course.corequisites);//get the corequisites, thankfull the prerequisites function serves just as well for corequisites
            const details = [typecell];

            if(prereqText != "No prerequisites"){//if there are prerequisites then add them to the string
                details.push(`Prerequisites: ${prereqText}`);
            }
            if(coreqText != "No prerequisites"){//if there are corequisites then add them to the string
                details.push(`Corequisites: ${coreqText}`);
            }

            cell.innerHTML = `<div class="course-cell">
                <div class="course-type">${typecell}</div>
                <div class="course-name">${course.code}: ${course.name}</div>
                <button class="prereq-btn" data-html2canvas-ignore="true">
                    <svg xmlns="http://www.w3.org/2000/svg" class="infoIcon" viewBox="0 0 24 24" aria-label="Course details">
                        <path d="M12,0A12,12,0,1,0,24,12,12.013,12.013,0,0,0,12,0Zm0,22A10,10,0,1,1,22,12,10.011,10.011,0,0,1,12,22Z"/><path d="M12,10H11a1,1,0,0,0,0,2h1v6a1,1,0,0,0,2,0V12A2,2,0,0,0,12,10Z"/><circle cx="12" cy="6.5" r="1.5"/>
                    </svg>
                </button>
                <div class="prereq-list" style="display:none;" data-html2canvas-ignore="true">
                    ${details.join("<br>")}
                </div>
            </div>`;
        }
    }
}


    document.addEventListener("click", (e) => {//Show the course details when its info button is clicked.
        const button = e.target.closest(".prereq-btn");
        if (!button) return;

        const box = button.nextElementSibling;
        if (!box || !box.classList.contains("prereq-list")) return;
        const hidden = box.style.display === "none";

        box.style.display = hidden ? "block" : "none";
    });




