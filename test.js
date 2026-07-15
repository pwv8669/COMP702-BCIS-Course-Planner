import { loadMajorOptions, loadMinorOptions } from "./javascript/objects/majorMinorOption.js";

async function testLoadMajorOptions() {
    const majors = await loadMajorOptions();
    console.log(majors);
}

async function testLoadMinorOptions() {
    const minors = await loadMinorOptions();
    console.log(minors);
}

testLoadMajorOptions();
testLoadMinorOptions();