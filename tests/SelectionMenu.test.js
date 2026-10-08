// Unit tests for editor dropdown setup and factory-data restoration.

import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
    vi
} from "vitest";

const menuMocks = vi.hoisted(() => ({
    courses: {
        COMP500: {
            Code: "COMP500",
            Name: "Programming Concepts"
        },
        COMP600: {
            Code: "COMP600",
            Name: "Advanced Computing"
        }
    },
    majors: {
        ComputerScience: {
            Code: "ComputerScience",
            Name: "Computer Science"
        },
        SoftwareDevelopment: {
            Code: "SoftwareDevelopment",
            Name: "Software Development"
        }
    },
    minors: {
        ArtificialIntelligence: {
            Code: "ArtificialIntelligence",
            Name: "Artificial Intelligence"
        }
    },
    fetch: vi.fn(),
    confirm: vi.fn(),
    alert: vi.fn(),
    reload: vi.fn(),
    elements: {}
}));

let SetupMajorMinorSelections;
let SetupSelections;

function makeResponse(data, ok = true) {
    return {
        ok,
        json: vi.fn().mockResolvedValue(data)
    };
}

// Create the event behavior needed by the factory-reset button.
function makeButton() {
    const listeners = {};

    return {
        listeners,
        addEventListener: vi.fn((event, handler) => {
            listeners[event] = handler;
        }),
        async trigger(eventName) {
            await listeners[eventName]?.({ currentTarget: this });
        }
    };
}

beforeAll(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
});

afterAll(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    menuMocks.elements = {
        coursetoedit: { innerHTML: "" },
        majortoedit: { innerHTML: "" },
        MajorMinorSelection: { value: "Major" },
        factoryResetButton: makeButton()
    };
    menuMocks.confirm.mockReturnValue(false);
    menuMocks.fetch.mockImplementation(async path => {
        if (path === "json/courses.json") {
            return makeResponse(menuMocks.courses);
        }
        if (path === "json/majors.json") {
            return makeResponse(menuMocks.majors);
        }
        if (path === "json/minors.json") {
            return makeResponse(menuMocks.minors);
        }
        if (path === "./php/factory_reset.php") {
            return makeResponse({
                success: true,
                message: "Factory data restored."
            });
        }
        throw new Error(`Unexpected request: ${path}`);
    });

    vi.stubGlobal("document", {
        getElementById: vi.fn(id => menuMocks.elements[id] ?? null)
    });
    vi.stubGlobal("fetch", menuMocks.fetch);
    vi.stubGlobal("courseobjectsstore", []);
    vi.stubGlobal("window", {
        optionobjectsstore: [],
        confirm: menuMocks.confirm,
        alert: menuMocks.alert,
        location: { reload: menuMocks.reload }
    });

    // Importing the module automatically initializes both editor menus.
    ({
        SetupMajorMinorSelections,
        SetupSelections
    } = await import("../javascript/SelectionMenu.js"));
});

describe("course editor selections", () => {
    // Initial setup should list every course and retain matching source objects.
    test("builds the course editor dropdown", () => {
        expect(menuMocks.fetch).toHaveBeenCalledWith(
            "json/courses.json",
            { cache: "no-store" }
        );
        expect(menuMocks.elements.coursetoedit.innerHTML).toBe(
            '<select id="courseselectionedit" onchange="setInput()">' +
            '<option></option>' +
            '<option value=0>COMP500</option>' +
            '<option value=1>COMP600</option>' +
            '</select>'
        );
        expect(globalThis.courseobjectsstore).toEqual([
            menuMocks.courses.COMP500,
            menuMocks.courses.COMP600
        ]);
    });

    // Course-loading failures are intentionally swallowed by the setup function.
    test("leaves the existing course menu unchanged when loading fails", async () => {
        menuMocks.elements.coursetoedit.innerHTML = "Existing menu";
        globalThis.courseobjectsstore.length = 0;
        menuMocks.fetch.mockRejectedValue(new Error("Courses unavailable"));

        await expect(SetupSelections()).resolves.toBeUndefined();

        expect(menuMocks.elements.coursetoedit.innerHTML).toBe(
            "Existing menu"
        );
        expect(globalThis.courseobjectsstore).toEqual([]);
    });
});

describe("major and minor editor selections", () => {
    // Major mode should be initialized by default when the module loads.
    test("builds the default major editor dropdown", () => {
        expect(menuMocks.fetch).toHaveBeenCalledWith(
            "json/majors.json",
            { cache: "no-store" }
        );
        expect(menuMocks.elements.majortoedit.innerHTML).toBe(
            '<select id="majorselectionedit" onchange="setInput()">' +
            '<option></option>' +
            '<option value=0>ComputerScience</option>' +
            '<option value=1>SoftwareDevelopment</option>' +
            '</select>'
        );
        expect(window.optionobjectsstore).toEqual([
            menuMocks.majors.ComputerScience,
            menuMocks.majors.SoftwareDevelopment
        ]);
    });

    // Changing editor mode should replace major objects with the minor data.
    test("switches the editor dropdown to minor options", async () => {
        menuMocks.elements.MajorMinorSelection.value = "Minor";
        vi.clearAllMocks();

        await SetupMajorMinorSelections();

        expect(menuMocks.fetch).toHaveBeenCalledWith(
            "json/minors.json",
            { cache: "no-store" }
        );
        expect(menuMocks.elements.majortoedit.innerHTML).toContain(
            '<option value=0>ArtificialIntelligence</option>'
        );
        expect(menuMocks.elements.majortoedit.innerHTML).not.toContain(
            "ComputerScience"
        );
        expect(window.optionobjectsstore).toEqual([
            menuMocks.minors.ArtificialIntelligence
        ]);
    });
});

describe("factory reset", () => {
    // Rejecting the confirmation prompt must leave server data untouched.
    test("cancels without sending a reset request", async () => {
        vi.clearAllMocks();
        menuMocks.confirm.mockReturnValue(false);

        await menuMocks.elements.factoryResetButton.trigger("click");

        expect(menuMocks.confirm).toHaveBeenCalledOnce();
        expect(menuMocks.fetch).not.toHaveBeenCalled();
        expect(menuMocks.alert).not.toHaveBeenCalled();
        expect(menuMocks.reload).not.toHaveBeenCalled();
    });

    // A confirmed successful reset should notify the user and reload the page.
    test("posts a confirmed reset and reloads after success", async () => {
        vi.clearAllMocks();
        menuMocks.confirm.mockReturnValue(true);

        await menuMocks.elements.factoryResetButton.trigger("click");

        expect(menuMocks.fetch).toHaveBeenCalledWith(
            "./php/factory_reset.php",
            { method: "POST" }
        );
        expect(menuMocks.alert).toHaveBeenCalledWith(
            "Factory data restored."
        );
        expect(menuMocks.reload).toHaveBeenCalledOnce();
    });

    // An unsuccessful response should display its error and avoid reloading.
    test("reports a server reset failure", async () => {
        vi.clearAllMocks();
        menuMocks.confirm.mockReturnValue(true);
        menuMocks.fetch.mockResolvedValue(
            makeResponse({
                success: false,
                error: "Unable to restore factory data."
            }, false)
        );

        await menuMocks.elements.factoryResetButton.trigger("click");

        expect(menuMocks.alert).toHaveBeenCalledWith(
            "Unable to restore factory data."
        );
        expect(menuMocks.reload).not.toHaveBeenCalled();
    });
});
