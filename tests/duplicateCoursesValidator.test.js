import { beforeEach, describe, expect, test } from "vitest";
import {
    state,
    setScheduleMode
} from "../javascript/state.js";
import {
    validateCourseAppearances
} from "../javascript/duplicateCoursesValidator.js";

describe("validateCourseAppearances", () => {
    beforeEach(() => {
        // Give every test a fresh, empty plan.
        setScheduleMode("full-time");
    });

    test("returns no errors when every course is unique", () => {
        state.coursePlan[0][0] = { code: "COMP500" };
        state.coursePlan[0][1] = { code: "COMP501" };

        const errors = validateCourseAppearances();

        expect(errors).toEqual([]);
    });

    test("reports a course that appears twice", () => {
        state.coursePlan[0][0] = { code: "COMP500" };
        state.coursePlan[1][2] = { code: "COMP500" };

        const errors = validateCourseAppearances();

        expect(errors).toHaveLength(1);
        expect(errors[0].id).toBe(
            "DuplicateClass-COMP500-2-Times"
        );
        expect(errors[0].occurences).toBe(2);
        expect(errors[0].positions[0][0]).toBe(true);
        expect(errors[0].positions[1][2]).toBe(true);
    });
});