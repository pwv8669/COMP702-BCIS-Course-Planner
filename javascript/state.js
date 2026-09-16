
export const scheduleConfig = {
    mode: "full-time",
    semesters: 6,
    slotsPerSemester: 4
};

export function buildCoursePlan() {
    const plan = Array.from(
        { length: scheduleConfig.semesters },
        () => Array(scheduleConfig.slotsPerSemester).fill(null)
    );
    return plan;
}
// Define the state of the application.
export const state = {
    /* The course plan is a dynamically generated array which represents the courses selected for each semester. 
    A full-time array consists of 6 semesters, with 4 courses per semester.
    A part-time array consists of 12 semesters, with 2 courses per semester.
    */
    coursePlan: buildCoursePlan(),

    // The selected pathway (double majors, double minors, or electives).
    selectedPathway: null,
    // The selected majors, minors, and electives for the course plan.
    selectedMajors: [null, null],
    selectedMinors: [null, null],
    selectedElectives: [null, null, null, null],
    //Ignored errors and corresponding notes storage
    ignoredErrors: {},
    mode: scheduleConfig.mode,

    attributedCourses: new Map(),
    totalPoints: null
};

export function setScheduleMode(mode) {
    if (mode === "part-time") {
        scheduleConfig.mode = "part-time";
        scheduleConfig.semesters = 12;
        scheduleConfig.slotsPerSemester = 2;
    } else {
        scheduleConfig.mode = "full-time";
        scheduleConfig.semesters = 6;
        scheduleConfig.slotsPerSemester = 4;
    }

    state.coursePlan = buildCoursePlan();
}

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
