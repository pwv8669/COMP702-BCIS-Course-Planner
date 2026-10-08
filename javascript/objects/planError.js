import { buildCoursePlan, scheduleConfig } from '../state.js';

//This holds the two types of severities an error may have to differenciate it in the display.
export const ErrorSeverity = Object.freeze({
    WARNING: 'warning',
    ERROR: 'error',
});

//This class holds all the information relating to an error
export class PlanError {
    constructor(courseCode, message, id, severity = ErrorSeverity.WARNING) {
        this.courseCode = courseCode;
        this.message = message;
        this.positions = buildCoursePlan();
        this.occurences = null;
        this.id = id;
        this.severity = severity;
    }
}
