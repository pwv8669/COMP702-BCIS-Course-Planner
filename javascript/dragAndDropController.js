import { state } from './state.js';
import { courses } from './app.js';

// Tracking for drag origin
let sourceSemesterIndex = null;
let sourceSlotIndex = null;
let draggedCourseCode = null;

export function initDragAndDrop(onPlanChange) {

    // 1. SIDEBAR DRAG SOURCES
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

    // 2. TABLE CELL DRAG SOURCES + DROP TARGETS
    const tableCells = document.querySelectorAll('.schedule-table td');

    tableCells.forEach(cell => {
        const idParts = cell.id.split('-');
        if (idParts.length !== 3) return;

        const row = parseInt(idParts[1], 10);
        const col = parseInt(idParts[2], 10);

        const currentCourse = state.coursePlan[row][col];

        if (currentCourse) {
            cell.setAttribute('draggable', 'true');
            cell.style.cursor = 'grab';
        } else {
            cell.removeAttribute('draggable');
            cell.style.cursor = 'default';
        }

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

            // CASE 1: Dragging from another cell -- swap
            if (sourceSemesterIndex !== null && sourceSlotIndex !== null) {
                state.coursePlan[sourceSemesterIndex][sourceSlotIndex] = existingDestinationCourse || null;
            }

            // CASE 2: Always place dragged course into target
            state.coursePlan[targetSemesterIndex][targetSlotIndex] = draggedCourse;

            // Reset drag state
            sourceSemesterIndex = null;
            sourceSlotIndex = null;
            draggedCourseCode = null;

            // Re-render via callback (wired to refreshStudyPlan)
            if (typeof onPlanChange === 'function') {
                await onPlanChange();
            }
        });
    });
}

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


