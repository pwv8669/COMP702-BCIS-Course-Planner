export async function renderCoursePlan(state) {
    // Loop through the course plan and update the corresponding cells in the HTML table with the course codes.
    for (let row = 0; row < state.coursePlan.length; row++) {
        for (let col = 0; col < state.coursePlan[row].length; col++) {
            // Get the cell element by its id.
            const cell = document.getElementById(`cell-${row}-${col}`);
            // Get the course code from the course plan at the current row and column.
            if (!cell) {
                console.warn(`Cell element 'cell-${row}-${col}' not found in the HTML table.`);
                continue; // Skip to the next cell safely
            }

            const course = state.coursePlan[row][col];
            if (course) {
                // If there is a course, update the cell's text content with the course code and name.
              //  cell.textContent = `${course.code}: ${course.name}` || '';
              let innertext = `${course.code}: ${course.name}<br><div class=hidden-element>Points:${course.points}</div>` || '';
              if(course.prerequisites != null){
                if(course.prerequisites.type != null){
                    if(course.prerequisites.type == 'AND'){
                         innertext += `<div class=hidden-element>Prerequisites:`;
                        console.log('AND');
                        for(let and = 0; and < course.prerequisites.children.length;and++){
                            if(course.prerequisites.children[and].value != null){
                                innertext += course.prerequisites.children[and].value;
                                innertext += " ";
                            }
                            if(and % 2 == 0){
                                innertext += '<br>';
                            }
                            
                        }
                        innertext += `</div>`;
                    }
                    else if(course.prerequisites.type == "COURSE"){
                        console.log('output' + course.prerequisites.value);
                        innertext += `<div class=hidden-element>Prerequisites:`;
                        innertext += course.prerequisites.value;
                        innertext += `</div>`;
                    }
                }
             
              }
              
              cell.innerHTML = innertext;
              //cell.innerHTML += `\nPrerequisites:${course.prerequisites.course.code}`
             
            } else {
                // If there is no course code, clear the cell's text content.
                cell.textContent = '';
            }
        }
    }
}