// Define the pathways available in the course planner.
export const Pathways = {
    doubleMajors: 'doubleMajors',
    doubleMinors: 'doubleMinors',
    electives: 'electives'
};

// Define the state of the application.
export const state = {
    coursePlan: [
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null]
    ],

    selectedPathway: null
};