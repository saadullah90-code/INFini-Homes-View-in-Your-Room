import { useEffect, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { Activity, ArrowDownRight, ArrowLeft, ArrowRight, Box, Check, CheckCircle2, ChevronRight, CircleAlert, Clock3, Cloud, Copy, Database, ExternalLink, Eye, FileClock, Filter, Grid2X2, Layers3, LayoutDashboard, Package, Play, RefreshCw, Search, Settings2, ShieldAlert, ShieldCheck, SlidersHorizontal, Sparkles, Store, UploadCloud, X, XCircle } from 'lucide-react';
import {
  useHealthCheck, useListProducts, useGetProduct, useRecheckProductEligibility, useListModels, useGetModel,
  useGenerateModel, useApproveModel, useRejectModel, usePublishModel, useUnpublishModel,
  useListQueueJobs, useGetSettings, useUpdateSettings, useGetApiStatus, useListLogs, useGetArExperience,
  useGetLiquidSource, useGetStorefrontConnectionStatus, useGetPublicCatalogStatus, useSyncPublicCatalog,
  getHealthCheckQueryKey, getListProductsQueryKey, getGetProductQueryKey, getListModelsQueryKey,
  getGetModelQueryKey, getListQueueJobsQueryKey, getGetSettingsQueryKey, getGetApiStatusQueryKey,
  getListLogsQueryKey, getGetArExperienceQueryKey, getGetStorefrontConnectionStatusQueryKey, getGetPublicCatalogStatusQueryKey,
  type Product, type ProductModel, type ProductModelStatus, type ProviderStatus, type SettingsUpdateDefaultUnit
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { AdminConsoleButton } from '@/components/admin-console';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 25000, refetchOnWindowFocus: false } } });
const stages: ProductModelStatus[] = ['PENDING','ELIGIBLE','QUEUED','PROCESSING','GENERATED','OPTIMIZING','DIMENSION_CALIBRATION','REVIEW','APPROVED','PUBLISHED','FAILED','CANCELLED','STALE'];
const stageNames: Record<string,string> = { DIMENSION_CALIBRATION:'Calibration' };
function pretty(s: string) { return stageNames[s] || s.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()); }
function date(s?: string | null) { return s ? new Date(s).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : '—'; }
function time(s?: string | null) { return s ? new Date(s).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '—'; }
function errorText(e: unknown) { const err = e as {status?:number;statusText?:string;data?:{message?:string;error?:string};message?:string}; return err?.data?.error || err?.data?.message || err?.message || (err?.status ? `${err.status} ${err.statusText || 'Request failed'}` : 'Something went wrong. Please try again.'); }
function tone(s: string) { if (['PUBLISHED','APPROVED','GENERATED','live','info','shopify','prepared'].includes(s)) return 'green'; if (['REVIEW','PROCESSING','OPTIMIZING','DIMENSION_CALIBRATION','QUEUED'].includes(s)) return 'teal'; if (['FAILED','CANCELLED','error','unavailable'].includes(s)) return 'red'; if (['STALE','warn','ELIGIBLE'].includes(s)) return 'amber'; if (s==='mock'||s==='sample') return 'blue'; return 'gray'; }
function providerLabel(provider: string) { return provider === 'prepared' ? 'Prepared model' : provider === 'mock' ? 'Mock demo' : 'Meshy'; }
function productSourceLabel(source: string) { return source==='sample'?'Sample data':source==='storefront'?'Public storefront / catalog':source==='shopify'?'Shopify Admin sync':source; }
function Badge({value,label}:{value:string;label?:string}) { return <span className={`badge badge-${tone(value)}`} data-testid={`status-${value.toLowerCase()}`}>{label || pretty(value)}</span>; }
function Thumb({url,title}:{url?:string|null;title?:string}) { return url ? <img className="thumb" src={url} alt={title || 'Product image'} /> : <div className="thumb"><Box size={18}/></div>; }
function Empty({title,description,icon:Icon=Box}:{title:string;description:string;icon?:typeof Box}) { return <div className="empty"><Icon size={29} strokeWidth={1.5}/><h3>{title}</h3><p>{description}</p></div>; }
function Load() { return <div className="panel loading-panel">{[75,48,90,68].map((w,i)=><div key={i} className="skeleton" style={{width:`${w}%`,height:i===0?20:13}}/>)}</div>; }
function Failure({error,retry}:{error:unknown;retry:()=>void}) { return <div className="panel error-panel"><CircleAlert size={25}/><strong>We couldn't load this view</strong><p>{errorText(error)}</p><button data-testid="button-retry" className="btn btn-outline" onClick={retry}><RefreshCw size={13}/> Try again</button></div>; }
function Pair({label,value}:{label:string;value:ReactNode}) { return <div className="detail-pair"><span>{label}</span><span>{value ?? '—'}</span></div>; }
function Header({eyebrow,title,desc,action}:{eyebrow:string;title:string;desc:string;action?:ReactNode}) { return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-desc">{desc}</p></div>{action}</div>; }
function Section({title,sub,action}:{title:string;sub?:string;action?:ReactNode}) { return <div className="section-heading"><div><h2 className="section-title">{title}</h2>{sub&&<p className="section-sub">{sub}</p>}</div>{action}</div>; }
function Modal({title,description,children,onClose,onConfirm,confirmText='Confirm',danger=false,pending=false,disabled=false}:{title:string;description?:string;children?:ReactNode;onClose:()=>void;onConfirm:()=>void;confirmText?:string;danger?:boolean;pending?:boolean;disabled?:boolean}) {
  useEffect(()=>{const fn=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[onClose]);
  return <div className="dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="dialog" role="dialog" aria-modal="true" aria-label={title}><h2>{title}</h2>{description&&<p>{description}</p>}{children}<div className="dialog-actions"><button data-testid="button-cancel-dialog" className="btn btn-outline" onClick={onClose}>Cancel</button><button data-testid="button-confirm-dialog" className={`btn ${danger?'btn-danger':'btn-primary'}`} onClick={onConfirm} disabled={pending||disabled}>{pending?'Working…':confirmText}</button></div></div></div>;
}
function hasWebGL2() {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}
function ModelViewer({url,poster}:{url?:string|null;poster?:string|null}) {
  const [webglSupported] = useState(hasWebGL2);
  useEffect(()=>{if(webglSupported&&!document.querySelector('script[data-model-viewer]')){const s=document.createElement('script');s.type='module';s.src='https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js';s.dataset.modelViewer='true';document.head.appendChild(s)}},[webglSupported]);
  const isMattress = !!url?.includes('/api/storage/public-objects/product-models/infini-medical-mattress-200x210x20-v1.glb');
  const isWardrobe = !!url?.includes('/api/storage/public-objects/product-models/infini-white-wardrobe-80x40x185-v1.glb');
  const prepared = isMattress || isWardrobe;
  const size = isMattress ? '200 W × 210 L × 20 H cm' : '80 W × 40 D × 185 H cm';
  const disclaimer = isMattress ? 'Other sizes and exact fabric details are not represented.' : 'Interior layout, fittings and other colour variants are not verified.';
  return <><div className="viewer"><div className="viewer-corner">3D PREVIEW / ORBIT TO INSPECT</div>{url && !webglSupported ? <div className="viewer-empty" style={{width:'100%',height:'100%'}}>{poster&&<img src={poster} alt="Product preview" style={{maxWidth:'100%',maxHeight:'70%',objectFit:'contain'}}/>}<strong>3D preview needs WebGL2 enabled</strong><p>This browser cannot render the interactive preview. The GLB remains available to download and can be viewed on a supported device.</p></div> : url ? <model-viewer src={url} poster={poster || undefined} camera-controls auto-rotate shadow-intensity="1" ar ar-modes="webxr scene-viewer quick-look" ar-scale={prepared?'fixed':undefined} style={{width:'100%',height:'100%'}}><button slot="ar-button" className="btn btn-primary" style={{position:'absolute',bottom:16,right:16,zIndex:2}}>View in your room (AR)</button></model-viewer> : <div className="viewer-empty"><Box size={35} strokeWidth={1.2}/><strong>No model file yet</strong><p>A preview will appear here once generation and optimization are complete.</p></div>}</div>{prepared&&<div className="notice notice-warn" style={{marginTop:14}}><strong>Prepared model · fixed modeled size: {size}</strong><br/>Size-based 3D approximation, not a product scan. {disclaimer} Review its appearance and proportions before approving or placing it in your room. <a href={url!} download={isMattress?'infini-medical-mattress-200x210x20-v1.glb':'infini-white-wardrobe-80x40x185-v1.glb'} className="btn btn-outline" style={{marginTop:10}}>Download GLB</a></div>}</>;
}
declare module 'react' { namespace JSX { interface IntrinsicElements { 'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {src?:string;poster?:string;'camera-controls'?:boolean;'auto-rotate'?:boolean;ar?:boolean;'ar-modes'?:string;'ar-scale'?:string;'shadow-intensity'?:string} } } }

const navMain = [{href:'/dashboard',label:'Overview',icon:LayoutDashboard},{href:'/products',label:'Products',icon:Package},{href:'/models',label:'3D models',icon:Box},{href:'/queue',label:'Job queue',icon:Layers3}];
const navSystem = [{href:'/demo-ar',label:'Free AR demo',icon:Eye},{href:'/status',label:'Connections',icon:Activity},{href:'/logs',label:'Event log',icon:FileClock},{href:'/settings',label:'Settings',icon:Settings2}];
function Shell({children}:{children:ReactNode}) {
  const [location]=useLocation(); const status=useGetApiStatus();
  const current=[...navMain,...navSystem].find(n=>location.startsWith(n.href));
  return <div className="app-shell"><aside className="sidebar"><Link href="/dashboard" className="brand" data-testid="link-home"><span className="brand-mark"><Grid2X2 size={19}/></span><span><span className="brand-name">INFini Homes</span><span className="brand-sub" style={{display:'block'}}>View in your room</span></span></Link><nav aria-label="Main navigation"><div className="nav-group-label">Workspace</div>{navMain.map(n=><Link href={n.href} key={n.href} data-testid={`link-${n.label.toLowerCase().replaceAll(' ','-')}`} className={`nav-link ${location.startsWith(n.href)?'active':''}`}><n.icon size={17} strokeWidth={1.8}/>{n.label}</Link>)}<div className="nav-group-label">System</div>{navSystem.map(n=><Link href={n.href} key={n.href} data-testid={`link-${n.label.toLowerCase().replaceAll(' ','-')}`} className={`nav-link ${location.startsWith(n.href)?'active':''}`}><n.icon size={17} strokeWidth={1.8}/>{n.label}</Link>)}</nav><div className="sidebar-bottom"><div style={{display:'flex',alignItems:'center',gap:8,fontSize:11,fontWeight:700,color:'#dceae5'}}><span style={{width:7,height:7,borderRadius:'50%',background:status.data?.database.mode==='live'?'#79c9a1':'#dba063'}}/> {status.isLoading?'Checking system…':status.data?.database.mode==='live'?'System operational':'System status needs attention'}</div><div className="small" style={{marginTop:8}}>Merchant administration console</div></div></aside><div className="main"><header className="topbar"><div className="topbar-path">Workspace <ChevronRight size={12} style={{display:'inline',verticalAlign:'middle',margin:'0 6px'}}/> <strong>{current?.label || 'Overview'}</strong></div><div className="topbar-right"><span className="workspace-pill">MERCHANT CONSOLE</span><span className="avatar">IH</span></div></header><main className="content">{children}</main></div></div>;
}

function Dashboard() {
  const products=useListProducts(), models=useListModels(), jobs=useListQueueJobs(), logs=useListLogs(), status=useGetApiStatus(), health=useHealthCheck();
  if(products.isLoading||models.isLoading||jobs.isLoading||logs.isLoading||status.isLoading||health.isLoading)return <><Header eyebrow="CONTROL ROOM / 01" title="Overview" desc="A clear view of your 3D production pipeline."/>{<Load/>}</>;
  if(products.isError)return <Failure error={products.error} retry={()=>products.refetch()}/>;
  if(models.isError)return <Failure error={models.error} retry={()=>models.refetch()}/>;
  const ps=products.data||[], ms=models.data||[], js=jobs.data||[], eligible=ps.filter(p=>p.eligible).length, review=ms.filter(m=>m.status==='REVIEW').length, published=ms.filter(m=>m.status==='PUBLISHED').length;
  const counts=stages.map(s=>({s,count:ms.filter(m=>m.status===s).length})); const active=js.filter(j=>['PENDING','PROCESSING'].includes(j.status)).length;
  return <><Header eyebrow="CONTROL ROOM / 01" title="Good visibility, better decisions." desc="Your products, models, and provider health in one place." action={<button data-testid="button-refresh-overview" className="btn btn-outline" onClick={()=>{products.refetch();models.refetch();jobs.refetch();logs.refetch();status.refetch();health.refetch()}}><RefreshCw size={14}/> Refresh overview</button>}/>
  <div className="metric-grid"><div className="metric featured"><Package className="metric-icon" size={20}/><div className="metric-label">Eligible products</div><div className="metric-num" data-testid="text-eligible-products">{eligible}</div><div className="metric-foot">{ps.length-eligible} excluded · {ps.length} total considered</div></div><div className="metric"><Eye className="metric-icon" size={20}/><div className="metric-label">Awaiting review</div><div className="metric-num" data-testid="text-awaiting-review">{review}</div><div className="metric-foot">Models needing a human decision</div></div><div className="metric"><UploadCloud className="metric-icon" size={20}/><div className="metric-label">Published models</div><div className="metric-num" data-testid="text-published-models">{published}</div><div className="metric-foot">Customer-visible on storefront</div></div><div className="metric"><Activity className="metric-icon" size={20}/><div className="metric-label">Active jobs</div><div className="metric-num" data-testid="text-active-jobs">{active}</div><div className="metric-foot">{js.filter(j=>j.status==='FAILED').length} failed jobs need attention</div></div></div>
  <div className="grid-two"><div><Section title="Production pipeline" sub="Every model, from eligibility to storefront." action={<Link href="/models" className="btn btn-quiet" data-testid="link-all-models">All models <ArrowRight size={14}/></Link>}/><div className="panel panel-pad"><div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}><div><span style={{font:'800 29px Manrope',letterSpacing:'-.06em'}}>{ms.length}</span><span className="small" style={{marginLeft:8}}>total models</span></div><span className="small">Live stage distribution</span></div><div className="pipeline">{counts.filter(c=>!['FAILED','CANCELLED','STALE'].includes(c.s)).map(c=><span key={c.s} className={c.count?'on':''} title={`${pretty(c.s)}: ${c.count}`}/>)}</div><div className="pipeline-labels"><span>Intake</span><span>Generation</span><span>Review</span><span>Storefront</span></div><div className="stage-list">{counts.map(c=><div className="stage-chip" key={c.s}><span>{pretty(c.s)}</span><strong>{c.count}</strong></div>)}</div></div>
  <div style={{marginTop:29}}><Section title="Models requiring attention" sub="Review and exception states are surfaced first."/><div className="panel table-wrap">{ms.filter(m=>['REVIEW','FAILED','STALE'].includes(m.status)).length ? <table className="table"><thead><tr><th>Model</th><th>Product</th><th>Stage</th><th>Updated</th><th></th></tr></thead><tbody>{ms.filter(m=>['REVIEW','FAILED','STALE'].includes(m.status)).slice(0,5).map(m=><tr key={m.id}><td><span className="cell-main mono">MDL-{String(m.id).padStart(4,'0')}</span></td><td className="cell-main">{ps.find(p=>p.id===m.productId)?.title||`Product #${m.productId}`}</td><td><Badge value={m.status}/></td><td>{date(m.updatedAt)}</td><td><Link href={`/models/${m.id}`} data-testid={`link-attention-model-${m.id}`} className="btn btn-quiet">Inspect <ArrowRight size={13}/></Link></td></tr>)}</tbody></table>:<Empty title="Nothing needs intervention" description="Review requests and exceptions will appear here as models move through production." icon={ShieldCheck}/>}</div></div></div>
  <div><Section title="Connection health" sub="Real, simulated, and unavailable states." action={<Link href="/status" data-testid="link-connection-details" className="btn btn-quiet">Details <ArrowRight size={14}/></Link>}/><div className="panel panel-pad">{status.isError?<div className="notice notice-danger">Connection status unavailable. <button className="btn btn-quiet" onClick={()=>status.refetch()}>Retry</button></div>:status.data&&Object.entries(status.data).map(([name,s])=><div className="status-line" key={name}><strong>{pretty(name)}</strong><Badge value={s.mode} label={s.mode==='live'?'Live':s.mode==='mock'?'Mock mode':'Unavailable'}/></div>)}<div className="small" style={{marginTop:15}}>API health: {health.isError?'Unavailable':health.data?.status||'Unknown'}</div></div><div style={{marginTop:29}}><Section title="Recent activity" sub="Latest webhook and system events." action={<Link href="/logs" data-testid="link-all-activity" className="btn btn-quiet">View log <ArrowRight size={14}/></Link>}/><div className="panel panel-pad">{logs.isError?<Failure error={logs.error} retry={()=>logs.refetch()}/>:logs.data?.length?logs.data.slice(0,5).map(l=><div className="activity-row" key={l.id}><div className="activity-icon"><Activity size={13}/></div><div><div className="activity-text"><strong>{l.source}</strong> · {l.message}</div><div className="activity-time">{time(l.createdAt)} · {pretty(l.level)}</div></div></div>):<Empty title="No events yet" description="Operational activity will show up here when the pipeline starts running." icon={FileClock}/>}</div></div></div></div></>;
}

function Products() {
  const q=useListProducts(); const [search,setSearch]=useState(''),[filter,setFilter]=useState('all'); const models=useListModels();
  const rows=(q.data||[]).filter(p=>(filter==='all'||(filter==='eligible'?p.eligible:filter==='excluded'?!p.eligible:p.source===filter))&&`${p.title} ${p.category} ${p.handle}`.toLowerCase().includes(search.toLowerCase()));
  return <><Header eyebrow="CATALOG / 02" title="Products" desc="Eligibility is assessed for furniture and mattresses only." action={<span className="small">{q.data?.length||0} products considered</span>}/><div className="toolbar"><div style={{position:'relative'}}><Search size={15} style={{position:'absolute',left:12,top:12,color:'#8aa09e'}}/><input className="input" style={{paddingLeft:35}} placeholder="Search catalog…" value={search} onChange={e=>setSearch(e.target.value)} data-testid="input-search-products"/></div><select className="select" value={filter} onChange={e=>setFilter(e.target.value)} data-testid="select-filter-products"><option value="all">All products</option><option value="eligible">Eligible</option><option value="excluded">Excluded</option><option value="storefront">Public storefront / catalog</option><option value="shopify">Shopify Admin sync</option><option value="sample">Sample data</option></select><span className="spacer"/><span className="small">Showing {rows.length} of {q.data?.length||0}</span></div>{q.isLoading?<Load/>:q.isError?<Failure error={q.error} retry={()=>q.refetch()}/>:<div className="panel table-wrap">{rows.length?<table className="table"><thead><tr><th>Product</th><th>Source</th><th>Eligibility</th><th>Models</th><th>Variants</th><th>Updated</th><th></th></tr></thead><tbody>{rows.map(p=><tr key={p.id} data-testid={`row-product-${p.id}`}><td><div className="product-cell"><Thumb url={p.primaryImageUrl} title={p.title}/><div><div className="cell-main">{p.title}</div><div className="cell-sub">{p.category} · {p.handle}</div></div></div></td><td><Badge value={p.source} label={productSourceLabel(p.source)}/></td><td><Badge value={p.eligible?'APPROVED':'FAILED'} label={p.eligible?'Eligible':'Excluded'}/><div className="cell-sub" style={{maxWidth:180,lineHeight:1.4}}>{p.eligibilityReason}</div></td><td className="mono">{models.data?.filter(m=>m.productId===p.id).length??'—'}</td><td>{p.variantCount}</td><td>{date(p.updatedAt)}</td><td><Link href={`/products/${p.id}`} data-testid={`link-product-${p.id}`} className="btn btn-quiet">View <ArrowRight size={13}/></Link></td></tr>)}</tbody></table>:<Empty title="No products match" description="Adjust your search or filter to find products in the catalog." icon={Package}/>}</div>}</>;
}
function ProductDetail() {
  const {id:raw}=useParams<{id:string}>(), id=Number(raw); const q=useGetProduct(id,{query:{enabled:Number.isFinite(id),queryKey:getGetProductQueryKey(id)}}), models=useListModels(), qc=useQueryClient(), recheck=useRecheckProductEligibility(); const [message,setMessage]=useState('');
  const p=q.data; const linked=models.data?.filter(m=>m.productId===id)||[];
  return <><Link href="/products" className="btn btn-quiet" data-testid="link-back-products"><ArrowLeft size={14}/> Products</Link>{q.isLoading?<Load/>:q.isError?<Failure error={q.error} retry={()=>q.refetch()}/>:p&&<><Header eyebrow={`PRODUCT / ${String(p.id).padStart(4,'0')}`} title={p.title} desc={`${p.category} · ${p.handle}`} action={<button data-testid="button-recheck-eligibility" className="btn btn-outline" disabled={recheck.isPending} onClick={()=>recheck.mutate({id},{onSuccess:()=>{qc.invalidateQueries({queryKey:getGetProductQueryKey(id)});qc.invalidateQueries({queryKey:getListProductsQueryKey()});setMessage('Eligibility check completed.')},onError:e=>setMessage(errorText(e))})}><RefreshCw size={14}/>{recheck.isPending?'Checking…':'Recheck eligibility'}</button>}/>{message&&<div className="notice notice-info" style={{marginBottom:18}} role="status">{message}</div>}<div className="detail-grid"><div><Section title="Product record"/><div className="panel panel-pad"><div style={{display:'flex',gap:19,alignItems:'center',marginBottom:22}}><div style={{width:95,height:95,borderRadius:9,background:'#e9e9df',overflow:'hidden',display:'grid',placeItems:'center'}}>{p.primaryImageUrl?<img src={p.primaryImageUrl} alt={p.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<Box size={28} color="#8da7a3"/>}</div><div><div className="cell-main" style={{fontSize:17}}>{p.title}</div><div style={{display:'flex',gap:7,marginTop:10}}><Badge value={p.source} label={productSourceLabel(p.source)}/><Badge value={p.eligible?'APPROVED':'FAILED'} label={p.eligible?'Eligible':'Excluded'}/></div></div></div><div className={`notice ${p.eligible?'notice-info':'notice-warn'}`}><strong>{p.eligible?'Eligible for 3D generation':'Excluded from generation'}</strong><br/>{p.eligibilityReason}</div><div style={{marginTop:17}}><Pair label="Shopify product ID" value={p.shopifyProductId||'Not linked — sample/local record'}/><Pair label="Category" value={p.category}/><Pair label="Variants" value={p.variantCount}/><Pair label="Images available" value={p.imageUrls.length}/><Pair label="Dimensions" value={p.dimensions?`${p.dimensions.width??'—'} × ${p.dimensions.height??'—'} × ${p.dimensions.depth??'—'} ${p.dimensions.unit}`:'Not calibrated'}/><Pair label="Created" value={time(p.createdAt)}/><Pair label="Last updated" value={time(p.updatedAt)}/></div></div></div><div><Section title="Associated models" sub={`${linked.length} model${linked.length===1?'':'s'} for this product`}/><div className="panel">{linked.length?linked.map(m=><Link href={`/models/${m.id}`} key={m.id} data-testid={`link-product-model-${m.id}`} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'17px 18px',borderBottom:'1px solid #eef0e9'}}><div><div className="cell-main mono">MDL-{String(m.id).padStart(4,'0')}</div><div className="cell-sub">{time(m.updatedAt)}</div></div><div style={{display:'flex',alignItems:'center',gap:9}}><Badge value={m.status}/><ChevronRight size={15}/></div></Link>):<Empty title="No models associated" description="Eligible products enter the model pipeline when a model record is created." icon={Box}/>}</div></div></div></>}</>;
}

function Models() {
  const q=useListModels(), products=useListProducts(); const [search,setSearch]=useState(''),[filter,setFilter]=useState('all');
  const rows=(q.data||[]).filter(m=>(filter==='all'||m.status===filter)&&`${m.id} ${products.data?.find(p=>p.id===m.productId)?.title||''}`.toLowerCase().includes(search.toLowerCase()));
  return <><Header eyebrow="PRODUCTION / 03" title="3D models" desc="Trace every asset from intake through inspection and publication." action={<span className="small">{q.data?.length||0} model records</span>}/><div className="toolbar"><div style={{position:'relative'}}><Search size={15} style={{position:'absolute',left:12,top:12,color:'#8aa09e'}}/><input data-testid="input-search-models" className="input" style={{paddingLeft:35}} placeholder="Search model or product…" value={search} onChange={e=>setSearch(e.target.value)}/></div><select data-testid="select-filter-models" className="select" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All stages</option>{stages.map(s=><option key={s} value={s}>{pretty(s)}</option>)}</select><span className="spacer"/><span className="small">{rows.length} shown</span></div>{q.isLoading?<Load/>:q.isError?<Failure error={q.error} retry={()=>q.refetch()}/>:<div className="panel table-wrap">{rows.length?<table className="table"><thead><tr><th>Model / product</th><th>Stage</th><th>Provider</th><th>Source images</th><th>Last activity</th><th></th></tr></thead><tbody>{rows.map(m=>{const p=products.data?.find(x=>x.id===m.productId);return <tr key={m.id} data-testid={`row-model-${m.id}`}><td><div className="product-cell"><Thumb url={m.thumbnailUrl||p?.primaryImageUrl} title={p?.title}/><div><div className="cell-main">{p?.title||`Product #${m.productId}`}</div><div className="cell-sub mono">MDL-{String(m.id).padStart(4,'0')} · {p?.source==='sample'?'SAMPLE':'SHOPIFY'}</div></div></div></td><td><Badge value={m.status}/></td><td><Badge value={m.provider} label={providerLabel(m.provider)}/></td><td>{m.sourceImageCount}</td><td>{time(m.updatedAt)}</td><td><Link href={`/models/${m.id}`} data-testid={`link-model-${m.id}`} className="btn btn-quiet">Inspect <ArrowRight size={13}/></Link></td></tr>})}</tbody></table>:<Empty title="No models found" description="Try another stage or search term. Model records will appear as products enter the pipeline." icon={Box}/>}</div>}</>;
}
function ModelDetail() {
  const {id:raw}=useParams<{id:string}>(),id=Number(raw), qc=useQueryClient(), q=useGetModel(id,{query:{enabled:Number.isFinite(id),queryKey:getGetModelQueryKey(id)}}),products=useListProducts();
  const generate=useGenerateModel(),approve=useApproveModel(),reject=useRejectModel(),publish=usePublishModel(),unpublish=useUnpublishModel();
  const [dialog,setDialog]=useState<'generate'|'approve'|'reject'|'publish'|'unpublish'|null>(null),[reviewer,setReviewer]=useState(''),[reason,setReason]=useState(''),[feedback,setFeedback]=useState('');
  const m=q.data,p=products.data?.find(x=>x.id===m?.productId); const pending=generate.isPending||approve.isPending||reject.isPending||publish.isPending||unpublish.isPending;
  const refresh=(label:string)=>{qc.invalidateQueries({queryKey:getGetModelQueryKey(id)});qc.invalidateQueries({queryKey:getListModelsQueryKey()});qc.invalidateQueries({queryKey:getListProductsQueryKey()});if(p)qc.invalidateQueries({queryKey:getGetProductQueryKey(p.id)});qc.invalidateQueries({queryKey:getListQueueJobsQueryKey()});qc.invalidateQueries({queryKey:getListLogsQueryKey()});setDialog(null);setFeedback(label);setTimeout(()=>setFeedback(''),4500)};
  const fail=(e:unknown)=>{setDialog(null);setFeedback(errorText(e));setTimeout(()=>setFeedback(''),6000)};
  const act=()=>{if(!dialog)return; if(dialog==='generate')generate.mutate({id,data:{confirm:true}},{onSuccess:()=>refresh(p?.source==='sample'?'Sample demo model ready for review.':'Existing prepared asset assigned for review. No new generation charge.'),onError:fail});if(dialog==='approve')approve.mutate({id,data:{reviewer:reviewer.trim()}},{onSuccess:()=>refresh('Model approved. It is ready to publish.'),onError:fail});if(dialog==='reject')reject.mutate({id,data:{reviewer:reviewer.trim(),reason:reason.trim()}},{onSuccess:()=>refresh('Model rejected. The reason is recorded.'),onError:fail});if(dialog==='publish')publish.mutate({id},{onSuccess:()=>refresh('Model published to the storefront.'),onError:fail});if(dialog==='unpublish')unpublish.mutate({id},{onSuccess:()=>refresh('Model removed from the storefront.'),onError:fail})};
  const canGenerate=m&&['ELIGIBLE','FAILED','STALE','CANCELLED','PENDING'].includes(m.status), canReview=m?.status==='REVIEW',canPublish=m?.status==='APPROVED',canUnpublish=m?.status==='PUBLISHED';
  return <><Link href="/models" className="btn btn-quiet" data-testid="link-back-models"><ArrowLeft size={14}/> 3D models</Link>{q.isLoading?<Load/>:q.isError?<Failure error={q.error} retry={()=>q.refetch()}/>:m&&<><Header eyebrow={`MODEL / ${String(m.id).padStart(4,'0')}`} title={p?.title||`Model #${m.id}`} desc={`Model #${m.id} · ${p?.category||'Product'} · Updated ${time(m.updatedAt)}`} action={<Badge value={m.status}/>}/><div className="detail-grid"><div><Section title="Asset inspection" sub="Orbit, zoom, and review before approving any customer-facing asset."/><div className="panel panel-pad"><ModelViewer url={m.optimizedModelUrl||m.originalModelUrl} poster={m.thumbnailUrl}/><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:16,gap:10,flexWrap:'wrap'}}><div className="small">Showing {m.optimizedModelUrl?'optimized model':m.originalModelUrl?'original model':'no model file'} · {providerLabel(m.provider)}</div>{(m.optimizedModelUrl||m.originalModelUrl)&&<a href={m.optimizedModelUrl||m.originalModelUrl||'#'} target="_blank" rel="noreferrer" className="btn btn-outline" data-testid="link-open-model-file">Open file <ExternalLink size={13}/></a>}</div></div><div style={{marginTop:26}}><Section title="Production stages" sub="Current position in the generation workflow."/><div className="panel panel-pad"><div className="pipeline" style={{height:10}}>{stages.slice(0,10).map((s,i)=><span key={s} className={i<=stages.indexOf(m.status)?'on':''}/>)}</div><div className="pipeline-labels"><span>Pending</span><span>Generation</span><span>Calibration</span><span>Review</span><span>Published</span></div>{m.errorMessage&&<div className="notice notice-danger" style={{marginTop:23}}><strong>Generation error</strong><br/>{m.errorMessage}</div>}{m.rejectionReason&&<div className="notice notice-warn" style={{marginTop:15}}><strong>Rejection reason</strong><br/>{m.rejectionReason}</div>}</div></div></div><div><Section title="Review actions" sub="Only available at the appropriate stage."/><div className="panel panel-pad"><div style={{display:'flex',flexDirection:'column',gap:9}}>{canGenerate&&<button data-testid="button-generate-model" className="btn btn-dark" onClick={()=>setDialog('generate')}><Play size={14}/> {p?.source==='sample'?'Generate sample model':'Use prepared model'} <ArrowRight size={14} style={{marginLeft:'auto'}}/></button>}{canReview&&<><button data-testid="button-approve-model" className="btn btn-primary" onClick={()=>setDialog('approve')}><Check size={14}/> Approve model</button><button data-testid="button-reject-model" className="btn btn-outline" onClick={()=>setDialog('reject')}><X size={14}/> Reject model</button></>}{canPublish&&<button data-testid="button-publish-model" className="btn btn-primary" onClick={()=>setDialog('publish')}><UploadCloud size={14}/> Publish to storefront</button>}{canUnpublish&&<button data-testid="button-unpublish-model" className="btn btn-outline" onClick={()=>setDialog('unpublish')}><ArrowDownRight size={14}/> Unpublish model</button>}{!canGenerate&&!canReview&&!canPublish&&!canUnpublish&&<div className="notice notice-info">No manual action is available at this stage. The pipeline is processing this model.</div>}</div>{m.status==='PUBLISHED'&&<p className="field-help" style={{marginTop:15}}>This asset is visible to storefront customers. Unpublishing removes the experience.</p>}</div><div style={{marginTop:25}}><Section title="Generation metadata"/><div className="panel panel-pad"><Pair label="Model ID" value={`MDL-${String(m.id).padStart(4,'0')}`}/><Pair label="Provider" value={<Badge value={m.provider} label={providerLabel(m.provider)}/>}/><Pair label="Provider task" value={m.providerTaskId||'Not assigned'}/><Pair label="Source images" value={m.sourceImageCount}/><Pair label="Image set hash" value={m.imageSetHash?<span className="mono">{m.imageSetHash.slice(0,16)}…</span>:'—'}/><Pair label="File size" value={m.fileSizeBytes?`${(m.fileSizeBytes/1024/1024).toFixed(2)} MB`:'—'}/><Pair label="Reviewer" value={m.reviewer||'—'}/><Pair label="Reviewed" value={date(m.reviewedAt)}/><Pair label="Approved" value={date(m.approvedAt)}/><Pair label="Published" value={date(m.publishedAt)}/><Pair label="Created" value={date(m.createdAt)}/>{p&&<Link href={`/products/${p.id}`} className="btn btn-quiet" data-testid="link-associated-product" style={{marginTop:12}}>View product record <ArrowRight size={13}/></Link>}</div></div></div></div></>}
  {dialog&&<Modal title={{generate:'Confirm prepared asset',approve:'Approve this model?',reject:'Reject this model?',publish:'Publish to storefront?',unpublish:'Remove from storefront?'}[dialog]} description={{generate:p?.source==='sample'?'This uses a mock sample asset for demo products only. No paid credits.':'This uses the existing prepared GLB for this product, if registered and available. No new generation charge or paid credits. This is a size-based 3D approximation, not a product scan; check its appearance and fixed modeled size before approval.',approve:'Confirm that the geometry, appearance, and fixed modeled size are suitable for customers.',reject:'Record what needs to be corrected before this asset can progress.',publish:'This model will become customer-visible in the View in Your Room experience.',unpublish:'The View in Your Room experience for this model will no longer be customer-visible.'}[dialog]} onClose={()=>setDialog(null)} onConfirm={act} confirmText={{generate:'Use existing asset',approve:'Approve model',reject:'Reject model',publish:'Publish model',unpublish:'Unpublish model'}[dialog]} danger={dialog==='reject'||dialog==='unpublish'} pending={pending} disabled={(['approve','reject'].includes(dialog)&&!reviewer.trim())||(dialog==='reject'&&!reason.trim())}>{['approve','reject'].includes(dialog)&&<div style={{marginTop:17}}><label className="field-label" htmlFor="reviewer">Reviewer name</label><input id="reviewer" data-testid="input-reviewer" className="input" value={reviewer} onChange={e=>setReviewer(e.target.value)} placeholder="Your name"/></div>}{dialog==='reject'&&<div style={{marginTop:16}}><label className="field-label" htmlFor="reason">Reason for rejection</label><textarea id="reason" data-testid="input-rejection-reason" className="textarea" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describe the issue clearly for the next review."/></div>}{dialog==='generate'&&<div className="notice notice-info" style={{marginTop:17}}>Existing prepared model only; no new model is generated and no new charge is incurred.</div>}</Modal>}{feedback&&<div role="status" className="toast-pop" data-testid="status-model-action">{feedback}</div>}</>;
}

function Queue() {
 const q=useListQueueJobs();const [filter,setFilter]=useState('all');const rows=(q.data||[]).filter(j=>filter==='all'||j.status===filter);
 return <><Header eyebrow="PRODUCTION / 04" title="Job queue" desc="Generation work, attempts, and failures in one audit trail." action={<button data-testid="button-refresh-queue" className="btn btn-outline" onClick={()=>q.refetch()}><RefreshCw size={14}/> Refresh queue</button>}/><div className="toolbar"><select className="select" value={filter} onChange={e=>setFilter(e.target.value)} data-testid="select-filter-jobs"><option value="all">All jobs</option>{['PENDING','PROCESSING','GENERATED','FAILED','CANCELLED'].map(s=><option key={s} value={s}>{pretty(s)}</option>)}</select><span className="spacer"/><span className="small">{rows.length} jobs shown</span></div>{q.isLoading?<Load/>:q.isError?<Failure error={q.error} retry={()=>q.refetch()}/>:<div className="panel table-wrap">{rows.length?<table className="table"><thead><tr><th>Job</th><th>Model</th><th>Status</th><th>Provider</th><th>Attempts</th><th>Last error</th><th>Updated</th></tr></thead><tbody>{rows.map(j=><tr key={j.id} data-testid={`row-job-${j.id}`}><td className="cell-main mono">JOB-{String(j.id).padStart(4,'0')}</td><td><Link href={`/models/${j.productModelId}`} data-testid={`link-job-model-${j.id}`} className="btn btn-quiet">MDL-{String(j.productModelId).padStart(4,'0')} <ArrowRight size={12}/></Link></td><td><Badge value={j.status}/></td><td><Badge value={j.provider}/></td><td><span className="mono">{j.attempt} / {j.maxAttempts}</span></td><td style={{maxWidth:220,color:j.lastError?'#a75342':undefined}}>{j.lastError||'—'}</td><td>{time(j.updatedAt)}</td></tr>)}</tbody></table>:<Empty title="Queue is clear" description="Generation jobs will appear here after a model is explicitly queued for production." icon={Layers3}/>}</div>}</>;
}

function LiquidSourceSection() {
  const q = useGetLiquidSource();
  const status = useGetApiStatus();
  const [copied, setCopied] = useState(false);
  const copyCode = async () => {
    if (!q.data) return;
    try {
      await navigator.clipboard.writeText(q.data.code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = q.data.code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  const meshyLive = status.data?.meshy.mode === 'live';
  return <>
    <Section title="Shopify Custom Liquid" sub="Copy this code and paste it into a Custom Liquid section on your Shopify product page to enable View in Your Room." />
    <div className="panel panel-pad">
      {q.isLoading ? <Load /> : q.isError ? <Failure error={q.error} retry={() => q.refetch()} /> : <>
        <div className="notice notice-warn" style={{ marginBottom: 16 }}>
          <ShieldAlert size={16} style={{ verticalAlign: 'middle', marginRight: 7 }} />
          Do not modify the code unless instructed. The code connects to the current backend automatically.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <button data-testid="button-copy-liquid-code" className="btn btn-primary" onClick={copyCode} disabled={!q.data}>
            <Copy size={14} /> Copy Code
          </button>
          <span className="small" style={{ color: '#879598' }}>{q.data ? `${q.data.code.length.toLocaleString()} characters — exact current file contents` : ''}</span>
        </div>
        <textarea
          readOnly
          spellCheck={false}
          value={q.data?.code || ''}
          data-testid="textarea-liquid-code"
          onFocus={e => e.currentTarget.select()}
          className="input"
          style={{ width: '100%', height: 360, fontFamily: 'var(--app-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)', fontSize: 12, lineHeight: 1.55, resize: 'vertical', whiteSpace: 'pre' }}
        />
        <div className="grid-two" style={{ marginTop: 22 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <AdminConsoleButton />
              <strong style={{ fontSize: 13, color: '#304a50' }}>Copy instructions</strong>
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12, color: '#4b5563' }}>
              <li>Shopify Admin → Online Store → Themes → Customize</li>
              <li>Open the Product template</li>
              <li>Add a &quot;Custom Liquid&quot; section/block</li>
              <li>Paste the copied code</li>
              <li>Save</li>
              <li>Open an eligible Furniture or Mattress product and test &quot;View in Your Room&quot;</li>
            </ol>
          </div>
          <div>
            <strong style={{ display: 'block', fontSize: 13, color: '#304a50', marginBottom: 10 }}>Status</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Pair label="Frontend code" value={<Badge value="live" label="Ready" />} />
              <Pair label="Backend" value={import.meta.env.DEV ? "Replit Development" : "Railway"} />
              <Pair label="Current backend URL" value={<span style={{ fontFamily: 'var(--app-font-mono, monospace)', fontSize: 11, wordBreak: 'break-all' }}>{q.data?.backendUrl}</span>} />
              <Pair label="Meshy" value={<Badge value={meshyLive ? 'live' : 'mock'} label={meshyLive ? 'Live generation enabled' : 'Mock / Live generation disabled'} />} />
            </div>
          </div>
        </div>
      </>}
    </div>
    {copied && <div role="status" className="toast-pop" data-testid="status-liquid-copied">Code copied!</div>}
  </>;
}
function StorefrontConnectionSection() {
  const q = useGetStorefrontConnectionStatus();
   const catalog = useGetPublicCatalogStatus();
   const sync = useSyncPublicCatalog();
   const qc = useQueryClient();
   const [syncMessage, setSyncMessage] = useState('');
   const startSync = () => {
     setSyncMessage('');
     sync.mutate(undefined, {
       onSuccess: result => {
         setSyncMessage(`Completed public catalog scan: ${result.totalPublicProducts} products (${result.createdCount} new, ${result.updatedCount} refreshed, ${result.skippedCount} could not be connected).`);
         qc.invalidateQueries({ queryKey: getGetPublicCatalogStatusQueryKey() });
         qc.invalidateQueries({ queryKey: getGetStorefrontConnectionStatusQueryKey() });
         qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
         qc.invalidateQueries({ queryKey: getListModelsQueryKey() });
       },
       onError: error => setSyncMessage(errorText(error)),
     });
   };
  return <>
    <Section title="Storefront Connection" sub="No-OAuth connection between the Shopify product page and this backend. Separate from the Shopify Admin API status below." />
    <div className="panel panel-pad">
      {q.isLoading ? <Load /> : q.isError ? <Failure error={q.error} retry={() => q.refetch()} /> : <>
        <div className="notice notice-info" style={{ marginBottom: 16 }}>
          <Activity size={15} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Custom Liquid frontend activity and public catalog import are separate. Importing products does not prove the storefront frontend is connected; neither requires Shopify Admin API OAuth.
        </div>
        <div className="grid-two">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Pair label="Storefront domain(s)" value={q.data?.allowedShops.join(', ')} />
            <Pair label="Backend" value={<Badge value={q.data?.backendOnline ? 'live' : 'unavailable'} label={q.data?.backendOnline ? 'Online' : 'Offline'} />} />
            <Pair label="Frontend (Custom Liquid)" value={<Badge value={q.data?.frontendConnected ? 'live' : 'mock'} label={q.data?.frontendConnected ? 'Connected' : 'Waiting for storefront'} />} />
            <Pair label="Last seen" value={time(q.data?.lastSeenAt)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Pair label="Last product" value={q.data?.lastProductHandle || '—'} />
            <Pair label="Last product id" value={q.data?.lastProductId || '—'} />
            <Pair label="Last connection status" value={q.data?.lastProductConnectionStatus ? <Badge value={q.data.lastProductConnectionStatus} /> : '—'} />
          </div>
        </div>
        <div className="grid-two" style={{ marginTop: 18 }}>
           <Pair label="Connected product records (not store total)" value={q.data?.connectedProductCount ?? 0} />
           <Pair label="Eligible connected records" value={q.data?.eligibleProductCount ?? 0} />
           <Pair label="Published models on connected records" value={q.data?.publishedModelCount ?? 0} />
        </div>
         <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #e5eae6' }}>
           <Section title="Public Shopify catalog" sub="Import published products from infinihomes.shop/products.json. Fixed source, no OAuth or custom URL. Does not generate 3D models." action={<button className="btn btn-primary" data-testid="button-sync-public-catalog" disabled={sync.isPending || catalog.data?.syncing} onClick={startSync}><RefreshCw size={14}/>{sync.isPending || catalog.data?.syncing ? 'Importing…' : 'Sync public catalog'}</button>} />
           {syncMessage && <div role="status" className={`notice ${sync.isError ? 'notice-danger' : 'notice-info'}`} style={{ marginBottom: 15 }}>{syncMessage}</div>}
           {catalog.isError ? <Failure error={catalog.error} retry={() => catalog.refetch()} /> : catalog.isLoading ? <Load /> : catalog.data?.lastCompletedSync ? <>
             <p className="small">Last complete import: {time(catalog.data.lastCompletedSync.completedAt)}. These are counts from that completed public catalog scan, not a live Shopify inventory count.</p>
             <div className="grid-two">
               <div><Pair label="Total public catalog products" value={catalog.data.lastCompletedSync.totalPublicProducts}/><Pair label="Furniture (eligible)" value={catalog.data.lastCompletedSync.furnitureCount}/><Pair label="Mattresses (eligible)" value={catalog.data.lastCompletedSync.mattressCount}/></div>
               <div><Pair label="Other / not eligible" value={catalog.data.lastCompletedSync.otherCount}/><Pair label="New records in last import" value={catalog.data.lastCompletedSync.createdCount}/><Pair label="Refreshed records in last import" value={catalog.data.lastCompletedSync.updatedCount}/><Pair label="Public products not connectable" value={catalog.data.lastCompletedSync.skippedCount}/></div>
             </div>
           </> : <p className="small">No complete public catalog import yet. Connected product counts above are not the full Shopify catalog.</p>}
         </div>
      </>}
    </div>
  </>;
}
function Settings() {
 const q=useGetSettings(), qc=useQueryClient(),update=useUpdateSettings(),[max,setMax]=useState(''),[buttonText,setButtonText]=useState(''),[unit,setUnit]=useState<SettingsUpdateDefaultUnit>('cm'),[show,setShow]=useState(false),[feedback,setFeedback]=useState('');
 useEffect(()=>{if(q.data){setMax(String(q.data.maxConcurrentGenerations));setButtonText(q.data.buttonText);setUnit(q.data.defaultUnit);setShow(q.data.showButtonBeforePublish)}},[q.data]);
 const save=()=>{if(!Number.isInteger(Number(max))||Number(max)<1||!buttonText.trim()){setFeedback('Enter a valid concurrency limit and button label.');return} update.mutate({data:{maxConcurrentGenerations:Number(max),buttonText:buttonText.trim(),defaultUnit:unit,showButtonBeforePublish:show}},{onSuccess:()=>{qc.invalidateQueries({queryKey:getGetSettingsQueryKey()});setFeedback('Settings saved successfully.')},onError:e=>setFeedback(errorText(e))})};
 return <><Header eyebrow="CONFIGURATION / 07" title="Settings" desc="Adjust your production limits and storefront behavior." action={<button data-testid="button-save-settings" className="btn btn-primary" disabled={q.isLoading||update.isPending} onClick={save}><Check size={14}/>{update.isPending?'Saving…':'Save changes'}</button>}/>{q.isLoading?<Load/>:q.isError?<Failure error={q.error} retry={()=>q.refetch()}/>:<><div className="grid-two"><div><Section title="Production & storefront" sub="Changes take effect after saving."/><div className="panel panel-pad"><div className="setting-row"><div className="setting-text"><strong>Concurrent generations</strong><p>Maximum number of generation jobs running at the same time.</p></div><div className="setting-control"><label className="field-label" htmlFor="max-jobs">Maximum jobs</label><input id="max-jobs" className="input" type="number" min="1" value={max} onChange={e=>setMax(e.target.value)} data-testid="input-max-concurrent-generations"/></div></div><div className="setting-row"><div className="setting-text"><strong>Storefront button label</strong><p>The text customers see when the experience is available.</p></div><div className="setting-control"><label className="field-label" htmlFor="button-text">Button text</label><input id="button-text" className="input" value={buttonText} onChange={e=>setButtonText(e.target.value)} data-testid="input-button-text"/></div></div><div className="setting-row"><div className="setting-text"><strong>Default measurement unit</strong><p>Used when displaying product dimensions and scale.</p></div><div className="setting-control"><label className="field-label" htmlFor="default-unit">Unit</label><select id="default-unit" className="select" value={unit} onChange={e=>setUnit(e.target.value as SettingsUpdateDefaultUnit)} data-testid="select-default-unit">{['mm','cm','m','inch','ft'].map(v=><option key={v} value={v}>{v}</option>)}</select></div></div><div className="setting-row"><div className="setting-text"><strong>Show button before publication</strong><p>Display the storefront button even if the model is not published.</p></div><button className={`switch ${show?'on':''}`} role="switch" aria-checked={show} aria-label="Show button before publication" data-testid="switch-show-before-publish" onClick={()=>setShow(!show)}/></div></div></div><div><Section title="Provider safeguards" sub="Live generation can incur real costs."/><div className="panel panel-pad"><div className="notice notice-info"><ShieldCheck size={16} style={{verticalAlign:'middle',marginRight:7}}/> Generation requires an explicit confirmation for each model, regardless of provider mode.</div><div className="sensitive"><div className="sensitive-tag">SENSITIVE / BILLABLE PROVIDER ACCESS</div><div className="setting-row"><div className="setting-text"><strong>Meshy live generation</strong><p>When enabled, generating models can spend real provider credits. This setting is shown for visibility but cannot be changed through the available settings API.</p><div style={{marginTop:13}}><Badge value={q.data?.meshyLiveGenerationEnabled?'live':'mock'} label={q.data?.meshyLiveGenerationEnabled?'Live generation enabled':'Live generation disabled'}/></div></div><div className="switch" role="switch" aria-checked={!!q.data?.meshyLiveGenerationEnabled} aria-disabled="true" title="Not editable through this API" style={{opacity:.55,cursor:'not-allowed',background:q.data?.meshyLiveGenerationEnabled?'#b36a32':undefined}}/></div></div><p className="field-help" style={{marginTop:15}}>For a change to live billing, contact the account administrator or configure the provider through a supported backend workflow.</p></div></div></div>{feedback&&<div role="status" className="toast-pop" data-testid="status-settings-save">{feedback}</div>}<div style={{marginTop:34}}><StorefrontConnectionSection/></div><div style={{marginTop:34}}><LiquidSourceSection/></div></>}</>;
}
function Status() {
 const q=useGetApiStatus(),health=useHealthCheck();const icons:Record<string,typeof Store>={shopify:Store,meshy:Sparkles,database:Database,storage:Cloud};
 return <><Header eyebrow="SYSTEM / 05" title="Connections" desc="An honest readout of which systems are live, simulated, or unavailable." action={<button className="btn btn-outline" data-testid="button-refresh-status" onClick={()=>{q.refetch();health.refetch()}}><RefreshCw size={14}/> Check connections</button>}/><div className="notice notice-info" style={{marginBottom:23}}><Activity size={15} style={{verticalAlign:'middle',marginRight:8}}/> “Mock” means simulated behavior, not a live connection. “Unavailable” means the service cannot be used right now.</div>{q.isLoading?<Load/>:q.isError?<Failure error={q.error} retry={()=>q.refetch()}/>:<div className="connection-grid">{q.data&&Object.entries(q.data).map(([name,s])=>{const Icon=icons[name];return <div className="panel connection-card" key={name} data-testid={`card-provider-${name}`}><div className="connection-card-top"><div className="connection-icon"><Icon size={20}/></div><Badge value={s.mode} label={s.mode==='live'?'Live connection':s.mode==='mock'?'Mock / simulated':'Unavailable'}/></div><h3>{pretty(name)}</h3><p>{s.detail}</p><div className="connection-foot">{s.configured?'CONFIGURED':'NOT CONFIGURED'} · MODE: {s.mode.toUpperCase()}</div></div>})}</div>}<div style={{marginTop:27}}><Section title="API availability"/><div className="panel panel-pad" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><div><strong style={{fontSize:13}}>Application health check</strong><div className="small" style={{marginTop:4}}>Basic reachability of the application API.</div></div><Badge value={health.isError?'unavailable':health.data?.status==='ok'?'live':'mock'} label={health.isError?'Unavailable':health.data?.status||'Checking'}/></div></div></>;
}
function Logs() {
 const q=useListLogs(),[filter,setFilter]=useState('all');const rows=(q.data||[]).filter(l=>filter==='all'||l.level===filter);
 return <><Header eyebrow="SYSTEM / 06" title="Event log" desc="Recent webhook and system events, with their original severity." action={<button data-testid="button-refresh-logs" className="btn btn-outline" onClick={()=>q.refetch()}><RefreshCw size={14}/> Refresh log</button>}/><div className="toolbar"><Filter size={15} color="#72908e"/><select data-testid="select-filter-logs" className="select" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All levels</option><option value="info">Info</option><option value="warn">Warning</option><option value="error">Error</option></select><span className="spacer"/><span className="small">{rows.length} events shown</span></div>{q.isLoading?<Load/>:q.isError?<Failure error={q.error} retry={()=>q.refetch()}/>:<div className="panel table-wrap">{rows.length?<table className="table"><thead><tr><th>Time</th><th>Level</th><th>Source</th><th>Message</th></tr></thead><tbody>{rows.map(l=><tr key={l.id} data-testid={`row-log-${l.id}`}><td className="mono" style={{whiteSpace:'nowrap'}}>{time(l.createdAt)}</td><td><Badge value={l.level}/></td><td className="cell-main">{l.source}</td><td>{l.message}</td></tr>)}</tbody></table>:<Empty title="No matching events" description="There are no events for this severity. Try another filter or come back after pipeline activity." icon={FileClock}/>}</div>}</>;
}
function ArPreview() {
 const {token=''}=useParams<{token:string}>(),q=useGetArExperience(token,{query:{enabled:!!token,queryKey:getGetArExperienceQueryKey(token)}}); return <div className="ar-page"><div className="eyebrow">INFini Homes / View in your room</div>{q.isLoading?<Load/>:q.isError?<Failure error={q.error} retry={()=>q.refetch()}/>:q.data&&<><h1 className="page-title">{q.data.productTitle}</h1><p className="page-desc">Drag to rotate. Pinch or scroll to zoom. Use AR on a supported device.</p><div className="ar-frame"><ModelViewer url={q.data.modelUrl} poster={q.data.thumbnailUrl}/></div>{q.data.dimensions&&<p className="small">Dimensions: {q.data.dimensions.width??'—'} × {q.data.dimensions.height??'—'} × {q.data.dimensions.depth??'—'} {q.data.dimensions.unit}</p>}</>}</div>;
}
// Public demo is deliberately separate from all products and publish state.
// Verified public deployment; never encode the authenticated workspace preview.
const PUBLIC_DEMO_URL = "https://workspaceapi-server-production-8185.up.railway.app/demo-ar";
function FreeArDemo() {
  const qrRoot = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [webglAvailable, setWebglAvailable] = useState(false);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      setWebglAvailable(!!(canvas.getContext('webgl2') || canvas.getContext('webgl')));
    } catch { setWebglAvailable(false); }
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(ios);
    const mobile = ios || /Android/i.test(navigator.userAgent);
    setIsMobile(mobile);
    if (mobile) return;
    const container = qrRoot.current;
    if (!container) return;
    const render = () => {
      const QRCode = (window as Window & { QRCode?: new (element: HTMLElement, options: { text: string; width: number; height: number }) => void }).QRCode;
      if (!QRCode || !container.isConnected) { setError('QR library could not load. Open the mobile link instead.'); return; }
      container.replaceChildren();
      new QRCode(container, { text: PUBLIC_DEMO_URL, width: 180, height: 180 });
    };
    if ((window as Window & { QRCode?: unknown }).QRCode) { render(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
    script.onload = render;
    script.onerror = () => setError('QR library could not load. Open the mobile link instead.');
    document.head.appendChild(script);
    return () => { script.onload = null; script.onerror = null; };
  }, []);
  const link = PUBLIC_DEMO_URL;
  return <div className="ar-page" style={{maxWidth:880,margin:'auto',padding:24}}>
    <div className="eyebrow">FREE TEST / NOT A SHOPIFY PRODUCT</div>
    <h1 className="page-title">Desktop → phone → room AR demo</h1>
    <p className="page-desc">This is a sample astronaut, NOT your furniture or mattress. No Meshy credits are spent. Scan on a supported phone, then tap the viewer's AR icon and allow camera access.</p>
    {isMobile && <div className="panel panel-pad" style={{marginBottom:20}}>
      <strong>Apne room mein dekhein</strong>
      <p>Tap below to launch your phone's AR viewer. On iPhone, select “AR” instead of “Object”, allow camera access if asked, then slowly move your phone towards the floor.</p>
      {isIOS
        ? <a rel="ar" href="https://modelviewer.dev/shared-assets/models/Astronaut.usdz" className="btn btn-primary" style={{display:'inline-flex',gap:10,minHeight:52}} data-testid="launch-ios-ar">
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath fill='none' stroke='white' stroke-width='2' d='M16 3 3 10v13l13 7 13-7V10ZM3 10l13 7 13-7M16 17v13M16 3v14'/%3E%3C/svg%3E" alt="" style={{width:32,height:32,objectFit:'contain'}} />
            Apne room mein dekhein — Open AR
          </a>
        : <a className="btn btn-primary" data-testid="launch-android-ar" href={`intent://arvr.google.com/scene-viewer/1.0?file=https%3A%2F%2Fmodelviewer.dev%2Fshared-assets%2Fmodels%2FAstronaut.glb&mode=ar_preferred#Intent;scheme=https;package=com.google.android.googlequicksearchbox;S.browser_fallback_url=${encodeURIComponent(`${PUBLIC_DEMO_URL}?ar_unavailable=1`)};end;`}>Apne room mein dekhein — Open AR</a>}
      <p className="small">If AR does not open inside a QR scanner or another app, open this page in Safari (iPhone) or Chrome (Android). AR requires a supported device; camera cannot start automatically from a QR scan.</p>
      {new URLSearchParams(window.location.search).has('ar_unavailable') && <p role="alert">AR could not launch on this device. Check Google Play Services for AR support; the 3D preview remains available below.</p>}
    </div>}
    <div className="ar-frame">{webglAvailable
      ? <ModelViewer url="https://modelviewer.dev/shared-assets/models/Astronaut.glb"/>
      : <div className="viewer-empty"><strong>3D preview requires WebGL</strong><p>This browser or preview environment cannot create a 3D graphics context. Use a supported browser or scan from a supported phone.</p></div>}</div>
    {!isMobile && <div style={{marginTop:20,display:'grid',gap:12,justifyItems:'start'}}>
      <strong>Scan this QR to open the demo on your phone</strong>
      <div ref={qrRoot} style={{padding:12,background:'white'}} aria-label="QR code for this demo"/>
      {error && <p role="alert">{error}</p>}
      <a href={link} target="_blank" rel="noreferrer">{link}</a>
      <p>This QR opens the public Railway demo. No account is required.</p>
    </div>}
    {isMobile && <p style={{marginTop:16}}>The preview below the AR button is optional. iPhone uses a prepared USDZ sample, not an on-device conversion. Physical phone camera testing is still required.</p>}
    <p className="small" style={{marginTop:22}}>Sample model from <a href="https://modelviewer.dev/" target="_blank" rel="noreferrer">modelviewer.dev</a>. This demo cannot publish a product model.</p>
  </div>;
}
function NotFound(){return <Shell><Header eyebrow="NOT FOUND / 404" title="This view doesn't exist." desc="The page may have moved, or the address might be incorrect." action={<Link href="/dashboard" className="btn btn-primary" data-testid="link-return-dashboard"><ArrowLeft size={14}/> Back to overview</Link>}/><Empty title="Nothing at this address" description="Use the navigation to return to your workspace." icon={Grid2X2}/></Shell>}
function RoutedErrorBoundary({children}:{children:ReactNode}){const [location]=useLocation();return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>}
function Routes(){return <RoutedErrorBoundary><Switch><Route path="/ar/:token" component={ArPreview}/><Route path="/demo-ar" component={FreeArDemo}/><Route path="/"><Shell><Dashboard/></Shell></Route><Route path="/dashboard"><Shell><Dashboard/></Shell></Route><Route path="/products/:id"><Shell><ProductDetail/></Shell></Route><Route path="/products"><Shell><Products/></Shell></Route><Route path="/models/:id"><Shell><ModelDetail/></Shell></Route><Route path="/models"><Shell><Models/></Shell></Route><Route path="/queue"><Shell><Queue/></Shell></Route><Route path="/settings"><Shell><Settings/></Shell></Route><Route path="/status"><Shell><Status/></Shell></Route><Route path="/logs"><Shell><Logs/></Shell></Route><Route component={NotFound}/></Switch></RoutedErrorBoundary>}
function App(){return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/,'')}><Routes/></WouterRouter></QueryClientProvider>}
export default App;