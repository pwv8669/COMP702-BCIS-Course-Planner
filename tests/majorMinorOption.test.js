// Unit tests for major/minor option construction and JSON loading.

import {
    afterEach,
    describe,
    expect,
    test,
    vi
} from "vitest";

const optionMocks = vi.hoisted(() => ({
    courses: {
        COMP500: { code: "COMP500", name: "Programming Concepts" },
        COMP600: { code: "COMP600", name: "Advanced Computing" },
        COMP700: { code: "COMP700", name: "Project" }
    },
    loadCourses: vi.fn()
}));

// Supply canonical Course objects without loading the complete catalogue.
vi.mock("../javascript/objects/course.js", () => ({
    loadCourses: optionMocks.loadCourses
}));

optionMocks.loadCourses.mockResolvedValue(optionMocks.courses);

const {
    loadMajorOptions,
    loadMinorOptions,
    MajorOption,
    MinorOption
} = await import("../javascript/objects/majorMinorOption.js");

function rawMajor(overrides = {}) {
    return {
        Code: "ComputerScience",
        Name: "Computer Science",
        Requirements: [{
            Type: "Required",
            Courses: ["COMP500", "COMP600"]
        }],
        ...overrides
    };
}

function rawMinor(overrides = {}) {
    return {
        Code: "SoftwareDevelopment",
        Name: "Software Development",
        Requirements: [{
            Type: "ChooseN",
            Count: 1,
            Courses: ["COMP600", "COMP700"]
        }],
        Level6PointsRequired: "30",
        Level7PointsRequired: "15",
        ...overrides
    };
}

function mockOptionFetch(data) {
    const json = vi.fn().mockResolvedValue(data);
    const fetchMock = vi.fn().mockResolvedValue({ json });
    vi.stubGlobal("fetch", fetchMock);
    return { fetchMock, json };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("MajorOption", () => {
    // Raw course codes should resolve to the shared Course object instances.
    test("constructs a major and resolves its requirements", () => {
        const major = new MajorOption(rawMajor({
            IncompatibleMajors: ["DataScience"],
            IncompatibleMinors: ["ArtificialIntelligence"],
            IsCore: true
        }));

        expect(major).toMatchObject({
            Code: "ComputerScience",
            Name: "Computer Science",
            IncompatibleMajors: ["DataScience"],
            IncompatibleMinors: ["ArtificialIntelligence"],
            IsCore: true
        });
        expect(major.Requirements).toEqual([{
            Type: "Required",
            Courses: [
                optionMocks.courses.COMP500,
                optionMocks.courses.COMP600
            ]
        }]);
    });

    // Optional incompatibility and Core metadata should have safe defaults.
    test("defaults optional major fields", () => {
        const major = new MajorOption(rawMajor());

        expect(major.IncompatibleMajors).toEqual([]);
        expect(major.IncompatibleMinors).toEqual([]);
        expect(major.IsCore).toBe(false);
    });
});

describe("MinorOption", () => {
    // Minor point thresholds become numbers and requirements become objects.
    test("constructs a minor with numeric point requirements", () => {
        const minor = new MinorOption(rawMinor({
            IncompatibleMajors: ["SoftwareDevelopment"],
            IncompatibleMinors: ["DataScience"]
        }));

        expect(minor).toMatchObject({
            Code: "SoftwareDevelopment",
            Name: "Software Development",
            IncompatibleMajors: ["SoftwareDevelopment"],
            IncompatibleMinors: ["DataScience"],
            Level6PointsRequired: 30,
            Level7PointsRequired: 15
        });
        expect(minor.Requirements[0]).toEqual({
            Type: "ChooseN",
            Count: 1,
            Courses: [
                optionMocks.courses.COMP600,
                optionMocks.courses.COMP700
            ]
        });
    });
});

describe("option loaders", () => {
    // Major JSON entries should retain their keys and become MajorOption objects.
    test("loads all major options", async () => {
        const data = {
            ComputerScience: rawMajor(),
            Core: rawMajor({
                Code: "Core",
                Name: "Core",
                IsCore: true,
                Requirements: [{
                    Type: "Required",
                    Courses: ["COMP500"]
                }]
            })
        };
        const { fetchMock, json } = mockOptionFetch(data);

        const majors = await loadMajorOptions();

        expect(fetchMock).toHaveBeenCalledWith(
            "json/majors.json",
            { cache: "no-store" }
        );
        expect(json).toHaveBeenCalledOnce();
        expect(Object.keys(majors)).toEqual(["ComputerScience", "Core"]);
        expect(majors.ComputerScience).toBeInstanceOf(MajorOption);
        expect(majors.Core).toBeInstanceOf(MajorOption);
        expect(majors.Core.IsCore).toBe(true);
        expect(majors.Core.Requirements[0].Courses[0]).toBe(
            optionMocks.courses.COMP500
        );
    });

    // Minor JSON entries should retain their keys and become MinorOption objects.
    test("loads all minor options", async () => {
        const data = {
            SoftwareDevelopment: rawMinor(),
            ArtificialIntelligence: rawMinor({
                Code: "ArtificialIntelligence",
                Name: "Artificial Intelligence",
                Level6PointsRequired: "15"
            })
        };
        const { fetchMock } = mockOptionFetch(data);

        const minors = await loadMinorOptions();

        expect(fetchMock).toHaveBeenCalledWith(
            "json/minors.json",
            { cache: "no-store" }
        );
        expect(Object.keys(minors)).toEqual([
            "SoftwareDevelopment",
            "ArtificialIntelligence"
        ]);
        expect(minors.SoftwareDevelopment).toBeInstanceOf(MinorOption);
        expect(minors.ArtificialIntelligence).toBeInstanceOf(MinorOption);
        expect(minors.ArtificialIntelligence.Level6PointsRequired).toBe(15);
    });

    // A failed data request should remain visible to the loader's caller.
    test("propagates an option-data request failure", async () => {
        const requestError = new Error("Option data unavailable");
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(requestError));

        await expect(loadMajorOptions()).rejects.toBe(requestError);
        await expect(loadMinorOptions()).rejects.toBe(requestError);
    });
});
