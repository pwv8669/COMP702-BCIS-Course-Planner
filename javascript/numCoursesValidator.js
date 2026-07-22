import { PlanError } from './objects/planError.js';
import { state } from './state.js';


export function validateNumberOfCourses()
{
	let coursePlan = state.coursePlan;
	let message = "";
	const numSemesters = coursePlan.length;
	let errors = [];

	let numCourses = 0;
	let positions = [
        [false, false, false, false],
        [false, false, false, false],
        [false, false, false, false],
        [false, false, false, false],
        [false, false, false, false],
        [false, false, false, false],
    ];

	function resetErrorProperties(){
		numCourses = 0;
		positions = [
	        [false, false, false, false],
    	    [false, false, false, false],
        	[false, false, false, false],
	        [false, false, false, false],
    	    [false, false, false, false],
        	[false, false, false, false],
	    ];
	}
	

	// Loop through the study plan to determine variable sums and positions 2d array.
	for (let semester = 0; semester < coursePlan.length; semester++){
		for (let slot = 0; slot < state.coursePlan[semester].length; slot++){
			if (coursePlan[semester][slot]) {
			    numCourses++;
				if (numCourses > 24){
					positions[semester][slot] = true;	
			    }
			}
		}
	}
	if (numCourses > 24) {
		message = `Warning: The study plan contains ${courses} courses while only 24 are required for graduation criteria`;
		let errorMsg = new PlanError(null, message);
		let id = `TooManyCourses-${courses}`;
		errorMsg.positions = positions;
		errors.push(errorMsg);
	}
	resetErrorProperties();


	for (let semester = 0; semester < coursePlan.length; semester++){
		for (let slot = 0; slot < state.coursePlan[semester].length; slot++){
			if (coursePlan[semester][slot]) {
			    numCourses++;
			} else {
				positions[semester][slot] = true;
			}
		}
	}
	if (numCourses < 24) {
		message = `Warning: The study plan only contains ${numCourses} courses.  A total of 24 courses is required for graduation criteria`;
		let errorMsg = new PlanError(null, message);
		errorMsg.positions = positions;
		errors.push(errorMsg);
	}
	resetErrorProperties();


	if (numSemesters > 6) {
		for (let semester = 0; semester < coursePlan.length; semester++){
			if (semester > 5){
				for (let slot = 0; slot < state.coursePlan[semester].length; slot++){
					positions[semester][slot] = true;
				}
			}
		}
		message = `Warning: The study plan contains ${semesters} semesters this means it will take more than 3 years to meet graduation criteria`;  
		let errorMsg = new PlanError(null, message);
		errorMsg.positions = positions;
		errors.push(errorMsg);
	}
	resetErrorProperties();
	
	
	for (let semester = 0; semester < coursePlan.length; semester++){
		for (let slot = 0; slot < state.coursePlan[semester].length; slot++){
			positions[semester][slot] = true;
			numCourses++;
		}
		numCourses = 0;
		if (numCourses > 4){
			message = `Warning: The study plan contains ${numCourses} courses in semester ${semester+1}. The reccomended number of courses per semester is 4`;
			let errorMsg = new PlanError(null, message);
			errorMsg.positions = positions;
			errors.push(errorMsg);
		}
	}
	resetErrorProperties();

	return errors;
}