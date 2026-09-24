// This file contains unit tests for the prerequisiteValidator module. It uses Vitest for testing and mocking dependencies. The tests cover various scenarios for evaluating prerequisite trees, checking completed courses, validating prerequisites, corequisites, point prerequisites, and core/major requirements.

import {
    beforeEach,
    describe,
    expect,
    test,
    vi
} from "vitest";

const { majorOptions } = vi.hoisted(() => ({
    majorOptions: {
        Core: {
            Requirements: []
        }
    }
}));

// prerequisiteValidator loads these options when the module is imported.
// Supplying them here keeps the unit tests independent of fetch and JSON files.
vi.mock("../javascript/objects/majorMinorOption.js", () => ({
    loadMajorOptions: vi.fn(async () => majorOptions)
}));

import {
    evaluateCoreAndMajorRequirements,
    evaluatePrerequisiteTree,
    getCompletedCourses,
    validateCorequisites,
    validatePointPrerequisites,
    validatePrerequisites
} from "../javascript/prerequisiteValidator.js";
import {
    setScheduleMode,
    state
} from "../javascript/state.js";

// Helper functions to create course and operator nodes for testing prerequisite trees
const courseNode = code => ({
    type: "COURSE",
    value: code,
    children: []
});

// Helper function to create operator nodes (AND/OR) for prerequisite trees
const operatorNode = (type, ...children) => ({
    type,
    value: null,
    children
});

// Helper function to create a course object with default properties, allowing overrides for specific tests
function makeCourse(code, overrides = {}) {
    return {
        code,
        level: 5,
        points: 15,
        prerequisites: null,
        corequisites: null,
        level5PointsRequired: 0,
        level6PointsRequired: 0,
        level7PointsRequired: 0,
        mustBeTakenConsequtively: false,
        requiresAllCoreAndMajorRequirementsUpToLevel: null,
        ...overrides
    };
}

// Reset the state before each test to ensure tests are independent and do not affect each other.
beforeEach(() => {
    setScheduleMode("full-time");
    state.selectedMajors = [null, null];
    state.selectedMinors = [null, null];
    majorOptions.Core = { Requirements: [] };
});

describe("evaluatePrerequisiteTree", () => {
    // Test that a course with no prerequisites is accepted
    test("accepts a course with no prerequisites", () => {
        expect(evaluatePrerequisiteTree(null, new Set())).toBe(true);
    });

    // Test that a course with a single prerequisite is accepted when the prerequisite is completed
    test("accepts a course with a single prerequisite that is completed", () => {
        const tree = courseNode("COMP500");
    
        expect(
            evaluatePrerequisiteTree(tree, new Set(["COMP500"]))
        ).toBe(true);
    });

    
    test("requires every child of an AND node", () => {
        const tree = operatorNode(
            "AND",
            courseNode("COMP500"),
            courseNode("COMP501")
        );

        expect(
            evaluatePrerequisiteTree(
                tree,
                new Set(["COMP500", "COMP501"])
            )
        ).toBe(true);
        expect(
            evaluatePrerequisiteTree(tree, new Set(["COMP500"]))
        ).toBe(false);
        expect(
            evaluatePrerequisiteTree(tree, new Set(["COMP501"]))
        ).toBe(false);
    });

    test("requires at least one child of an OR node", () => {
        const tree = operatorNode(
            "OR",
            courseNode("COMP500"),
            courseNode("COMP501")
        );

        expect(
            evaluatePrerequisiteTree(tree, new Set(["COMP500"]))
        ).toBe(true);
        expect(
            evaluatePrerequisiteTree(tree, new Set(["COMP501"]))
        ).toBe(true);
        expect(evaluatePrerequisiteTree(tree, new Set())).toBe(false);
    });

    test("rejects an unknown node type", () => {
        expect(
            evaluatePrerequisiteTree(
                { type: "UNKNOWN", children: [] },
                new Set()
            )
        ).toBe(false);
    });
});

describe("getCompletedCourses", () => {
    test("returns courses from earlier semesters only", () => {
        state.coursePlan[0][0] = makeCourse("COMP500");
        state.coursePlan[1][0] = makeCourse("COMP501");

        expect(getCompletedCourses(1)).toEqual(new Set(["COMP500"]));
        expect(getCompletedCourses(2)).toEqual(
            new Set(["COMP500", "COMP501"])
        );
    });
});

describe("validatePrerequisites", () => {
    test("reports a prerequisite that has not been completed", () => {
        state.coursePlan[0][1] = makeCourse("COMP600", {
            prerequisites: courseNode("COMP500")
        });

        const errors = validatePrerequisites();

        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatchObject({
            courseCode: "COMP600",
            id: "MissingPreq-COMP600",
            severity: "error"
        });
        expect(errors[0].positions[0][1]).toBe(true);
    });

    test("accepts a prerequisite completed in an earlier semester", () => {
        state.coursePlan[0][0] = makeCourse("COMP500");
        state.coursePlan[1][0] = makeCourse("COMP600", {
            prerequisites: courseNode("COMP500")
        });

        expect(validatePrerequisites()).toEqual([]);
    });

    test("does not count a course taken in the same semester", () => {
        state.coursePlan[0][0] = makeCourse("COMP500");
        state.coursePlan[0][1] = makeCourse("COMP600", {
            prerequisites: courseNode("COMP500")
        });

        const errors = validatePrerequisites();

        expect(errors.map(error => error.id)).toContain(
            "MissingPreq-COMP600"
        );
    });

    test("reports a consecutive prerequisite taken too early", () => {
        state.coursePlan[0][0] = makeCourse("COMP500");
        state.coursePlan[2][0] = makeCourse("COMP600", {
            prerequisites: courseNode("COMP500"),
            mustBeTakenConsequtively: true
        });

        const errors = validatePrerequisites();

        expect(errors).toHaveLength(1);
        expect(errors[0].id).toBe("NonConsecutivePreq-COMP600");
        expect(errors[0].positions[2][0]).toBe(true);
    });
});

describe("validateCorequisites", () => {
    test("accepts a corequisite taken in the same semester", () => {
        state.coursePlan[0][0] = makeCourse("COMP500");
        state.coursePlan[0][1] = makeCourse("COMP501", {
            corequisites: courseNode("COMP500")
        });

        expect(validateCorequisites()).toEqual([]);
    });

    test("reports a missing corequisite", () => {
        state.coursePlan[0][1] = makeCourse("COMP501", {
            corequisites: courseNode("COMP500")
        });

        const errors = validateCorequisites();

        expect(errors).toHaveLength(1);
        expect(errors[0].id).toBe("MissingCoreq-COMP501");
        expect(errors[0].positions[0][1]).toBe(true);
    });
});

describe("validatePointPrerequisites", () => {
    test("accepts sufficient points completed in earlier semesters", () => {
        state.coursePlan[0][0] = makeCourse("COMP500");
        state.coursePlan[0][1] = makeCourse("COMP501");
        state.coursePlan[1][0] = makeCourse("COMP600", {
            level: 6,
            level5PointsRequired: 30
        });

        expect(validatePointPrerequisites()).toEqual([]);
    });

    test("reports insufficient points and identifies the course position", () => {
        state.coursePlan[0][0] = makeCourse("COMP500");
        state.coursePlan[1][2] = makeCourse("COMP600", {
            level: 6,
            level5PointsRequired: 30
        });

        const errors = validatePointPrerequisites();

        expect(errors).toHaveLength(1);
        expect(errors[0].id).toBe("MissingPointPreq-COMP600");
        expect(errors[0].message).toContain(
            "level 5 requires 30 points but 15 have been completed"
        );
        expect(errors[0].positions[1][2]).toBe(true);
    });
});

describe("evaluateCoreAndMajorRequirements", () => {
    test("checks required and choose-N courses up to the requested level", () => {
        majorOptions.Core = {
            Requirements: [
                {
                    Type: "Required",
                    Courses: [makeCourse("COMP500")]
                },
                {
                    Type: "ChooseN",
                    Count: 1,
                    Courses: [
                        makeCourse("COMP501"),
                        makeCourse("COMP502")
                    ]
                },
                {
                    Type: "Required",
                    Courses: [makeCourse("COMP700", { level: 7 })]
                }
            ]
        };

        expect(
            evaluateCoreAndMajorRequirements(
                6,
                new Set(["COMP500", "COMP502"])
            )
        ).toBe(true);
        expect(
            evaluateCoreAndMajorRequirements(6, new Set(["COMP500"]))
        ).toBe(false);
    });

    test("includes requirements from the selected majors", () => {
        state.selectedMajors[0] = {
            Requirements: [
                {
                    Type: "Required",
                    Courses: [makeCourse("COMP601", { level: 6 })]
                }
            ]
        };

        expect(
            evaluateCoreAndMajorRequirements(6, new Set(["COMP601"]))
        ).toBe(true);
        expect(
            evaluateCoreAndMajorRequirements(6, new Set())
        ).toBe(false);
    });
});
