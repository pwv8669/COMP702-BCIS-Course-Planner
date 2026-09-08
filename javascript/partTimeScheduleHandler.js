export async function initPartTime()
{
    const partTimeButton = document.getElementById('partTimeButton');

    partTimeButton.addEventListener('click', () => {
        switchSchedule();
    });

}

function switchSchedule()
{
    //add a toggle that changes the icon/text so that the button displays "full-time schedule" if the study plan is set to parttime mode
    const partTimeHeader = document.getElementById('partTimeHeader');
    const cellIDs = [];



    if (partTimeHeader.style.display == "none")
    {
        partTimeHeader.style.display = "table-row";
        cellIDs.push(document.getElementById('cell-0-2'));
        cellIDs.push(document.getElementById('cell-1-2'));
        cellIDs.push(document.getElementById('cell-2-2'));
        cellIDs.push(document.getElementById('cell-3-2'));
        cellIDs.push(document.getElementById('cell-4-2'));
        cellIDs.push(document.getElementById('cell-5-2'));

        cellIDs.push(document.getElementById('cell-0-3'));
        cellIDs.push(document.getElementById('cell-1-3'));
        cellIDs.push(document.getElementById('cell-2-3'));
        cellIDs.push(document.getElementById('cell-3-3'));
        cellIDs.push(document.getElementById('cell-4-3'));
        cellIDs.push(document.getElementById('cell-5-3'));

        cellIDs[0].id = "cell-6-0";
        cellIDs[1].id = "cell-7-0";
        cellIDs[2].id = "cell-8-0";
        cellIDs[3].id = "cell-9-0";
        cellIDs[4].id = "cell-10-0";
        cellIDs[5].id = "cell-11-0";

        cellIDs[6].id = "cell-6-1";
        cellIDs[7].id = "cell-7-1";
        cellIDs[8].id = "cell-8-1";
        cellIDs[9].id = "cell-9-1";
        cellIDs[10].id = "cell-10-1";
        cellIDs[11].id = "cell-11-1";
        

}
else
{
    partTimeHeader.style.display = "none";

    cellIDs.push(document.getElementById('cell-6-0'));
    cellIDs.push(document.getElementById('cell-7-0'));
    cellIDs.push(document.getElementById('cell-8-0'));
    cellIDs.push(document.getElementById('cell-9-0'));
    cellIDs.push(document.getElementById('cell-10-0'));
    cellIDs.push(document.getElementById('cell-11-0'));

    cellIDs.push(document.getElementById('cell-6-1'));
    cellIDs.push(document.getElementById('cell-7-1'));
    cellIDs.push(document.getElementById('cell-8-1'));
    cellIDs.push(document.getElementById('cell-9-1'));
    cellIDs.push(document.getElementById('cell-10-1'));
    cellIDs.push(document.getElementById('cell-11-1'));

    cellIDs[0].id = "cell-0-2";
    cellIDs[1].id = "cell-1-2";
    cellIDs[2].id = "cell-2-2";
    cellIDs[3].id = "cell-3-2";
    cellIDs[4].id = "cell-4-2";
    cellIDs[5].id = "cell-5-2";

    cellIDs[6].id = "cell-0-3";
    cellIDs[7].id = "cell-1-3";
    cellIDs[8].id = "cell-2-3";
    cellIDs[9].id = "cell-3-3";
    cellIDs[10].id = "cell-4-3";
    cellIDs[11].id = "cell-5-3";
}
}