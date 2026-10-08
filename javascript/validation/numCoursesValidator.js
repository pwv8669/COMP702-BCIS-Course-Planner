import { PlanError } from '../objects/planError.js';
import { state } from '../state.js';
import { scheduleConfig } from '../state.js'

export function validateNumberOfCourses()
{
	let coursePlan = state.coursePlan;
	let message = "";
	const numSemesters = scheduleConfig.semesters;
	let errors = [];

	let numCourses = 0;
	let positions = Array.from(
        { length: scheduleConfig.semesters },
        () => Array(scheduleConfig.slotsPerSemester).fill(false)
    );

	function resetErrorProperties(){
		numCourses = 0;
		positions = Array.from(
        { length: scheduleConfig.semesters },
        () => Array(scheduleConfig.slotsPerSemester).fill(false)
    );
	}
	

	// Loop through the study plan to determine variable sums and positions 2d array.
	for (let semester = 0; semester < scheduleConfig.semesters; semester++){
		for (let slot = 0; slot < scheduleConfig.slotsPerSemester; slot++){
			if (coursePlan[semester][slot]) {
			    numCourses++;
				if (numCourses > 24){
					positions[semester][slot] = true;	
			    }
			}
		}
	}
	if (numCourses > 24) {
		message = `Warning: The study plan contains ${numCourses} courses while only 24 are required for graduation criteria`;
		let id = `TooManyCourses-${numCourses}`;
		let errorMsg = new PlanError(null, message, id);
		errorMsg.positions = positions;
		errors.push(errorMsg);
	}
	resetErrorProperties();


	for (let semester = 0; semester < scheduleConfig.semesters; semester++){
		for (let slot = 0; slot < scheduleConfig.slotsPerSemester; slot++){
			if (coursePlan[semester][slot]) {
			    numCourses++;
			} else {
				positions[semester][slot] = true;
			}
		}
	}
	if (numCourses < 24) {
		message = `Warning: The study plan only contains ${numCourses} courses.  A total of 24 courses is required for graduation criteria`;
		let id = `TooFewCourses-${numCourses}`;
		let errorMsg = new PlanError(null, message, id);
		errorMsg.positions = positions;
		errors.push(errorMsg);
	}
	resetErrorProperties();


	if (scheduleConfig.mode === "full-time" && numSemesters > 6) {
		for (let semester = 0; semester < scheduleConfig.semesters; semester++){
			if (semester > 5){
				for (let slot = 0; slot < scheduleConfig.slotsPerSemester; slot++){
					positions[semester][slot] = true;
				}
			}
		}
		message = `Warning: The study plan contains ${numSemesters} semesters this means it will take more than 3 years to meet graduation criteria`;  
		let id = `TooManySemesters-${numSemesters}`;
		let errorMsg = new PlanError(null, message, id);
		errorMsg.positions = positions;
		errors.push(errorMsg);
	}
	resetErrorProperties();
	
	
	for (let semester = 0; semester < scheduleConfig.semesters; semester++){
	    let count = 0;

		for (let slot = 0; slot < scheduleConfig.slotsPerSemester; slot++){
		    if (coursePlan[semester][slot]) count++;
		}

		if (scheduleConfig.mode === "full-time" && count > 4) {
		    positions[semester] = positions[semester].map(() => true);

		    message = `Warning: Semester ${semester+1} contains ${count} courses. Recommended maximum is 4.`;
		    let id = `TooManyCoursesInSem-${semester+1}`;
		    let errorMsg = new PlanError(null, message, id);
		    errorMsg.positions = positions;
		    errors.push(errorMsg);
		}

		if (scheduleConfig.mode === "part-time" && count > 2) {
		    positions[semester] = positions[semester].map(() => true);

		    message = `Warning: Semester ${semester+1} contains ${count} courses. Recommended maximum is 2.`;
		    let id = `TooManyCoursesInSem-${semester+1}`;
		    let errorMsg = new PlanError(null, message, id);
		    errorMsg.positions = positions;
		    errors.push(errorMsg);
		}
		
	    resetErrorProperties();
	}

	return errors;
}