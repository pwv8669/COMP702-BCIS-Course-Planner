import { state } from './state.js';
import { courses } from './app.js';
import { scheduleConfig } from './state.js'

// Tracking for drag origin
let sourceSemesterIndex = null;
let sourceSlotIndex = null;
let draggedCourseCode = null;

export function mapDomToCoursePlan(domRow, domCol) {
    // Full-time: 6 semesters and 4 slots so direct mapping is fine
    if (scheduleConfig.mode !== 'part-time') {
        return {
            semesterIndex: domRow,
            slotIndex: domCol
        };
    }

    // Part-time: visually 6x4, logically 12x2
    //so we convert the row and cloumn numbers from the cell id into
    // cell-id rows 0-2 = coursePlan column 0, cell-id rows 1-3 = ccoursePlan column 1.
     
    let baseSemester;

    if (domCol > 1) {
        baseSemester  = domRow + 6;
    } else {
        baseSemester = domRow;
    }
    const semesterIndex = baseSemester;
    const slotIndex = domCol % 2;

    return { semesterIndex, slotIndex };
    }

    export function mapCoursePlanToDom(planRow, planCol) {
    // Full-time: 6 semesters and 4 slots so direct mapping is fine
    if (scheduleConfig.mode !== 'part-time') {
        return {
            UIRow: planRow,
            UICol: planCol
        };
    }

    let gridRow;
    let gridCol;

    if (planRow > 5) {
        gridRow  = planRow - 6;
        gridCol = planCol + 2;
    } else {
        gridRow = planRow;
        gridCol = planCol;
    }
    const UIRow = gridRow;
    const UICol = gridCol;

    return { UIRow, UICol };
    }

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
    const tableCells = document.querySelectorAll('.schedule-table td[id^="cell-"]');

    tableCells.forEach(cell => {
        if (!cell.id) {
            console.warn("Missing ID on cell:", cell);
            return;
        }
        const idParts = cell.id.split('-');
        if (idParts.length !== 3) return;

        const domRow = parseInt(idParts[1], 10);
        const domCol = parseInt(idParts[2], 10);

        const { semesterIndex, slotIndex } = mapDomToCoursePlan(domRow, domCol);

        if (!state.coursePlan[semesterIndex]) {
            console.error("coursePlan missing row:", semesterIndex, "cell:", cell);
            return;
        }

        const currentCourse = state.coursePlan[semesterIndex][slotIndex];
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
            const { semesterIndex: sIdx, slotIndex: slIdx } =
                mapDomToCoursePlan(
                    parseInt(idParts[1], 10),
                    parseInt(idParts[2], 10)
                );

            const courseObj = state.coursePlan[sIdx]?.[slIdx];
            if (!courseObj) return;

            sourceSemesterIndex = sIdx;
            sourceSlotIndex = slIdx;
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

            const { semesterIndex: targetSemesterIndex, slotIndex: targetSlotIndex } =
                mapDomToCoursePlan(
                    parseInt(idParts[1], 10),
                    parseInt(idParts[2], 10)
                );

            const draggedCourse = courses[draggedCourseCode];
            const existingDestinationCourse =
                state.coursePlan[targetSemesterIndex][targetSlotIndex];

            // If dragging from another cell, swap
            if (sourceSemesterIndex !== null && sourceSlotIndex !== null) {
                state.coursePlan[sourceSemesterIndex][sourceSlotIndex] =
                    existingDestinationCourse || null;
            }

            // Place dragged course in target cell
            state.coursePlan[targetSemesterIndex][targetSlotIndex] = draggedCourse;

            // Reset drag state
            sourceSemesterIndex = null;
            sourceSlotIndex = null;
            draggedCourseCode = null;

            // Re-render via callback (refreshStudyPlan)
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



