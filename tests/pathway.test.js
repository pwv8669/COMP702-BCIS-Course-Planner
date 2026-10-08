// Unit tests for pathway construction and JSON loading.

import {
    afterEach,
    describe,
    expect,
    test,
    vi
} from "vitest";
import {
    loadPathways,
    Pathway
} from "../javascript/objects/pathway.js";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("Pathway", () => {
    // JSON numeric strings should become numbers used by pathway management.
    test("constructs a pathway with numeric option counts", () => {
        const pathway = new Pathway({
            name: "Major, Minor and Electives",
            numMajors: "1",
            numMinors: "1",
            numElectives: "4"
        });

        expect(pathway).toEqual({
            name: "Major, Minor and Electives",
            numMajors: 1,
            numMinors: 1,
            numElectives: 4
        });
    });
});

describe("loadPathways", () => {
    // Every keyed JSON record should become a Pathway instance.
    test("loads and converts all pathway records", async () => {
        const data = {
            doubleMajors: {
                name: "Double Majors",
                numMajors: 2,
                numMinors: 0,
                numElectives: 0
            },
            electives: {
                name: "Major, Minor and Electives",
                numMajors: 1,
                numMinors: 1,
                numElectives: 4
            }
        };
        const json = vi.fn().mockResolvedValue(data);
        const fetchMock = vi.fn().mockResolvedValue({ json });
        vi.stubGlobal("fetch", fetchMock);

        const pathways = await loadPathways();

        expect(fetchMock).toHaveBeenCalledWith("json/pathways.json");
        expect(json).toHaveBeenCalledOnce();
        expect(Object.keys(pathways)).toEqual([
            "doubleMajors",
            "electives"
        ]);
        expect(pathways.doubleMajors).toBeInstanceOf(Pathway);
        expect(pathways.electives).toBeInstanceOf(Pathway);
        expect(pathways.electives.numElectives).toBe(4);
    });

    // An empty source object should produce an empty pathway lookup.
    test("loads an empty pathway collection", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            json: vi.fn().mockResolvedValue({})
        }));

        await expect(loadPathways()).resolves.toEqual({});
    });

    // A failed request should remain visible to initialization code.
    test("propagates a pathway-data request failure", async () => {
        const requestError = new Error("Pathways unavailable");
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(requestError));

        await expect(loadPathways()).rejects.toBe(requestError);
    });
});
