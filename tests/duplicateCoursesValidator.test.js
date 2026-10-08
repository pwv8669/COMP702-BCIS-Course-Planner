// This file contains unit tests for the validateCourseAppearances function, which checks for duplicate courses in a course plan.

import { beforeEach, describe, expect, test } from "vitest";
import {
    state,
    setScheduleMode
} from "../javascript/state.js";
import {
    validateCourseAppearances
} from "../javascript/validation/duplicateCoursesValidator.js";

describe("validateCourseAppearances", () => {
    // Reset the state before each test to ensure tests are independent and do not affect each other.
    beforeEach(() => {
        // Give every test a fresh, empty plan.
        setScheduleMode("full-time");
    });

    // Test cases for validateCourseAppearances function
    // Test that no errors are returned when every course is unique
    test("returns no errors when every course is unique", () => {
        state.coursePlan[0][0] = { code: "COMP500" };
        state.coursePlan[0][1] = { code: "COMP501" };

        const errors = validateCourseAppearances();

        expect(errors).toEqual([]);
    });

    // Test that a course that appears twice is reported correctly
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
