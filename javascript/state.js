
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
    ignoredErrors: {}

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
