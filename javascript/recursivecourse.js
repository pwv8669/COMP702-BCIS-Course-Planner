import { placeCourse } from "./app.js";
import { state } from "./state.js";
import { loadCourses } from "./courseObjectConverter.js";
import { renderCoursePlan } from "./renderCoursePlan.js";
export async function placeCourseRecursive(semester,code){
	let coursemap = await loadCourses();

    let placedrow = 0;
    let placedcol = 0;

    const SEMESTERS = {
        FIRST: 1,
        SECOND: 0
    }
    let semesterplacement= 1;//this is just so i can understand how to code this better
    if(semester % 2 == 0){//if its even, automatically assume its the second semester of a given year
        semesterplacement = 0;
    }

    let placed = false;

    for(let col = 0; col < 4;col++){//go through all 4 cells
        if(state.coursePlan[semester-1][col] == undefined){//if empty
            placeCourse(semester-1,col,code);//place course there
            placedrow = semester-1;
            placedcol = col;
            placed = true;
            break;
        }
    }


    if(placed == false && semesterplacement == 1){//if couldnt place and semester placement is first
        for(let col = 0; col < 4;col++){
            if(state.coursePlan[semester][col] == undefined){//try place it in the second semester of the year
                    placeCourse(semester,col,code);//place course
                    placedrow = semester;
                    placedcol = col;
                    placed = true;
                    break;
            }
        }
    }
    
    if(placed){//if placed, we want to check if theres any prerequisites we should add
        renderCoursePlan(state);
        let Prerequesitearray = [];
        let shouldplace = false;
        try{
            let prerequisitelist = coursemap[code].prerequisites;
                //console.log("list" +  coursemap[code].name);
            if(prerequisitelist.type == 'COURSE'){
                Prerequesitearray.push(prerequisitelist.course.code);
            }
            if(prerequisitelist.type == 'AND'){
                for(let p = 0; p < prerequisitelist.children.length;p++){//go through all values 
                    Prerequesitearray.push(prerequisitelist.children[p].value);//add them to the prereq array
                }
                
            }
            if(code == "COMP702"){
                semester = 2;
            }
            
            for(let add = 0; add < Prerequesitearray.length;add++){
                let found = false;
                //CHECK IF ALREADY IN STATE ARRAY
                for(let c =0;c< state.coursePlan.length;c++){
                    for(let d = 0; d < state.coursePlan[c].length;d++){
                        if(state.coursePlan[c][d] != undefined){
                            if(state.coursePlan[c][d].code == Prerequesitearray[add]){
                                console.log(state.coursePlan[c][d].code + "already present!");
                                if(semester-1== c){
                                    console.log("same semester!");
                                    state.coursePlan[c][d] = null;
                                    state.coursePlan[placedrow][placedcol] = null;
                                    found = true;
                                    await placeCourseRecursive(semester,code);
                                }
                                else{
                                    found = true;
                                }
                               
                                break;
                            }
                            else{
                                console.log(state.coursePlan[c][d].code + " PReq" + Prerequesitearray[add]);
                            }
                        }
                       
                    }
                   
                }
                if(found){
                    break;
                }

                //console.log("cehckchechk" + Prerequesitearray[add]);
                if(coursemap[Prerequesitearray[add]].level < coursemap[code].level//if not the same level, add to previous year
                    && code != "COMP702"
                ){
                    if(semesterplacement ==1){//if first semester, we can put in the previous semester
                        await placeCourseRecursive(semester-1,Prerequesitearray[add]);
                    }
                    else{
                        await placeCourseRecursive(semester-2,Prerequesitearray[add]);//else jump back further
                    }
                   
                }
                else{
                    await placeCourseRecursive(semester-1,Prerequesitearray[add]);
                }
               
                
            }
        }
        catch{

        }
    }

    return placed;
	// if(semester == -1)//if autoplace
	// {
	// 	switch(coursemap[code].level){//get level and assume semester based on that
	// 		case 5:
	// 			semester = 1;//start at semester 1
	// 			break;
	// 		case 6:
	// 			semester = 3;//start at semester 2
	// 			break;
	// 		case 7:
	// 			semester = 5;//start at semester 3
	// 			break;
	// 	}




	// }
	
	// let semestertostart = semester-1;//go to corressponding row
	// if(semester != 6 && (semestertostart % 2) != 0){
	// 	semestertostart -= 1;
	// }
	// if(code == 'COMP702'){
	// 	semestertostart-=1;
	// }	
	// 		for(let col = 0;col < 8;col++){//every 4 columns, add an additional row

	// 			if(state.coursePlan[(semestertostart) + Math.floor(col/4)][col%4] == undefined){//every 4 columns, itll wrap back around to 0
	// 				try{
						
	// 					console.log(prerequisitelist);
	// 					if(prerequisitelist.type == 'COURSE'){
	// 						console.log('course');
	// 						let semesterback = semestertostart - (coursemap[code].level - prerequisitelist.course.level)+1;
	// 						await placeCourseRecursive(-1,prerequisitelist.course.code);
	// 						if(semesterback == semestertostart){	
	// 							col+= 4;
	// 						}
	// 					}
	// 					if(prerequisitelist.type == 'AND'){
	// 						for(let p = 0; p < prerequisitelist.children.length;p++){
	// 							console.log("test" + prerequisitelist.children[p].value);
	// 							let semesterback = semestertostart - (coursemap[code].level - prerequisitelist.children[p].course.level)+1;
	// 							console.log("BACKAND"+semesterback);
	// 							await placeCourseRecursive(-1,prerequisitelist.children[p].value);
	// 							if(semesterback == semestertostart){	
	// 								col+= 4;
	// 							}
								
	// 						}
	// 					}
						
	// 				}
	// 				catch{
	// 				}
	// 				console.log("adding" + code + "at "+((semestertostart) + Math.floor(col/4)));
	// 				await placeCourse([(semestertostart) + Math.floor(col/4)],[col%4],code);
	// 			}
	// 			break;	
	// 		}
}