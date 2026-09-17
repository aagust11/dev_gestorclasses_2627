import {TestScoring,TestAnswers} from '../types';
export const DEFAULT_TEST:TestScoring={questions:10,correct:1,blank:0,incorrect:-0.25};
export function validTestConfig(c:TestScoring){return Number.isSafeInteger(c.questions)&&c.questions>0&&c.questions<=100000&&[c.correct,c.blank,c.incorrect].every(Number.isFinite)&&c.correct>0&&c.blank<=c.correct&&c.incorrect<=c.correct&&Number.isFinite(c.questions*c.correct);}
export function testResult(answers:TestAnswers|undefined,config:TestScoring=DEFAULT_TEST){
 if(!answers||!validTestConfig(config)||![answers.correct,answers.blank,answers.incorrect].every(n=>Number.isSafeInteger(n)&&n>=0))return null;
 const answered=answers.correct+answers.blank+answers.incorrect;
 if(answered!==config.questions)return null;
 const raw=answers.correct*config.correct+answers.blank*config.blank+answers.incorrect*config.incorrect;
 if(!Number.isFinite(raw))return null;
 const max=config.questions*config.correct,score=Math.max(0,Math.min(max,raw));
 return {raw,score,max,normalized:score/max*4};
}
