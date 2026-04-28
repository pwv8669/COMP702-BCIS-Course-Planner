async function prerequisiteValidator(coursePlan) 
{
    let completedCourses = []; //updated with courses every time a semester is looped through successfully
    for (let i = 0; i < coursePlan.length; i++) ////iterate through each semester
    {
        let semesterCourses = []; //updated with courses everytime a course is validated

        for (let j = 0; j < coursePlan[i].length; j++) //iterate through each course in each semester
        {
            let course = coursePlan[i][j]; //assuming the course plan array holds full courses with the relevant data
            if (!course) continue;

            //no prerequisites no problem just add the course code to the validated semester courses array
            if (!course.Prerequisites || course.Prerequisites.trim() === "") 
            {
                semesterCourses.push(course.Code);
                continue;
            }
            //ive decided to just parse the prereqs into straight logic to then be evaluated since it uses OR, AND, and ()
            let conjunctionsToLogic = course.Prerequisites.replace(/\bAND\b/gi, '&&').replace(/\bOR\b/gi, '||');
            //continuing on the earlier theme here im turning the course codes themselves into TRUE or FALSE
            //depending on if they are contained in "completedCourses"
            let coursesToLogic = conjunctionsToLogic.replace(/\b[A-Z]+\d+\b/gi, (match) => 
            {
                return completedCourses.includes(match);
            });

            try
            {
                //here a temporary function is made containing the boolean logic thats been created from the prerequisite line
                //it returns true or false based on the boolean logic if true it adds the current course to the semesterCourses array
                //if not it creates an error message explaing which prerequisites are missing and options if the prerequisites contain an OR statement
                const validPrereqs = new Function(`return ${coursesToLogic}`)();

                if (validPrereqs) 
                {
                    semesterCourses.push(course.Code);
                } 
                else 
                {
                    const prereqs = course.Prerequisites.match(/\b[A-Z]+\d+\b/gi) || [];
                    const missing = course.Prerequisites.match(/\b[A-Z]+\d+\b/gi).filter(code => !completedCourses.includes(code));

                    const neededReqs = missing.filter(code => 
                    {let whatIfLogic = conjunctionsToLogic.replace(/\b[A-Z]+\d+\b/gi, (m) => 
                    {
                        return completedCourses.includes(m) || m === code;
                    });
                        return new Function(`return ${whatIfLogic}`)();
                    });

                    return `Cannot take ${course.Code} in semester ${(i % 2) + 1} of year ${((i / 2) | 0) + 1}. You are missing prerequisites: ${neededReqs.join(' OR ')}.`;
                }
            }
            catch (err) 
            {
                console.error(`Logic error in Prerequisite string for ${course.Code}:`, err);
            }

        }

        completedCourses.push(...semesterCourses);
    }

    return "";
}

/* Testing code using dummy variables
const mockPlan = 
    [
        [{ Code: "MATH503", Prerequisites: "" }, null, null, null],
        [{ Code: "COMP612", Prerequisites: "MATH503 AND (COMP603 OR COMP610)" }, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null]
    ];

prerequisiteValidator(mockPlan).then(message => {
    if (message === "") {
        console.log("Success: The plan is valid!");
    } else {
        console.log("Validation Result:", message);
    }
});
*/


