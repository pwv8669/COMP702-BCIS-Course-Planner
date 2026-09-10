export const ErrorSeverity = Object.freeze({
    WARNING: 'warning',
    ERROR: 'error',
});

export class PlanError {
    constructor(courseCode, message, id, severity = ErrorSeverity.WARNING) {
        this.courseCode = courseCode;
        this.message = message;
        this.positions = [
            [false, false, false, false],
            [false, false, false, false],
            [false, false, false, false],
            [false, false, false, false],
            [false, false, false, false],
            [false, false, false, false],
        ];
        this.occurences = null;
        this.id = id;
        this.severity = severity;
    }
}
