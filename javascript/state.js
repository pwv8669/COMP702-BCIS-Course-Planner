// Define the pathways available in the course planner.
export const Pathways = {
    doubleMajors: 'doubleMajors',
    doubleMinors: 'doubleMinors',
    electives: 'electives'
};

// Define the state of the application.
export const state = {
    // The course plan is a 2D array representing the courses selected for each semester (6 semesters, 4 courses per semester).
    coursePlan: [
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null]
    ],

    // The selected pathway (double majors, double minors, or electives).
    selectedPathway: null,
    // The selected majors, minors, and electives for the course plan.
    selectedMajors: [null, null],
    selectedMinors: [null, null],
    selectedElectives: [null, null, null, null]
};