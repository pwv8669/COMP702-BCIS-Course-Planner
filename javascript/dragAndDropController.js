import { state } from './state.js';
import { courses } from './app.js';

// Tracking for drag origin
let sourceSemesterIndex = null;
let sourceSlotIndex = null;
let draggedCourseCode = null;

export function initDragAndDrop(onPlanChange) {

    // Sidebar course cards
    const courseCards = document.querySelectorAll('.course-card');
    courseCards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            const cardEl = e.currentTarget;

            draggedCourseCode = cardEl.getAttribute('data-code');
            e.dataTransfer.setData('text/plain', draggedCourseCode);

            sourceSemesterIndex = null;
            sourceSlotIndex = null;

            cardEl.style.opacity = '0.6';
        });

        card.addEventListener('dragend', (e) => {
            const cardEl = e.currentTarget;
            cardEl.style.opacity = '1.0';
        });
    });

    // populated schedule table cells are made draggable here and unpopulated ones lose their draggable attribute.  
    const tableCells = document.querySelectorAll('.schedule-table td');

    tableCells.forEach(cell => {
        const idParts = cell.id.split('-');
        if (idParts.length !== 3) return;

        const row = parseInt(idParts[1], 10);
        const col = parseInt(idParts[2], 10);

        const currentCourse = state.coursePlan[row][col];
        //if cell is populated with a course make it draggable otherwise ensure it is not draggable
        if (currentCourse) {
            cell.setAttribute('draggable', 'true');
            cell.style.cursor = 'grab';
        } else {
            cell.removeAttribute('draggable');
            cell.style.cursor = 'default';
        }

        //here event listeners are added to each cell
        cell.addEventListener('dragstart', (e) => {
            const courseObj = state.coursePlan[row][col];
            if (!courseObj) return;

            sourceSemesterIndex = row;
            sourceSlotIndex = col;
            draggedCourseCode = courseObj.code;

            e.dataTransfer.setData('text/plain', draggedCourseCode);
            cell.style.opacity = '0.4';
        });

        cell.addEventListener('dragend', () => {
            cell.style.opacity = '1.0';
        });

        cell.addEventListener('dragenter', (e) => {
            e.preventDefault();
            cell.classList.add('drag-over-cell');
        });

        cell.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        cell.addEventListener('dragleave', () => {
            cell.classList.remove('drag-over-cell');
        });

        cell.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            cell.classList.remove('drag-over-cell');

            if (!draggedCourseCode) return;

            const targetSemesterIndex = row;
            const targetSlotIndex = col;

            const draggedCourse = courses[draggedCourseCode];
            const existingDestinationCourse = state.coursePlan[targetSemesterIndex][targetSlotIndex];

            // dragging from a populated cell to another populated cell swaps them
            if (sourceSemesterIndex !== null && sourceSlotIndex !== null) {
                state.coursePlan[sourceSemesterIndex][sourceSlotIndex] = existingDestinationCourse || null;
            }

            
            state.coursePlan[targetSemesterIndex][targetSlotIndex] = draggedCourse;

            // Reset drag state
            sourceSemesterIndex = null;
            sourceSlotIndex = null;
            draggedCourseCode = null;

            // Re-rendering via callback (refreshStudyPlan)
            if (typeof onPlanChange === 'function') {
                await onPlanChange();
            }
        });
    });
}

//Function that ensures when a course is dropped onto the background the course is deleted from the schedule table
export function initGlobalDeleteZone(onDeleteCallback) {
    document.body.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    document.body.addEventListener('drop', async (e) => {
        if (sourceSemesterIndex !== null && sourceSlotIndex !== null) {
            e.preventDefault();

            state.coursePlan[sourceSemesterIndex][sourceSlotIndex] = null;

            sourceSemesterIndex = null;
            sourceSlotIndex = null;
            draggedCourseCode = null;

            if (typeof onDeleteCallback === 'function') {
                await onDeleteCallback();
            }
        }
    });
}

function mapCellToCoursePlan(row, col) {
    const semesterIndex = col + (row >= 2 ? 6 : 0); // bottom rows map to semesters 6–11
    const slotIndex = row % 2; // row 0 stays 0, row 1 stays 1, row 2 becomes 0, row 3 becomes 1

    return { semesterIndex, slotIndex };
    }


