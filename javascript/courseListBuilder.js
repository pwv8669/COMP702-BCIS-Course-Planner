import { initDragAndDrop } from './dragAndDropController.js';
import { refreshStudyPlan } from './app.js';
/**
 * Generates collapsible lists from instantiated Course objects
 * @param {Object} coursesMap - Object mapping course codes to Course instances
 */
export function generateDynamicCourseList(coursesMap) {
    const sidebar = document.getElementById('dynamic-course-sidebar');
    if (!sidebar) {
        console.warn("Element 'dynamic-course-sidebar' not found in HTML.");
        return;
    }

    // Clear old layout but retain container heading
    sidebar.innerHTML = '<h3>Available Courses</h3>';

    // Group the Course instances by their numeric level property
    const groupedByLevel = {};
    const electiveCourses = [];

    Object.values(coursesMap).forEach(course => {
        //Currently as a placeholder ive just added all courses that have no prerequisites as electives
        if (!course.prerequisites) {
            electiveCourses.push(course);
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
        
        // expand the first level accordion panel
        if (index === 0) {
            details.open = true;
        }

        const summary = document.createElement('summary');
        summary.textContent = `Level ${level} Courses`;
        details.appendChild(summary);

        const listWrapper = document.createElement('div');
        listWrapper.className = 'course-list';

        // Sort items inside this specific level alphabetically by code
        groupedByLevel[level].sort((a, b) => a.code.localeCompare(b.code));

        // Create the draggable DOM card for each Course object
        groupedByLevel[level].forEach(course => {
            const card = document.createElement('div');
            card.className = 'course-card';
            card.setAttribute('draggable', 'true');
            
            // Set the uppercase course code attribute used by drag handlers
            card.setAttribute('data-code', course.code);
            
            // Display: "COMP500: PROOGRAMMING CONCEPTS AND TECHNIQUES (15 pts)"
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
            card.setAttribute('draggable', 'true');
            card.setAttribute('data-code', course.code);
            card.textContent = `${course.code}: ${course.name} (${course.points} pts)`;
            listWrapper.appendChild(card);
        });

        details.appendChild(listWrapper);
        sidebar.appendChild(details);
    }

    // Rebind event listeners
    initDragAndDrop(refreshStudyPlan);
}