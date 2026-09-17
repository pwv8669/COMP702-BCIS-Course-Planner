import { getCoursesFromSelectedMajorsAndMinors } from './autopopulateStudyPlan.js';
import { loadMajorOptions } from "./objects/majorMinorOption.js";
import { attributedCourses } from "./majorMinorRequirementsValidator.js";
import { scheduleConfig, mapCoursePlanToDom } from "./state.js";
import { validateMajorMinorRequirements } from "./majorMinorRequirementsValidator.js";

function formatAttribution(attribution) {
    return attribution
        .split(" & ")
        .map(optionCode =>
            optionCode.replace(/([A-Z])/g, ' $1').trim()
        )
        .join(" & ");
}

function parsePrereqs(node) {
    if (!node) return "No prerequisites";

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


async function TypeOfCell(coursecode, cell, state){
try{
    cell.classList = ''
    const majorOptions = await loadMajorOptions();
    //get the options from core
    let coreOptions = majorOptions["Core"];
    // console.log("TORETURN");
    // console.log(attributedCourses.get(coursecode));
    let arrayofcourses = (getCoursesFromSelectedMajorsAndMinors());//we kind of need this to "break" the try loop
    //when the website first loads so it defaults to core
    //when i fixed this system it instead started returning "Elective" which we dont want 
    if(attributedCourses.get(coursecode) == "Elective"){//if the courses has an attributed major/minor/core, we can assume its not an elective
        cell.classList = 'cell-elective';//else give it an elective color and label
        console.log("Elective given")
        return "Elective";
        
    }
    const formattedAttribution = formatAttribution(
        attributedCourses.get(coursecode)
    );
    if(formattedAttribution != "Core"){//if the attributed course isnt core
        if(state.selectedPathway.name != "Double Majors"){
            if(state.selectedMajors[0].Code == attributedCourses.get(coursecode)){//if major is found
                cell.classList = 'cell-required';//add class list
                 return formattedAttribution;
            }
            for (let minor = 0; minor < state.selectedMinors.length; minor++) {//for loop for the extraordinarily unlikely futureproof of allowing 3 minors
                if(state.selectedMinors[minor] != null){//if unselected minor, skip it
                    if(state.selectedMinors[minor].Code == attributedCourses.get(coursecode)){//if minor is found
                        cell.classList = 'cell-required-minor';//add class list
                        break;//stop looking
                    }
                }
            }
            if(!cell.classList.contains('cell-required-minor')){//if the min
                cell.classList = 'cell-required';//make it required class color
            }
        }
        else{
            cell.classList = 'cell-required';//make it required class color
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

export async function renderCoursePlan(state) {
    await validateMajorMinorRequirements();
    for (let row = 0; row < scheduleConfig.semesters; row++) {
        for (let col = 0; col < scheduleConfig.slotsPerSemester; col++) {

        const { UIRow, UICol } = mapCoursePlanToDom( row, col );
            const cell = document.getElementById(`cell-${UIRow}-${UICol}`);
            if (!cell) continue;

            const course = state.coursePlan[row][col];

            if (!course) {
                cell.textContent = "";
                cell.classList.remove(
                    "cell-required",
                    "cell-elective",
                    "cell-red-error",
                    "cell-yellow-warning"
                    );

                cell.classList.add("cell-yellow-warning");
                continue;
            }
            const prereqText = parsePrereqs(course.prerequisites);//parse prereqs 
            const typecell = await TypeOfCell(course.code, cell, state);
            
            cell.innerHTML = `<div class="course-cell">${typecell}:<div class="course-name">${course.code}: ${course.name}</div>`;//set the requirement level e.g. Elective, Core or Major/Minor name
            
            const coreqText = parsePrereqs(course.corequisites);

            if(prereqText != "No prerequisites" || coreqText != "No prerequisites" ){
                  cell.innerHTML += `<button class="prereq-btn" data-html2canvas-ignore="true">
                        Show reqs
                    </button>`
                    if(prereqText != "No prerequisites"){
                        cell.innerHTML +=`<div class="prereq-list" style="display:none;">
                            Prerequisites: ${prereqText}
                        </div>`;
                    }

                    if(coreqText != "No prerequisites"){
                        cell.innerHTML +=`<div class="prereq-list" style="display:none;">
                            Corequisites: ${coreqText}
                        </div>`;
                    }
                    
            }

                    cell.innerHTML +=`<div class="prereq-list" style="display:none;" data-html2canvas-ignore="true">
                        ${prereqText}
                    </div>
                </div>`;
            cell.innerHTML += `</div>`;
        }
    }
}


    document.addEventListener("click", (e) => {
        if (!e.target.classList.contains("prereq-btn")) return;

        const box = e.target.nextElementSibling;
        const hidden = box.style.display === "none";

        box.style.display = hidden ? "block" : "none";
        e.target.textContent = hidden ? "Hide reqs" : "Show reqs";
    });




