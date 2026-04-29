async function numCoursesValidator(coursePlan)
{
	let courses = 0;
	let semesters = 0;
	for (let i = 0; i < coursePlan.length; i++)
	{
		for (let j = 0; j < coursePlan[i].length; j++ )
		{
			if (coursePlan[i][j] != null) //checks how many courses are being taken per semester if the value is null -
			{                             //-in the coursePlan a course is not being taken in said semester
			   courses++;
			}
			
		}
		if (!coursePlan[i].every( value => value === null)) //checks if a semesters courses are all null if so the semester isnt being taken 
		{
		   semesters++;
		}
	}

    if (courses > 24)
	{
		return `Warning: The study plan contains ${courses} courses while only 24 are required for graduation criteria`;
	}
	else if (courses < 24)
	{
		return `Warning: The study plan only contains ${courses} courses.  A total of 24 courses is required for graduation criteria`;
	}

	else if (semesters > 6)
	{
		return `Warning: The study plan contains ${semesters} semesters this means it will take more than 3 years to meet graduation criteria`;  
	}
	else if ((courses / semesters) > 4)
	{
		return `Warning: The study plan contains more than 4 courses in a semester. The reccomended number of courses per semester is 4`;
	}
	else
	{
		return "";
	}
}

/*
const mockPlan = 
    [
        [{ Code: "MATH503" }, { Code: "COMP500" }, { Code: "COMP501" }, { Code: "COMP508" }],
        [{ Code: "COMP503" }, { Code: "COMP517" }, { Code: "COMP507" }, { Code: "DIGD507" }],
        [{ Code: "COMP610" }, { Code: "COMP615" }, { Code: "COMP604" }, { Code: "COMP603" }],
        [{ Code: "COMP611" }, { Code: "COMP612" }, { Code: "STAT603" }, { Code: "COMP602" }],
        [{ Code: "COMP702" }, { Code: "COMP717" }, { Code: "COMP613" }, { Code: "COMP721" }],
        [{ Code: "COMP703" }, { Code: "COMP719" }, { Code: "ENSE707" }, { Code: "COMP711" }]
    ];

	numCoursesValidator(mockPlan).then(message => {
    if (message === "") {
        console.log("Success: The plans number of courses and semesters are valid!");
    } else {
        console.log("Validation Result:", message);
    }
});
*/