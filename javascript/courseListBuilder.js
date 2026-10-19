import { initDragAndDrop } from './dragAndDropController.js';
import { refreshStudyPlan } from './app.js';
import { state } from './state.js';

/**
 * Generates collapsible lists from instantiated Course objects
 * @param {Object} coursesMap - Object mapping course codes to Course instances
 */

/*
generateDynamicCourseList: Creates the list of courses that can be picked on the side based on the given majors and minors
Inputs: courses (object, key: courseCode string, value: Course object)
Outputs: N/A
*/
export function generateDynamicCourseList(courses) {

    const sidebar = document.getElementById('dynamic-course-sidebar');
    if (!sidebar) {
        console.warn("Element 'dynamic-course-sidebar' not found in HTML.");
        return;
    }

    sidebar.addEventListener('scroll' , () => {
        localStorage.setItem('scrollPos', sidebar.scrollTop)
    });

    // Saving which accordions are open in the sidebar so when its re-rendered youo doont lose your place
    const previouslyOpen = new Set(
    Array.from(sidebar.querySelectorAll("details[open]"))
        .map(d => d.querySelector("summary")?.textContent)
);

    // Clear old layout but retain container heading
    sidebar.innerHTML = '<h3>Available Courses for<br>Selected Pathway</h3>';

    // Creating a set of the courses present in the schedule so they can be deactivated in the sidebar
    const placedCourses = [];

    state.coursePlan.forEach(row => {
        row.forEach(cell => {
            if(cell && cell.code) {
                placedCourses.push(cell.code);
            }
        });
    });

    //Major minor storage as the only courses to be shown in the level based accordions should be in the selected major/minor
    const coreCourses = ["COMP500","COMP501","COMP508","MATH503","COMP507","DIGD507","COMP702","COMP703"]; //temporarily hard coded 
    const allowedCourses = [];
   
    state.selectedMajors.forEach(major => {
        if (major && major.Requirements) {
            major.Requirements.forEach(req => {
                req.Courses.forEach(courseObj => {
                    allowedCourses.push(courseObj.code);
                });
            });
        }
    });

    state.selectedMinors.forEach(minor => {
        if (minor && minor.Requirements) {
            minor.Requirements.forEach(req => {
                req.Courses.forEach(courseObj => {
                    allowedCourses.push(courseObj.code);
                });
            });
        }
    });
    coreCourses.forEach(code => allowedCourses.push(code));

    // Group the Course instances by their numeric level property
    const groupedByLevel = {};
    const electiveCourses = [];

    Object.values(courses).forEach(course => {
        //Currently as a placeholder ive just added all courses that are not present in the major/minor to the elective accordion
        if (!allowedCourses.includes(course.code)) {
            electiveCourses.push(course);
            return;
        }

        // Falls back to level 5 if level is missing or unmapped
        const level = course.level || 5; 
        
        if (!groupedByLevel[level]) {
            groupedByLevel[level] = [];
        }
        groupedByLevel[level].push(course);
    });

    // Sort academic levels numerically (Level 5, Level 6, Level 7)
    const sortedLevels = Object.keys(groupedByLevel).sort((a, b) => Number(a) - Number(b));

    // Render each level group
    sortedLevels.forEach((level, index) => {
        const details = document.createElement('details');
        details.className = 'course-category';
        

        const summary = document.createElement('summary');
        summary.textContent = `Level ${level} Courses`;
        details.appendChild(summary);

        if (previouslyOpen.has(summary.textContent)) {
            details.open = true;
        }

        const listWrapper = document.createElement('div');
        listWrapper.className = 'course-list';

        // Sort items inside this specific level alphabetically by code
        groupedByLevel[level].sort((a, b) => a.code.localeCompare(b.code));

        // Create the draggable DOM card for each Course object
        groupedByLevel[level].forEach(course => {
            const card = document.createElement('div');
            card.className = 'course-card';

            // If course coode is present in the schedule it will be greyed out and uninteractable in the side bar
            if(placedCourses.includes(course.code)) {
                card.classList.add("course-card-disabled");
                card.setAttribute('draggable', 'false');
                card.addEventListener("dragstart", e => e.preventDefault());
            } else {
            card.setAttribute('draggable', 'true');                 
            }
            
            // Set the uppercase course code attribute used by drag handlers
            card.setAttribute('data-code', course.code);
            
            // Display: "COMP500: PROGRAMMING CONCEPTS AND TECHNIQUES (15 pts)"
            card.textContent = `${course.code}: ${course.name} (${course.points} pts)`;
            
            listWrapper.appendChild(card);
        });

        details.appendChild(listWrapper);
        sidebar.appendChild(details);
    });

    //elective accordion
    if (electiveCourses.length > 0) {
        const details = document.createElement('details');
        details.className = 'course-category';

        const summary = document.createElement('summary');
        summary.textContent = "Electives";
        details.appendChild(summary);

        const listWrapper = document.createElement('div');
        listWrapper.className = 'course-list';

        electiveCourses.sort((a, b) => a.code.localeCompare(b.code));

        electiveCourses.forEach(course => {
            const card = document.createElement('div');
            card.className = 'course-card';

            if(placedCourses.includes(course.code)) {
                card.classList.add("course-card-disabled");
                card.setAttribute('draggable', 'false');
                card.addEventListener("dragstart", e => e.preventDefault());
            } else {
                card.setAttribute('draggable', 'true');                 
            } 

            card.setAttribute('data-code', course.code);
            card.textContent = `${course.code}: ${course.name} (${course.points} pts)`;
            listWrapper.appendChild(card);
        });

        details.appendChild(listWrapper);
        sidebar.appendChild(details);
    }

    restoreScrollPos()

    //rebind listeners
    initDragAndDrop(refreshStudyPlan);

}

/*
restoreScrollPos: Sets the scroll position of the list when it gets rebuilt
Inputs: N/A
Outputs: N/A
*/
function restoreScrollPos() {
    const savedPos = localStorage.getItem('scrollPos');
    const sidebar = document.getElementById('dynamic-course-sidebar');

    if (savedPos && sidebar) {
        sidebar.scrollTop = parseInt(savedPos, 10);
    }
}
