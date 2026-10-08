// Unit tests for the top-level study-plan validation orchestrator.

import { beforeEach, describe, expect, test, vi } from "vitest";

const validatorMocks = vi.hoisted(() => ({
    validatePrerequisites: vi.fn(),
    validateCorequisites: vi.fn(),
    validateCourseAppearances: vi.fn(),
    validateNumberOfCourses: vi.fn(),
    validateMajorMinorRequirements: vi.fn(),
    validateSemestersOffered: vi.fn(),
    validatePoints: vi.fn()
}));

// Mock each child validator so this suite tests orchestration in isolation.
vi.mock("../javascript/validation/prerequisiteValidator.js", () => ({
    validatePrerequisites: validatorMocks.validatePrerequisites,
    validateCorequisites: validatorMocks.validateCorequisites
}));

vi.mock("../javascript/validation/duplicateCoursesValidator.js", () => ({
    validateCourseAppearances: validatorMocks.validateCourseAppearances
}));

vi.mock("../javascript/validation/numCoursesValidator.js", () => ({
    validateNumberOfCourses: validatorMocks.validateNumberOfCourses
}));

vi.mock(
    "../javascript/validation/majorMinorRequirementsValidator.js",
    () => ({
        validateMajorMinorRequirements:
            validatorMocks.validateMajorMinorRequirements
    })
);

vi.mock("../javascript/validation/semesterOfferedValidator.js", () => ({
    validateSemestersOffered: validatorMocks.validateSemestersOffered
}));

vi.mock("../javascript/validation/pointsValidator.js", () => ({
    validatePoints: validatorMocks.validatePoints
}));

import { validateStudyPlan } from
    "../javascript/validation/planValidator.js";
import { state } from "../javascript/state.js";

// The orchestrator only requires an ID to filter and preserve an error.
const makeError = id => ({ id, message: `${id} message` });

// Keep the expected validator execution order explicit and reusable.
const validatorsInOrder = [
    validatorMocks.validatePrerequisites,
    validatorMocks.validateCorequisites,
    validatorMocks.validateCourseAppearances,
    validatorMocks.validateNumberOfCourses,
    validatorMocks.validateMajorMinorRequirements,
    validatorMocks.validateSemestersOffered,
    validatorMocks.validatePoints
];

describe("validateStudyPlan", () => {
    // Reset mock history, return values, and ignored errors before every test.
    beforeEach(() => {
        for (const validator of validatorsInOrder) {
            validator.mockReset();
            validator.mockReturnValue([]);
        }

        state.ignoredErrors = {};
    });

    // Errors should be returned in the same order as the child validators run.
    test("combines errors from every validator in validation order", () => {
        const prerequisiteError = makeError("PrerequisiteError");
        const corequisiteError = makeError("CorequisiteError");
        const duplicateError = makeError("DuplicateError");
        const countError = makeError("CountError");
        const majorMinorError = makeError("MajorMinorError");
        const semesterError = makeError("SemesterError");
        const pointError = makeError("PointError");

        validatorMocks.validatePrerequisites.mockReturnValue([
            prerequisiteError
        ]);
        validatorMocks.validateCorequisites.mockReturnValue([
            corequisiteError
        ]);
        validatorMocks.validateCourseAppearances.mockReturnValue([
            duplicateError
        ]);
        validatorMocks.validateNumberOfCourses.mockReturnValue([
            countError
        ]);
        validatorMocks.validateMajorMinorRequirements.mockReturnValue([
            majorMinorError
        ]);
        validatorMocks.validateSemestersOffered.mockReturnValue([
            semesterError
        ]);
        validatorMocks.validatePoints.mockReturnValue([pointError]);

        const errors = validateStudyPlan();

        expect(errors).toEqual([
            prerequisiteError,
            corequisiteError,
            duplicateError,
            countError,
            majorMinorError,
            semesterError,
            pointError
        ]);
    });

    // Errors with saved ignore notes should be omitted regardless of source.
    test("filters ignored errors from different validators", () => {
        const ignoredPrerequisite = makeError("IgnoredPrerequisite");
        const visiblePrerequisite = makeError("VisiblePrerequisite");
        const ignoredSemester = makeError("IgnoredSemester");
        const visiblePoint = makeError("VisiblePoint");

        validatorMocks.validatePrerequisites.mockReturnValue([
            ignoredPrerequisite,
            visiblePrerequisite
        ]);
        validatorMocks.validateSemestersOffered.mockReturnValue([
            ignoredSemester
        ]);
        validatorMocks.validatePoints.mockReturnValue([visiblePoint]);
        state.ignoredErrors = {
            IgnoredPrerequisite: "Approved prerequisite exception",
            IgnoredSemester: "Course availability confirmed"
        };

        const errors = validateStudyPlan();

        expect(errors).toEqual([
            visiblePrerequisite,
            visiblePoint
        ]);
    });

    // Every child validator must run once and in the intended dependency order.
    test("runs every validator once in the correct order", () => {
        validateStudyPlan();

        for (const validator of validatorsInOrder) {
            expect(validator).toHaveBeenCalledTimes(1);
        }

        const callOrder = validatorsInOrder.map(
            validator => validator.mock.invocationCallOrder[0]
        );
        expect(callOrder).toEqual([...callOrder].sort((a, b) => a - b));

        // Major/minor validation populates attribution used by point validation.
        expect(
            validatorMocks.validateMajorMinorRequirements.mock
                .invocationCallOrder[0]
        ).toBeLessThan(
            validatorMocks.validatePoints.mock.invocationCallOrder[0]
        );
    });

    // Each validation run should return a fresh result without previous errors.
    test("does not retain errors between validation runs", () => {
        const firstError = makeError("FirstRunOnly");
        validatorMocks.validatePrerequisites
            .mockReturnValueOnce([firstError])
            .mockReturnValue([]);

        const firstResult = validateStudyPlan();
        const secondResult = validateStudyPlan();

        expect(firstResult).toEqual([firstError]);
        expect(secondResult).toEqual([]);
        expect(secondResult).not.toBe(firstResult);
    });
});
