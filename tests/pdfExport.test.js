import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const plannerHtml = readFileSync(new URL("../BCISCoursePlanner.html", import.meta.url), "utf8");
const pdfScript = plannerHtml.match(
    /<script defer>\s*([\s\S]*?async function exportPlanAsPdf[\s\S]*?)<\/script>/
)?.[1];

/*
loadExportPlanAsPdf: Loads the export function with test dependencies.
Inputs: table (object), html2canvas (function), jsPDF (function),
alert (function)
Outputs: export dependencies (object)
Reads the function from the planner HTML so the shipped code is tested.
*/
function loadExportPlanAsPdf({ table, html2canvas, jsPDF, alert = vi.fn() }) {
    const document = {
        querySelector: vi.fn(() => table)
    };
    const window = {
        alert,
        html2canvas,
        jspdf: { jsPDF }
    };
    const factory = new Function(
        "document",
        "window",
        `${pdfScript}\nreturn exportPlanAsPdf;`
    );

    return {
        exportPlanAsPdf: factory(document, window),
        alert,
        document
    };
}

describe("PDF export", () => {
    it("loads the browser libraries used by the export", () => {
        expect(plannerHtml).toContain("jspdf/2.5.1/jspdf.umd.min.js");
        expect(plannerHtml).toContain("html2canvas/1.4.1/html2canvas.min.js");
        expect(pdfScript).toBeTruthy();
    });

    it("renders the schedule table and downloads a PDF", async () => {
        const table = { offsetWidth: 600, offsetHeight: 450 };
        const canvas = { toDataURL: vi.fn(() => "data:image/jpeg;base64,plan") };
        const html2canvas = vi.fn(async () => canvas);
        const pdf = {
            addImage: vi.fn(),
            addPage: vi.fn(),
            save: vi.fn()
        };
        const jsPDF = vi.fn(function pdfConstructor() {
            return pdf;
        });
        const { exportPlanAsPdf, alert, document } = loadExportPlanAsPdf({
            table,
            html2canvas,
            jsPDF
        });

        await exportPlanAsPdf();

        expect(document.querySelector).toHaveBeenCalledWith(".schedule-table");
        expect(html2canvas).toHaveBeenCalledWith(table, { allowTaint: true });
        expect(jsPDF).toHaveBeenCalledWith("p", "pt", [630, 975]);
        expect(pdf.addImage).toHaveBeenCalledWith(
            "data:image/jpeg;base64,plan",
            "JPG",
            15,
            15,
            600,
            450
        );
        expect(pdf.save).toHaveBeenCalledWith("Study Plan.pdf");
        expect(alert).not.toHaveBeenCalled();
    });

    it("shows a useful message if an export library is unavailable", async () => {
        const { exportPlanAsPdf, alert } = loadExportPlanAsPdf({
            table: { offsetWidth: 600, offsetHeight: 450 },
            html2canvas: undefined,
            jsPDF: vi.fn()
        });

        await exportPlanAsPdf();

        expect(alert).toHaveBeenCalledWith(
            "PDF export is unavailable. Please refresh the page and try again."
        );
    });
});
