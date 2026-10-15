// Unit tests for opening, loading, uploading, and saving study-plan templates.

import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
    vi
} from "vitest";

const mockData = vi.hoisted(() => ({
    state: {
        selectedMajors: [null, null],
        selectedMinors: [null, null],
        selectedElectives: [null, null, null, null],
        coursePlan: [],
        ignoredErrors: {}
    },
    scheduleConfig: { mode: "full-time" },
    refreshStudyPlan: vi.fn(),
    importSchedule: vi.fn(),
    getSelectedPathwayCode: vi.fn(),
    getCode: vi.fn(),
    fetch: vi.fn(),
    prompt: vi.fn(),
    alert: vi.fn(),
    elements: {},
    createdElements: [],
    lastReadFile: null,
    readPromise: null
}));

// Isolate template UI behaviour from rendering and file import internals.
vi.mock("../javascript/app.js", () => ({
    refreshStudyPlan: mockData.refreshStudyPlan
}));

vi.mock("../javascript/state.js", () => ({
    state: mockData.state,
    scheduleConfig: mockData.scheduleConfig
}));

vi.mock("../javascript/fileHandler.js", () => ({
    importSchedule: mockData.importSchedule,
    getSelectedPathwayCode: mockData.getSelectedPathwayCode,
    getCode: mockData.getCode
}));

// Create the subset of element behaviour used by the templates controller.
function makeElement(id = "") {
    const listeners = {};
    let html = "";

    return {
        id,
        open: false,
        files: [],
        type: "",
        textContent: "",
        style: {},
        children: [],
        listeners,
        addEventListener: vi.fn((event, handler) => {
            listeners[event] = handler;
        }),
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        showModal: vi.fn(function () {
            this.open = true;
        }),
        close: vi.fn(function () {
            this.open = false;
        }),
        async trigger(eventName, overrides = {}) {
            const event = {
                currentTarget: this,
                target: this,
                preventDefault: vi.fn(),
                ...overrides
            };
            await listeners[eventName]?.(event);
            return event;
        },
        get innerHTML() {
            return html;
        },
        set innerHTML(value) {
            html = value;
            this.children = [];
        }
    };
}

function makeResponse(data, ok = true) {
    return {
        ok,
        json: vi.fn().mockResolvedValue(data)
    };
}

// Access a named element from the fake document more readably in tests.
function element(id) {
    return mockData.elements[id];
}

beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    const ids = [
        "templates",
        "openTemplates",
        "closeTemplates",
        "templateBtnContainer",
        "saveModal",
        "openSave",
        "closeSaveModal",
        "editorModal",
        "openEditor",
        "closeEditorModal",
        "localJsonFileInput",
        "uploadTemplateForm",
        "saveTemplateBtn"
    ];
    mockData.elements = Object.fromEntries(
        ids.map(id => [id, makeElement(id)])
    );
    mockData.createdElements = [];
    mockData.lastReadFile = null;
    mockData.readPromise = null;

    mockData.state.selectedMajors = [null, null];
    mockData.state.selectedMinors = [null, null];
    mockData.state.selectedElectives = [null, null, null, null];
    mockData.state.coursePlan = [Array(4).fill(null)];
    mockData.state.ignoredErrors = {};
    mockData.scheduleConfig.mode = "full-time";

    mockData.refreshStudyPlan.mockResolvedValue(undefined);
    mockData.getSelectedPathwayCode.mockReturnValue("electives");
    mockData.getCode.mockImplementation(value => {
        if (value === null || value === undefined || value === "") return null;
        if (typeof value === "string") return value;
        return value.Code ?? value.code ?? null;
    });
    mockData.prompt.mockReturnValue(null);
    mockData.fetch.mockImplementation(async path => {
        if (path === "./php/get_templates.php") {
            return makeResponse([]);
        }
        if (path === "./php/save_template.php") {
            return makeResponse({ message: "Template saved." });
        }
        throw new Error(`Unexpected request: ${path}`);
    });

    vi.stubGlobal("document", {
        readyState: "complete",
        getElementById: vi.fn(id => mockData.elements[id] ?? null),
        createElement: vi.fn(() => {
            const created = makeElement();
            mockData.createdElements.push(created);
            return created;
        })
    });
    vi.stubGlobal("fetch", mockData.fetch);
    vi.stubGlobal("prompt", mockData.prompt);
    vi.stubGlobal("alert", mockData.alert);
    vi.stubGlobal("FileReader", class MockFileReader {
        readAsText(file) {
            mockData.lastReadFile = file;
            mockData.readPromise = Promise.resolve(
                this.onload({ target: { result: file.contents } })
            );
        }
    });

    // Importing the module initializes and binds all controller events.
    await import("../javascript/templatesController.js");
});

describe("template dialogs", () => {
    // Each open and close control should operate its corresponding dialog.
    test("opens and closes the templates, save, and editor dialogs", async () => {
        await element("openTemplates").trigger("click");
        expect(element("templates").showModal).toHaveBeenCalledOnce();
        expect(element("templates").open).toBe(true);
        await vi.waitFor(() => {
            expect(mockData.fetch).toHaveBeenCalledWith(
                "./php/get_templates.php"
            );
        });

        await element("closeTemplates").trigger("click");
        expect(element("templates").open).toBe(false);

        await element("openSave").trigger("click");
        expect(element("saveModal").open).toBe(true);
        await element("closeSaveModal").trigger("click");
        expect(element("saveModal").open).toBe(false);

        await element("openEditor").trigger("click");
        expect(element("editorModal").open).toBe(true);
        await element("closeEditorModal").trigger("click");
        expect(element("editorModal").open).toBe(false);
    });
});

describe("server template list", () => {
    // Server entries should become buttons that import and render their files.
    test("loads a listed template when its generated button is clicked", async () => {
        const templateData = {
            selectedPathway: "electives",
            schedule: []
        };
        mockData.fetch.mockImplementation(async path => {
            if (path === "./php/get_templates.php") {
                return makeResponse([{
                    display_name: "Example Plan",
                    filepath: "./json/templates/example.json"
                }]);
            }
            if (path === "./json/templates/example.json") {
                return makeResponse(templateData);
            }
            throw new Error(`Unexpected request: ${path}`);
        });

        await element("openTemplates").trigger("click");
        await vi.waitFor(() => {
            expect(element("templateBtnContainer").children).toHaveLength(1);
        });
        const templateButton = element("templateBtnContainer").children[0];
        expect(templateButton).toMatchObject({
            type: "button",
            textContent: "Example Plan"
        });

        await templateButton.trigger("click");

        expect(mockData.importSchedule).toHaveBeenCalledWith(templateData);
        expect(mockData.refreshStudyPlan).toHaveBeenCalledOnce();
        expect(element("templates").close).toHaveBeenCalledOnce();
        expect(element("templates").open).toBe(false);
    });

    // An empty server directory should give the user a clear empty state.
    test("shows a message when the server has no templates", async () => {
        await element("openTemplates").trigger("click");

        await vi.waitFor(() => {
            expect(element("templateBtnContainer").innerHTML).toContain(
                "No templates found."
            );
        });
        expect(element("templateBtnContainer").children).toHaveLength(0);
    });

    // Invalid scanner data should be handled as a server communication error.
    test("shows an error when the template scanner returns invalid data", async () => {
        mockData.fetch.mockResolvedValue(makeResponse({ files: [] }));

        await element("openTemplates").trigger("click");

        await vi.waitFor(() => {
            expect(element("templateBtnContainer").innerHTML).toContain(
                "Error connecting to templates folder."
            );
        });
        expect(console.error).toHaveBeenCalledWith(
            "Error communicating with template scanner:",
            expect.any(Error)
        );
    });

    // A missing or invalid individual file should not alter the current plan.
    test("reports a template file that cannot be loaded", async () => {
        mockData.fetch.mockImplementation(async path => {
            if (path === "./php/get_templates.php") {
                return makeResponse([{
                    display_name: "Broken Plan",
                    filepath: "./json/templates/missing.json"
                }]);
            }
            return makeResponse({ error: "Not found" }, false);
        });

        await element("openTemplates").trigger("click");
        await vi.waitFor(() => {
            expect(element("templateBtnContainer").children).toHaveLength(1);
        });
        await element("templateBtnContainer").children[0].trigger("click");

        expect(mockData.importSchedule).not.toHaveBeenCalled();
        expect(mockData.refreshStudyPlan).not.toHaveBeenCalled();
        expect(mockData.alert).toHaveBeenCalledWith(
            "Incompatible template: Could not load template file."
        );
    });
});

describe("saving templates", () => {
    // Saving should convert state objects to codes and send the complete plan.
    test("posts the current study plan using the requested filename", async () => {
        mockData.prompt.mockReturnValue("My Plan");
        mockData.state.selectedMajors = [{ Code: "MajorA" }, null];
        mockData.state.selectedMinors = [{ Code: "MinorA" }, null];
        mockData.state.selectedElectives = [
            "COMP700",
            { code: "COMP701" },
            null,
            null
        ];
        mockData.state.coursePlan = [[
            { code: "COMP500" },
            null,
            { code: "COMP600" },
            null
        ]];
        mockData.state.ignoredErrors = { ExampleError: "Approved" };
        mockData.scheduleConfig.mode = "part-time";

        await element("saveTemplateBtn").trigger("click");

        expect(mockData.fetch).toHaveBeenCalledOnce();
        const [path, options] = mockData.fetch.mock.calls[0];
        expect(path).toBe("./php/save_template.php");
        expect(options).toMatchObject({
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });
        expect(JSON.parse(options.body)).toEqual({
            filename: "My Plan",
            selectedPathway: "electives",
            selectedMajors: ["MajorA", null],
            selectedMinors: ["MinorA", null],
            selectedElectives: ["COMP700", "COMP701", null, null],
            schedule: [["COMP500", null, "COMP600", null]],
            mode: "part-time",
            ignoredErrors: { ExampleError: "Approved" }
        });
        expect(mockData.alert).toHaveBeenCalledWith("Template saved.");
    });

    // Cancelling the filename prompt should stop before any server request.
    test("does not save when the filename prompt is cancelled", async () => {
        mockData.prompt.mockReturnValue(null);

        await element("saveTemplateBtn").trigger("click");

        expect(mockData.fetch).not.toHaveBeenCalled();
        expect(mockData.alert).not.toHaveBeenCalled();
    });

    // Templates require a pathway because it determines their option layout.
    test("does not save when no pathway is selected", async () => {
        mockData.prompt.mockReturnValue("Incomplete Plan");
        mockData.getSelectedPathwayCode.mockReturnValue(null);

        await element("saveTemplateBtn").trigger("click");

        expect(mockData.fetch).not.toHaveBeenCalled();
        expect(mockData.alert).toHaveBeenCalledWith(
            "Please select a pathway before saving a template."
        );
    });

    // Server errors should be presented without escaping the click handler.
    test("reports a failed server save", async () => {
        mockData.prompt.mockReturnValue("Duplicate Plan");
        mockData.fetch.mockResolvedValue(
            makeResponse({ error: "That filename already exists." }, false)
        );

        await element("saveTemplateBtn").trigger("click");

        expect(mockData.alert).toHaveBeenCalledWith(
            "Failed to save: That filename already exists."
        );
        expect(console.error).toHaveBeenCalledWith(
            "Save Operation Error:",
            expect.any(Error)
        );
    });
});

describe("local template uploads", () => {
    // Submitting without a selected file should produce a validation message.
    test("rejects an upload when no local file is selected", async () => {
        const submitEvent = await element("uploadTemplateForm").trigger(
            "submit"
        );

        expect(submitEvent.preventDefault).toHaveBeenCalledOnce();
        expect(mockData.alert).toHaveBeenCalledWith(
            "Please select a valid JSON template file first."
        );
        expect(mockData.importSchedule).not.toHaveBeenCalled();
    });

    // A valid local JSON file should be parsed, imported, and rendered.
    test("imports a valid local template file", async () => {
        const templateData = {
            selectedPathway: "doubleMajors",
            schedule: [["COMP500"]]
        };
        const file = { contents: JSON.stringify(templateData) };
        element("localJsonFileInput").files = [file];
        element("templates").open = true;

        await element("uploadTemplateForm").trigger("submit");
        await mockData.readPromise;

        expect(mockData.lastReadFile).toBe(file);
        expect(mockData.importSchedule).toHaveBeenCalledWith(templateData);
        expect(mockData.refreshStudyPlan).toHaveBeenCalledOnce();
        expect(element("templates").close).toHaveBeenCalledOnce();
    });

    // Malformed local JSON should be rejected without refreshing the plan.
    test("reports malformed JSON in a local template", async () => {
        element("localJsonFileInput").files = [{
            contents: "{not valid JSON"
        }];

        await element("uploadTemplateForm").trigger("submit");
        await mockData.readPromise;

        expect(mockData.importSchedule).not.toHaveBeenCalled();
        expect(mockData.refreshStudyPlan).not.toHaveBeenCalled();
        expect(mockData.alert).toHaveBeenCalledWith(
            expect.stringContaining("Invalid template:")
        );
    });
});
