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
    selectedElectives: [null, null, null, null],
    points: [null, null, null]
};

export async function updatePoints() 
{
    state.points = [0, 0, 0];
    for (const semester of state.coursePlan) // Each dimension of 2D array
    {
        for (const course of semester) // Each array
        {
            if (course != null)
            {
                switch (parseInt(course.Level))
                {
                    case 5:
                        state.points[0] += parseInt(course.Points);
                        break;
                    case 6:
                        state.points[1] += parseInt(course.Points);
                        break;
                    case 7:
                        state.points[2] += parseInt(course.Points);
                        break;
                    default:
                        console.log('Not a level 5, 6 or 7 course.');
                        break;
                }
            }
        }
    }
    const pointsDisplay = document.getElementById('pointsDisplay');
    pointsDisplay.innerHTML =
    `<p>Level 5: ${state.points[0]} - Level 6: ${state.points[1]} - Level 7: ${state.points[2]}<br>
    Total: ${state.points[0]+state.points[1]+state.points[2]}/360 </p>`;
    console.log('POINTS: '+state.points);
};

