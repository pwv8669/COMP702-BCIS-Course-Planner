import { getCoursesFromSelectedMajorsAndMinors } from './autopopulateStudyPlan.js';
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



export async function renderCoursePlan(state) {
    for (let row = 0; row < state.coursePlan.length; row++) {
        for (let col = 0; col < state.coursePlan[row].length; col++) {

            const cell = document.getElementById(`cell-${row}-${col}`);
            if (!cell) continue;

            const course = state.coursePlan[row][col];

            if (!course) {
                cell.textContent = "";
                continue;
            }
            const prereqText = parsePrereqs(course.prerequisites);
            
             if(await TypeOfCell(course.code)){
                
                cell.innerHTML = `
                <div class="course-cell"> Required`;
            }
            else{
                cell.innerHTML = `<div class="course-cell">
                `;
            }
            

            cell.innerHTML +=`<div class="course-name">${course.code}: ${course.name}</div>

                    <button class="prereq-btn" data-html2canvas-ignore="true">
                        Show reqs
                    </button>

                    <div class="prereq-list" style="display:none;" data-html2canvas-ignore="true">
                        ${prereqText}
                    </div>
                </div>
            `;
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener("click", (e) => {
        if (!e.target.classList.contains("prereq-btn")) return;

        const box = e.target.nextElementSibling;
        const hidden = box.style.display === "none";

        box.style.display = hidden ? "block" : "none";
        e.target.textContent = hidden ? "Hide reqs" : "Show reqs";
    });
});



