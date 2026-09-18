import {AppState} from '../types';
/** Present both legacy public fields without discarding either on load. */
export function studentInformation(profile?:{notes?:string;additionalComments?:string}):string{
 return [profile?.notes,profile?.additionalComments].filter((text):text is string=>typeof text==='string'&&text.length>0).join('\n\n');
}
export function updateStudentInformation(state:AppState,id:string,text:string):AppState{
 return {...state,studentProfiles:{...state.studentProfiles,[id]:{...state.studentProfiles?.[id],notes:text,additionalComments:''}}};
}
