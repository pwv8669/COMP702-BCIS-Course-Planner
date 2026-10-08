// Unit tests for validating whether courses are offered in planned semesters.

import { beforeEach, describe, expect, test } from "vitest";
import {
    validateSemestersOffered
} from "../javascript/validation/semesterOfferedValidator.js";
import { setScheduleMode, state } from "../javascript/state.js";

// Create the course properties used by the semester-offering validator.
function makeCourse(
    code,
    semester1Offered = true,
    semester2Offered = true
) {
    return {
        code,
        semester1Offered,
        semester2Offered
    };
}

describe("validateSemestersOffered", () => {
    // Give every test a fresh full-time plan unless it selects another mode.
    beforeEach(() => {
        setScheduleMode("full-time");
    });

    // Empty positions should be ignored and should not produce errors.
    test("accepts an empty study plan", () => {
        expect(validateSemestersOffered()).toEqual([]);
    });

    // Even plan indexes represent semester one and odd indexes semester two.
    test("accepts courses offered in their planned semesters", () => {
        state.coursePlan[0][0] = makeCourse("SEM1", true, false);
        state.coursePlan[1][0] = makeCourse("SEM2", false, true);

        expect(validateSemestersOffered()).toEqual([]);
    });

    // A semester-one error should contain the course, index, and plan position.
    test("reports a course unavailable in semester one", () => {
        state.coursePlan[0][2] = makeCourse("COMP500", false, true);

        const errors = validateSemestersOffered();

        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatchObject({
            courseCode: "COMP500",
            id: "SemesterNotOffered-COMP500-0",
            message:
                "The course COMP500 is not offered in the 1st " +
                "semester of a year.",
            severity: "error"
        });
        expect(errors[0].positions[0][2]).toBe(true);
    });

    // A semester-two error should use the second-semester wording and index.
    test("reports a course unavailable in semester two", () => {
        state.coursePlan[1][3] = makeCourse("COMP501", true, false);

        const errors = validateSemestersOffered();

        expect(errors).toHaveLength(1);
        expect(errors[0].id).toBe("SemesterNotOffered-COMP501-1");
        expect(errors[0].message).toContain("2nd semester");
        expect(errors[0].positions[1][3]).toBe(true);
    });

    // Each unavailable course should receive its own independently positioned error.
    test("reports every unavailable course in plan order", () => {
        state.coursePlan[0][0] = makeCourse("INVALID1", false, true);
        state.coursePlan[0][1] = makeCourse("VALID", true, true);
        state.coursePlan[3][2] = makeCourse("INVALID2", true, false);

        const errors = validateSemestersOffered();

        expect(errors.map(error => error.id)).toEqual([
            "SemesterNotOffered-INVALID1-0",
            "SemesterNotOffered-INVALID2-3"
        ]);
        expect(errors[0].positions[0][0]).toBe(true);
        expect(errors[0].positions[3][2]).not.toBe(true);
        expect(errors[1].positions[3][2]).toBe(true);
        expect(errors[1].positions[0][0]).not.toBe(true);
    });

    // Part-time semesters still alternate between semester one and two yearly.
    test("uses semester parity throughout a part-time plan", () => {
        setScheduleMode("part-time");
        state.coursePlan[6][0] = makeCourse("YEAR4SEM1", false, true);
        state.coursePlan[7][1] = makeCourse("YEAR4SEM2", true, false);

        const errors = validateSemestersOffered();

        expect(errors.map(error => error.id)).toEqual([
            "SemesterNotOffered-YEAR4SEM1-6",
            "SemesterNotOffered-YEAR4SEM2-7"
        ]);
        expect(errors[0].message).toContain("1st semester");
        expect(errors[1].message).toContain("2nd semester");
        expect(errors[0].positions[6][0]).toBe(true);
        expect(errors[1].positions[7][1]).toBe(true);
    });
});
