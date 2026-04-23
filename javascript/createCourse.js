// Requires the 'fs' module to work with the file system.
const fs = require('fs');

function createCourse(code, name, points, level, prerequisites = [], corequisites = [], semesters = [], core = false) {
    // Creates a course object with the provided parameters.
    const course = {
        code: code,
        name: name,
        points: points,
        level: level,
        prerequisites: prerequisites,
        corequisites: corequisites,
        semesters: semesters,
        core: core
    };
    
    // Convert to JSON (pretty formatted)
    const jsonData = JSON.stringify(course, null, 4);

    // Ensure folder exists
    const folder = "json/courses"; // root/json/courses
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    }

    // File name based on course code
    const fileName = `${code}.json`;

    // Write the JSON data to a file
    fs.writeFileSync(`${folder}/${fileName}`, jsonData);

    // Log a success message to the console.
    console.log(`Course ${code} created successfully!`);
}

/* 
// Example usage of the createCourse function to create a course with specific details.
createCourse(
    "TEST500",
    "Function Testing",
    15,
    5,
    ["COMP500"],
    [],
    [1, 2],
    true
);
*/