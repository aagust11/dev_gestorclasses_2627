import React from 'react';
import {RecoverySettings} from '../types';
import {policyNames} from '../utils/recoveryModel';
export default function RecoverySettingsFields({value,onChange}:{value:RecoverySettings;onChange:(value:RecoverySettings)=>void}){
 return <fieldset className="ds-panel space-y-3"><legend className="font-bold">Recuperacions</legend>
 <label className="flex gap-2"><input type="checkbox" checked={value.enabled} onChange={e=>onChange({...value,enabled:e.target.checked})}/>Activar recuperacions</label>
 <label className="ds-field">Política<select value={value.policy} onChange={e=>onChange({...value,policy:e.target.value as RecoverySettings['policy']})}>{Object.entries(policyNames).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
 {([['applyToNA','Aplicar també als NA inicials (si no, només als NP)'],['afterClosureOnly','Aplicar penalització només després del tancament d’una avaluació que inclogui l’activitat'],['allowExceptions','Permetre excepcions justificades sense penalització'],['updateOpenPeriods','Aplicar els nous intents als períodes encara oberts']] as const).map(([key,label])=><label key={key} className="flex gap-2 text-sm"><input type="checkbox" checked={value[key]} onChange={e=>onChange({...value,[key]:e.target.checked})}/>{label}</label>)}
 <p className="text-xs text-slate-500">Les qualificacions originals i els intents es conserven sempre. Els canvis de política només s’apliquen als intents nous. AE → AN, AN → AS, AS → AS, NA → NA.</p>
 </fieldset>;
}
