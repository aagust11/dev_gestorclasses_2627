export const uiconStyles:Record<string,string>={rr:'regular-rounded',br:'bold-rounded',sr:'solid-rounded',tr:'thin-rounded',rs:'regular-straight',bs:'bold-straight',ss:'solid-straight',ts:'thin-straight',brands:'brands'};
export function parseUicon(raw:string):string|null{
 let value=raw.trim();
 const html=value.match(/^<i\s+class\s*=\s*["']([^"']+)["']\s*>\s*<\/i>$/i);
 if(html)value=html[1];
 const match=value.match(/^(?:fi\s+)?fi-(rr|br|sr|tr|rs|bs|ss|ts|brands)-([a-z0-9]+(?:-[a-z0-9]+)*)$/);
 return match?'fi fi-'+match[1]+'-'+match[2]:null;
}
