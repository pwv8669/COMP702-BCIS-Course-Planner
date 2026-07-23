export class PlanError {
    constructor(courseCode, message, id) {
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
    }
}