// Unit and data-integration tests for loading and converting course records.

import {
    afterEach,
    describe,
    expect,
    test,
    vi
} from "vitest";
import realCourseData from "../json/courses.json";
import {
    loadCourses,
    NodeType
} from "../javascript/objects/course.js";

// Create a complete raw JSON record with optional per-test overrides.
function rawCourse(code, overrides = {}) {
    return {
        Code: code,
        Name: `${code} name`,
        Points: "15",
        Level: "5",
        Semester1Offered: true,
        Semester2Offered: false,
        Prerequisites: null,
        Corequisites: null,
        ...overrides
    };
}

// Make loadCourses receive controlled JSON without accessing a web server.
function mockCourseFetch(data) {
    const json = vi.fn(async () => data);
    const fetchMock = vi.fn(async () => ({ json }));

    vi.stubGlobal("fetch", fetchMock);
    return { fetchMock, json };
}

// Verify a parsed tree recursively, including resolved course references.
function expectResolvedTree(node, courses) {
    if (!node) return;

    if (node.type === NodeType.COURSE) {
        expect(typeof node.value).toBe("string");
        expect(courses[node.value]).toBeDefined();
        expect(node.course).toBe(courses[node.value]);
        expect(node.children).toEqual([]);
        return;
    }

    expect([NodeType.AND, NodeType.OR]).toContain(node.type);
    expect(Array.isArray(node.children)).toBe(true);
    expect(node.children.length).toBeGreaterThan(0);

    for (const child of node.children) {
        expectResolvedTree(child, courses);
    }
}

// Restore the real global environment after each mocked fetch.
afterEach(() => {
    vi.unstubAllGlobals();
});

describe("loadCourses", () => {
    // Raw strings should become numeric fields while other values are preserved.
    test("converts raw JSON fields into a course object", async () => {
        const data = {
            COMP500: rawCourse("COMP500", {
                Name: "Programming Concepts",
                Points: "30",
                Level: "6",
                Semester1Offered: false,
                Semester2Offered: true,
                Level5PointsRequired: "45",
                Level6PointsRequired: "30",
                Level7PointsRequired: "15",
                MustBeTakenConsequtively: true,
                RequiresAllCoreAndMajorRequirementsUpToLevel: 6
            })
        };
        const { fetchMock, json } = mockCourseFetch(data);

        const courses = await loadCourses();

        expect(fetchMock).toHaveBeenCalledOnce();
        expect(fetchMock).toHaveBeenCalledWith(
            "json/courses.json",
            { cache: "no-store" }
        );
        expect(json).toHaveBeenCalledOnce();
        expect(courses.COMP500).toMatchObject({
            code: "COMP500",
            name: "Programming Concepts",
            points: 30,
            level: 6,
            semester1Offered: false,
            semester2Offered: true,
            level5PointsRequired: 45,
            level6PointsRequired: 30,
            level7PointsRequired: 15,
            prerequisites: null,
            corequisites: null,
            mustBeTakenConsequtively: true,
            requiresAllCoreAndMajorRequirementsUpToLevel: 6
        });
    });

    // Missing optional requirements should use safe defaults.
    test("defaults optional fields when they are absent", async () => {
        mockCourseFetch({
            COMP500: rawCourse("COMP500")
        });

        const courses = await loadCourses();
        const course = courses.COMP500;

        expect(course.level5PointsRequired).toBe(0);
        expect(course.level6PointsRequired).toBe(0);
        expect(course.level7PointsRequired).toBe(0);
        expect(course.prerequisites).toBeNull();
        expect(course.corequisites).toBeNull();
        expect(course.mustBeTakenConsequtively).toBe(false);
        expect(
            course.requiresAllCoreAndMajorRequirementsUpToLevel
        ).toBeNull();
    });

    // Single prerequisite and corequisite nodes should resolve to loaded objects.
    test("parses and resolves single prerequisite and corequisite courses", async () => {
        mockCourseFetch({
            COMP500: rawCourse("COMP500"),
            COMP501: rawCourse("COMP501"),
            COMP600: rawCourse("COMP600", {
                Prerequisites: "COMP500",
                Corequisites: "COMP501"
            })
        });

        const courses = await loadCourses();

        expect(courses.COMP600.prerequisites).toMatchObject({
            type: NodeType.COURSE,
            value: "COMP500",
            course: courses.COMP500
        });
        expect(courses.COMP600.corequisites).toMatchObject({
            type: NodeType.COURSE,
            value: "COMP501",
            course: courses.COMP501
        });
    });

    // AND binds more tightly than OR when parentheses do not override it.
    test("gives AND precedence over OR", async () => {
        mockCourseFetch({
            COMP500: rawCourse("COMP500"),
            COMP501: rawCourse("COMP501"),
            COMP502: rawCourse("COMP502"),
            COMP600: rawCourse("COMP600", {
                Prerequisites: "COMP500 OR COMP501 AND COMP502"
            })
        });

        const courses = await loadCourses();
        const tree = courses.COMP600.prerequisites;

        expect(tree.type).toBe(NodeType.OR);
        expect(tree.children[0].value).toBe("COMP500");
        expect(tree.children[1].type).toBe(NodeType.AND);
        expect(tree.children[1].children.map(node => node.value)).toEqual([
            "COMP501",
            "COMP502"
        ]);
        expectResolvedTree(tree, courses);
    });

    // Parentheses should make the OR expression a child of the root AND.
    test("respects parentheses in prerequisite expressions", async () => {
        mockCourseFetch({
            COMP500: rawCourse("COMP500"),
            COMP501: rawCourse("COMP501"),
            COMP502: rawCourse("COMP502"),
            COMP600: rawCourse("COMP600", {
                Prerequisites: "(COMP500 OR COMP501) AND COMP502"
            })
        });

        const courses = await loadCourses();
        const tree = courses.COMP600.prerequisites;

        expect(tree.type).toBe(NodeType.AND);
        expect(tree.children[0].type).toBe(NodeType.OR);
        expect(tree.children[0].children.map(node => node.value)).toEqual([
            "COMP500",
            "COMP501"
        ]);
        expect(tree.children[1].value).toBe("COMP502");
        expectResolvedTree(tree, courses);
    });

    // Repeated operators should produce one flat node rather than nested nodes.
    test("flattens repeated prerequisite operators", async () => {
        mockCourseFetch({
            COMP500: rawCourse("COMP500"),
            COMP501: rawCourse("COMP501"),
            COMP502: rawCourse("COMP502"),
            COMP600: rawCourse("COMP600", {
                Prerequisites: "COMP500 AND COMP501 AND COMP502"
            })
        });

        const courses = await loadCourses();
        const tree = courses.COMP600.prerequisites;

        expect(tree.type).toBe(NodeType.AND);
        expect(tree.children).toHaveLength(3);
        expect(tree.children.map(node => node.value)).toEqual([
            "COMP500",
            "COMP501",
            "COMP502"
        ]);
        expectResolvedTree(tree, courses);
    });

    // Network or server failures should be visible to the caller.
    test("propagates a rejected course-data request", async () => {
        const requestError = new Error("Course data unavailable");
        vi.stubGlobal(
            "fetch",
            vi.fn().mockRejectedValue(requestError)
        );

        await expect(loadCourses()).rejects.toBe(requestError);
    });

    // Every production JSON entry should convert and reference known courses.
    test("converts the complete courses JSON catalogue", async () => {
        mockCourseFetch(realCourseData);

        const courses = await loadCourses();
        const rawEntries = Object.entries(realCourseData);

        expect(Object.keys(courses)).toHaveLength(rawEntries.length);

        for (const [catalogueCode, raw] of rawEntries) {
            const course = courses[catalogueCode];

            expect(course).toBeDefined();
            expect(course.code).toBe(raw.Code);
            expect(catalogueCode).toBe(raw.Code);
            expect(typeof course.name).toBe("string");
            expect(course.name.length).toBeGreaterThan(0);
            expect(Number.isFinite(course.points)).toBe(true);
            expect(Number.isFinite(course.level)).toBe(true);
            expect(Number.isFinite(course.level5PointsRequired)).toBe(true);
            expect(Number.isFinite(course.level6PointsRequired)).toBe(true);
            expect(Number.isFinite(course.level7PointsRequired)).toBe(true);
            expect(typeof course.semester1Offered).toBe("boolean");
            expect(typeof course.semester2Offered).toBe("boolean");

            expectResolvedTree(course.prerequisites, courses);
            expectResolvedTree(course.corequisites, courses);
        }
    });
});
