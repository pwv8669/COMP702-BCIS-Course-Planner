// Unit tests for pathway selection and major/minor dropdown management.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
    vi
} from "vitest";
import { state } from "../javascript/state.js";

const mockData = vi.hoisted(() => ({
    pathways: {
        doubleMajors: {
            name: "Double Majors",
            numMajors: 2,
            numMinors: 0,
            numElectives: 0
        },
        doubleMinors: {
            name: "Single Major + Double Minors",
            numMajors: 1,
            numMinors: 2,
            numElectives: 0
        },
        electives: {
            name: "Major, Minor and Electives",
            numMajors: 1,
            numMinors: 1,
            numElectives: 4
        }
    },
    majorOptions: {
        MajorA: {
            Code: "MajorA",
            Name: "Major A",
            IncompatibleMajors: [],
            IncompatibleMinors: []
        },
        MajorB: {
            Code: "MajorB",
            Name: "Major B",
            IncompatibleMajors: [],
            IncompatibleMinors: ["MinorA"]
        }
    },
    minorOptions: {
        MinorA: {
            Code: "MinorA",
            Name: "Minor A",
            IncompatibleMajors: ["MajorB"],
            IncompatibleMinors: []
        },
        MinorB: {
            Code: "MinorB",
            Name: "Minor B",
            IncompatibleMajors: [],
            IncompatibleMinors: []
        }
    },
    rawMajors: null,
    rawMinors: null,
    loadPathways: vi.fn(),
    loadMajorOptions: vi.fn(),
    loadMinorOptions: vi.fn(),
    validateStudyPlan: vi.fn(),
    refreshStudyPlan: vi.fn(),
    errorDisplay: vi.fn(),
    fetch: vi.fn(),
    alert: vi.fn(),
    container: null
}));

// Keep these tests focused on pathway management rather than JSON converters.
vi.mock("../javascript/objects/pathway.js", () => ({
    loadPathways: mockData.loadPathways
}));

vi.mock("../javascript/objects/majorMinorOption.js", () => ({
    loadMajorOptions: mockData.loadMajorOptions,
    loadMinorOptions: mockData.loadMinorOptions
}));

vi.mock("../javascript/validation/planValidator.js", () => ({
    validateStudyPlan: mockData.validateStudyPlan
}));

vi.mock("../javascript/app.js", () => ({
    refreshStudyPlan: mockData.refreshStudyPlan
}));

vi.mock("../javascript/errorDisplay.js", () => ({
    errorDisplay: mockData.errorDisplay
}));

let initPathwayOptions;
let updatePathwayOptions;

// Create the small subset of DOM element behaviour used by pathwayManager.
function makeElement(tagName) {
    const listeners = {};
    const element = {
        tagName: tagName.toUpperCase(),
        id: "",
        textContent: "",
        value: "",
        children: [],
        listeners,
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        addEventListener: vi.fn((event, handler) => {
            listeners[event] = handler;
        }),
        async trigger(event, value = this.value) {
            this.value = value;
            return listeners[event]?.({ target: this });
        }
    };

    Object.defineProperty(element, "innerHTML", {
        get() {
            return "";
        },
        set(value) {
            if (value === "") this.children = [];
        }
    });

    return element;
}

// Search the lightweight DOM tree for a generated label, select, or option.
function findElementById(element, id) {
    if (element.id === id) return element;

    for (const child of element.children) {
        const match = findElementById(child, id);
        if (match) return match;
    }

    return null;
}

// Return the values added to a generated select element.
function optionValues(selectElement) {
    return selectElement.children.map(option => option.value);
}

beforeAll(async () => {
    mockData.rawMajors = {
        Core: {
            Code: "Core",
            Name: "Core",
            IsCore: true
        },
        MajorA: {
            ...mockData.majorOptions.MajorA,
            IsCore: false
        },
        MajorB: {
            ...mockData.majorOptions.MajorB,
            IsCore: false
        }
    };
    mockData.rawMinors = {
        MinorA: mockData.minorOptions.MinorA,
        MinorB: mockData.minorOptions.MinorB
    };
    mockData.container = makeElement("div");
    mockData.container.id = "pathwayOptionContainer";

    mockData.loadPathways.mockResolvedValue(mockData.pathways);
    mockData.loadMajorOptions.mockResolvedValue(mockData.majorOptions);
    mockData.loadMinorOptions.mockResolvedValue(mockData.minorOptions);

    vi.stubGlobal("document", {
        getElementById: vi.fn(id =>
            id === "pathwayOptionContainer" ? mockData.container : null
        ),
        createElement: vi.fn(tagName => makeElement(tagName))
    });
    vi.stubGlobal("pathwayOptionContainer", mockData.container);
    vi.stubGlobal("fetch", mockData.fetch);
    vi.stubGlobal("alert", mockData.alert);
    vi.spyOn(console, "log").mockImplementation(() => {});

    ({
        initPathwayOptions,
        updatePathwayOptions
    } = await import("../javascript/pathwayManager.js"));
});

afterEach(() => {
    vi.useRealTimers();
});

afterAll(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

beforeEach(async () => {
    vi.clearAllMocks();
    state.selectedPathway = null;
    state.selectedMajors = [null, null];
    state.selectedMinors = [null, null];
    state.selectedElectives = [null, null, null, null];
    mockData.container.innerHTML = "";

    mockData.fetch.mockImplementation(async path => ({
        json: async () => path.includes("majors")
            ? mockData.rawMajors
            : mockData.rawMinors
    }));

    // Initialize the module's private option arrays before each scenario.
    await initPathwayOptions();
    vi.clearAllMocks();
});

describe("initPathwayOptions", () => {
    // Initialization loads both option files and defaults to two major fields.
    test("loads options and creates the default double-major controls", async () => {
        await initPathwayOptions();

        expect(mockData.fetch).toHaveBeenNthCalledWith(
            1,
            "./json/majors.json",
            { cache: "no-store" }
        );
        expect(mockData.fetch).toHaveBeenNthCalledWith(
            2,
            "./json/minors.json",
            { cache: "no-store" }
        );
        expect(state.selectedPathway).toBe(mockData.pathways.doubleMajors);

        const major1 = findElementById(mockData.container, "major1");
        const major2 = findElementById(mockData.container, "major2");
        expect(major1).not.toBeNull();
        expect(major2).not.toBeNull();
        expect(findElementById(mockData.container, "minor1")).toBeNull();
        expect(optionValues(major1)).toEqual(["MajorA", "MajorB", ""]);
        expect(optionValues(major1)).not.toContain("Core");
        expect(mockData.refreshStudyPlan).toHaveBeenCalledOnce();
    });
});

describe("updatePathwayOptions", () => {
    // Changing pathways preserves usable choices and clears unavailable slots.
    test("builds the requested controls and trims obsolete selections", async () => {
        state.selectedMajors = [
            mockData.majorOptions.MajorA,
            mockData.majorOptions.MajorB
        ];
        state.selectedMinors = [
            mockData.minorOptions.MinorA,
            mockData.minorOptions.MinorB
        ];
        state.selectedElectives = ["COMP700", "COMP701", "COMP702", "COMP703"];

        await updatePathwayOptions("electives");

        expect(state.selectedPathway).toBe(mockData.pathways.electives);
        expect(state.selectedMajors).toEqual([
            mockData.majorOptions.MajorA,
            null
        ]);
        expect(state.selectedMinors).toEqual([
            mockData.minorOptions.MinorA,
            null
        ]);
        expect(state.selectedElectives).toEqual([
            "COMP700",
            "COMP701",
            "COMP702",
            "COMP703"
        ]);

        const major1 = findElementById(mockData.container, "major1");
        const minor1 = findElementById(mockData.container, "minor1");
        expect(major1.value).toBe("MajorA");
        expect(minor1.value).toBe("MinorA");
        expect(findElementById(mockData.container, "major2")).toBeNull();
        expect(findElementById(mockData.container, "minor2")).toBeNull();
        expect(mockData.refreshStudyPlan).toHaveBeenCalledOnce();
    });

    // The double-minor pathway should display one major and two minor fields.
    test("creates all controls required by the double-minor pathway", async () => {
        await updatePathwayOptions("doubleMinors");

        expect(findElementById(mockData.container, "major1")).not.toBeNull();
        expect(findElementById(mockData.container, "major2")).toBeNull();
        expect(findElementById(mockData.container, "minor1")).not.toBeNull();
        expect(findElementById(mockData.container, "minor2")).not.toBeNull();
        expect(state.selectedElectives).toEqual([null, null, null, null]);
    });
});

describe("major and minor selection changes", () => {
    // A valid dropdown change stores the canonical option and validates the plan.
    test("applies a valid major selection", async () => {
        await updatePathwayOptions("electives");
        vi.clearAllMocks();
        const major1 = findElementById(mockData.container, "major1");

        await major1.trigger("change", "MajorA");
        // The DOM listener starts, but does not return, its async validation.
        await Promise.resolve();

        expect(state.selectedMajors[0]).toBe(mockData.majorOptions.MajorA);
        expect(mockData.validateStudyPlan).toHaveBeenCalledOnce();
        expect(mockData.alert).not.toHaveBeenCalled();
    });

    // Choosing the placeholder removes a selection without validating it again.
    test("allows an existing selection to be cleared", async () => {
        state.selectedMajors[0] = mockData.majorOptions.MajorA;
        await updatePathwayOptions("electives");
        vi.clearAllMocks();
        const major1 = findElementById(mockData.container, "major1");

        await major1.trigger("change", "");

        expect(state.selectedMajors[0]).toBeNull();
        expect(mockData.validateStudyPlan).not.toHaveBeenCalled();
        expect(mockData.alert).not.toHaveBeenCalled();
    });

    // The same major or minor cannot occupy more than one pathway slot.
    test("rejects a duplicate option", async () => {
        state.selectedMajors[0] = mockData.majorOptions.MajorA;
        await updatePathwayOptions("doubleMajors");
        vi.clearAllMocks();
        const major2 = findElementById(mockData.container, "major2");

        await major2.trigger("change", "MajorA");

        expect(state.selectedMajors[1]).toBeNull();
        expect(major2.value).toBe("");
        expect(mockData.alert).toHaveBeenCalledWith(
            "You cannot take the same major/minor twice."
        );
        expect(mockData.validateStudyPlan).not.toHaveBeenCalled();
    });

    // Incompatible major/minor combinations should be rejected by either side.
    test("rejects an incompatible minor selection", async () => {
        state.selectedMajors[0] = mockData.majorOptions.MajorB;
        await updatePathwayOptions("electives");
        vi.clearAllMocks();
        const minor1 = findElementById(mockData.container, "minor1");

        await minor1.trigger("change", "MinorA");

        expect(state.selectedMinors[0]).toBeNull();
        expect(minor1.value).toBe("");
        expect(mockData.alert).toHaveBeenCalledWith(
            "Minor A and Major B cannot be taken together."
        );
        expect(mockData.validateStudyPlan).not.toHaveBeenCalled();
    });
});

describe("pathway container changes", () => {
    // Any dropdown change schedules a rendered plan and error-list refresh.
    test("refreshes the plan and errors after the change delay", () => {
        vi.useFakeTimers();
        const changeHandler = mockData.container.listeners.change;

        changeHandler();

        expect(mockData.refreshStudyPlan).not.toHaveBeenCalled();
        expect(mockData.errorDisplay).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);

        expect(mockData.refreshStudyPlan).toHaveBeenCalledOnce();
        expect(mockData.errorDisplay).toHaveBeenCalledOnce();
    });
});
