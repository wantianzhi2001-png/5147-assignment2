"""Rebuild compact browser data from the original supplied NPI CSVs (Python stdlib only)."""
import csv, json, math
from pathlib import Path
from collections import defaultdict
ROOT=Path(__file__).resolve().parent
RAW=ROOT.parent/'NPI_RawData_Sample'/'raw_data'
def rows(name):
    return csv.DictReader((RAW/name).open(encoding='utf-8-sig',newline=''))
sub={r['substance_id']:r for r in rows('substances.csv')}
reports={r['report_id']:r['report_url'] for r in rows('reports.csv')}
annual=defaultdict(float); names={}; facilities={}; substances=defaultdict(lambda:defaultdict(float)); mixes=defaultdict(float); counts=defaultdict(lambda:[0,0]); totals=defaultdict(float)
checks={'raw':0,'period':0,'eligible':0,'usable':0}
for r in rows('emissions.csv'):
    checks['raw']+=1
    year=int(r['report_year'][:4])
    if not 2007<=year<=2024: continue
    checks['period']+=1
    sid=r['substance_id']; code=r['primary_anzsic_class_code']
    if sub[sid]['emissions_to_air'].lower()!='true':continue
    checks['eligible']+=1
    try:v=float(r['air_total_emission_kg'])/1000
    except ValueError:v=float('nan')
    if year==2024: counts[(code,sid)][0 if math.isfinite(v) else 1]+=1
    if not math.isfinite(v):continue
    assert v>=0
    checks['usable']+=1
    if code and r['primary_anzsic_class_name']:
        annual[(code,year)]+=v; names[code]=r['primary_anzsic_class_name']
    if year!=2024:continue
    fid=r['facility_id']
    old=facilities.get(fid,{}).get('emissions_tonnes',0)
    def number(k):
        try: return float(r[k]) if math.isfinite(float(r[k])) else None
        except ValueError:return None
    facilities[fid]=dict(facility_id=fid,facility=r['facility_name'],industry_code=code,industry=r['primary_anzsic_class_name'],state=r['state'],latitude=number('latitude'),longitude=number('longitude'),emissions_tonnes=old+v,report_url=reports.get(r['report_id'],''))
    substances[fid][sid]+=v; mixes[(code,sid)]+=v; totals[code]+=v
rank=defaultdict(float)
for (c,y),v in annual.items():rank[c]+=v
codes=sorted(rank,key=lambda c:(-rank[c],c))[:6]
short=dict(zip(['2611','0600','2133','0801','2110','2132'],['Fossil fuel power','Coal mining','Metal smelting & refining','Iron ore mining','Iron & steel','Aluminium smelting']))
label=lambda c:short.get(c,names.get(c,c))
trends=[dict(industry=label(c),year=f'{y}/{str(y+1)[2:]}',emissions_tonnes=annual.get((c,y),0)) for c in codes for y in range(2007,2025)]
fs=sorted(facilities.values(),key=lambda f:(-f['emissions_tonnes'],f['facility_id']))
for f in fs:
    f['industry']=label(f['industry_code']) if f['industry_code'] in codes else f['industry']
    f['substances']=[dict(name=sub[s]['substance_name'],tonnes=v) for s,v in sorted(substances[f['facility_id']].items(),key=lambda p:-p[1])]
pollutants=dict(zip(['20','77','69','8','50','51'],['CO','SO2','NOx','NH3','HCl','H2S']))
mix=[dict(industry=label(c),pollutant=p,name=sub[s]['substance_name'],emissions_tonnes=mixes.get((c,s)) if counts[(c,s)][0] else None,usable=counts[(c,s)][0],missing=counts[(c,s)][1]) for c in codes for s,p in pollutants.items()]
coverage=[dict(industry=label(c),all_reported_tonnes=totals[c],selected_tonnes=sum(mixes.get((c,s),0) for s in pollutants)) for c in codes]
out=dict(trends=trends,facilities=fs,mix=mix,coverage=coverage,checks=checks)
(ROOT/'data'/'npi.json').write_text(json.dumps(out,separators=(',',':'),allow_nan=False),encoding='utf-8')
# A script wrapper also supports opening index.html directly without a server.
(ROOT/'data'/'npi.js').write_text('window.NPI_DATA='+json.dumps(out,separators=(',',':'),allow_nan=False)+';\nwindow.NPI_BOUNDARY='+ (ROOT/'data'/'australia_boundary.geojson').read_text()+';',encoding='utf-8')
print(checks, 'facilities:',len(fs),'top 1%:',sum(f['emissions_tonnes'] for f in fs[:math.ceil(len(fs)*.01)])/sum(f['emissions_tonnes'] for f in fs))
