export async function renderCoursePlan(state) {
    // Loop through the course plan and update the corresponding cells in the HTML table with the course codes.
    for (let row = 0; row < state.coursePlan.length; row++) {
        for (let col = 0; col < state.coursePlan[row].length; col++) {
            // Get the cell element by its id.
            const cell = document.getElementById(`cell-${row}-${col}`);
            // Get the course code from the course plan at the current row and column.
            const course = state.coursePlan[row][col];
            if (course) {
                // If there is a course, update the cell's text content with the course code and name.
                cell.textContent = `${course.Code}: ${course.Name}` || '';
            } else {
                // If there is no course code, clear the cell's text content.
                cell.textContent = '';
            }
        }
    }
}