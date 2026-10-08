// Unit tests for study-plan course counts and semester load limits.

import { beforeEach, describe, expect, test } from "vitest";
import { validateNumberOfCourses } from
    "../javascript/validation/numCoursesValidator.js";
import {
    buildCoursePlan,
    scheduleConfig,
    setScheduleMode,
    state
} from "../javascript/state.js";

// Only course presence matters to this validator, so a code is sufficient.
const makeCourse = number => ({ code: `TEST${number}` });

// Fill available slots in semester order until the requested total is reached.
function fillPlan(numberOfCourses) {
    let coursesAdded = 0;

    for (let semester = 0;
        semester < scheduleConfig.semesters;
        semester++) {
        for (let slot = 0;
            slot < scheduleConfig.slotsPerSemester;
            slot++) {
            if (coursesAdded >= numberOfCourses) return;

            state.coursePlan[semester][slot] = makeCourse(coursesAdded);
            coursesAdded++;
        }
    }
}

// Fill an exact number of slots in one semester for load-limit scenarios.
function fillSemester(semester, numberOfCourses, startingCode = 0) {
    for (let slot = 0; slot < numberOfCourses; slot++) {
        state.coursePlan[semester][slot] = makeCourse(startingCode + slot);
    }
}

describe("validateNumberOfCourses", () => {
    // Reset configuration and state so each test starts with a standard plan.
    beforeEach(() => {
        setScheduleMode("full-time");
    });

    // A partially filled plan should report its total and mark empty positions.
    test("reports a plan containing fewer than 24 courses", () => {
        fillPlan(2);

        const errors = validateNumberOfCourses();

        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatchObject({
            id: "TooFewCourses-2",
            severity: "warning"
        });
        expect(errors[0].positions[0][0]).toBe(false);
        expect(errors[0].positions[0][1]).toBe(false);
        expect(errors[0].positions[0][2]).toBe(true);
        expect(errors[0].positions[5][3]).toBe(true);
    });

    // A standard full-time plan with exactly 24 courses is valid.
    test("accepts exactly 24 courses in full-time mode", () => {
        fillPlan(24);

        expect(validateNumberOfCourses()).toEqual([]);
    });

    // An expanded layout lets the validator identify every course after the 24th.
    test("reports courses beyond the required 24", () => {
        scheduleConfig.slotsPerSemester = 5;
        state.coursePlan = buildCoursePlan();
        fillPlan(25);

        const errors = validateNumberOfCourses();
        const countError = errors.find(
            error => error.id === "TooManyCourses-25"
        );

        expect(countError).toBeDefined();
        expect(countError.positions[4][3]).toBe(false);
        expect(countError.positions[4][4]).toBe(true);
    });

    // Full-time semesters should be limited to four courses.
    test("reports more than four courses in a full-time semester", () => {
        scheduleConfig.slotsPerSemester = 5;
        state.coursePlan = buildCoursePlan();

        // Keep the overall total at 24 so only the semester load is invalid.
        fillSemester(0, 5, 0);
        fillSemester(1, 4, 5);
        fillSemester(2, 4, 9);
        fillSemester(3, 4, 13);
        fillSemester(4, 4, 17);
        fillSemester(5, 3, 21);

        const errors = validateNumberOfCourses();

        expect(errors).toHaveLength(1);
        expect(errors[0].id).toBe("TooManyCoursesInSem-1");
        expect(errors[0].positions[0]).toEqual(
            [true, true, true, true, true]
        );
        expect(errors[0].positions[1]).toEqual(
            [false, false, false, false, false]
        );
    });

    // A full-time plan longer than six semesters should flag later semesters.
    test("reports a full-time plan longer than three years", () => {
        scheduleConfig.semesters = 7;
        state.coursePlan = buildCoursePlan();
        fillPlan(24);

        const errors = validateNumberOfCourses();

        expect(errors).toHaveLength(1);
        expect(errors[0].id).toBe("TooManySemesters-7");
        expect(errors[0].positions[5]).toEqual(
            [false, false, false, false]
        );
        expect(errors[0].positions[6]).toEqual(
            [true, true, true, true]
        );
    });

    // Twelve semesters of two courses form a valid 24-course part-time plan.
    test("accepts exactly 24 courses in part-time mode", () => {
        setScheduleMode("part-time");
        fillPlan(24);

        expect(validateNumberOfCourses()).toEqual([]);
    });

    // Part-time semesters should be limited to two courses.
    test("reports more than two courses in a part-time semester", () => {
        setScheduleMode("part-time");
        scheduleConfig.slotsPerSemester = 3;
        state.coursePlan = buildCoursePlan();

        // Keep the total at 24 while putting three courses in semester one.
        fillSemester(0, 3, 0);
        for (let semester = 1; semester <= 10; semester++) {
            fillSemester(semester, 2, semester * 10);
        }
        fillSemester(11, 1, 110);

        const errors = validateNumberOfCourses();

        expect(errors).toHaveLength(1);
        expect(errors[0].id).toBe("TooManyCoursesInSem-1");
        expect(errors[0].positions[0]).toEqual([true, true, true]);
        expect(errors[0].positions[1]).toEqual([false, false, false]);
    });
});
