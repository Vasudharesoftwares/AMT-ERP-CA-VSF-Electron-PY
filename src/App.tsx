import { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, Users, Package, FileText, Plus, Search, Printer, RefreshCw, ShoppingCart, Boxes, X, Pencil, Eye, Truck } from 'lucide-react';

const API='http://127.0.0.1:8765/api';
type LicenseStatus={activated:boolean;product_id?:string;license_id?:string;status?:string;starts_at?:string;expires_at?:string;days_remaining?:number|null;message?:string};
const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n||0);
const GST_STATES=[['01','Jammu & Kashmir'],['02','Himachal Pradesh'],['03','Punjab'],['04','Chandigarh'],['05','Uttarakhand'],['06','Haryana'],['07','Delhi'],['08','Rajasthan'],['09','Uttar Pradesh'],['10','Bihar'],['11','Sikkim'],['12','Arunachal Pradesh'],['13','Nagaland'],['14','Manipur'],['15','Mizoram'],['16','Tripura'],['17','Meghalaya'],['18','Assam'],['19','West Bengal'],['20','Jharkhand'],['21','Odisha'],['22','Chhattisgarh'],['23','Madhya Pradesh'],['24','Gujarat'],['26','Dadra & Nagar Haveli and Daman & Diu'],['27','Maharashtra'],['28','Andhra Pradesh (old)'],['29','Karnataka'],['30','Goa'],['31','Lakshadweep'],['32','Kerala'],['33','Tamil Nadu'],['34','Puducherry'],['35','Andaman & Nicobar'],['36','Telangana'],['37','Andhra Pradesh'],['38','Ladakh'],['97','Other Territory']] as const;
type Customer={id:number;name:string;customer_type:string;contact_person:string;phone:string;email:string;address:string};
type Vendor={id:number;name:string;phone:string;email:string;address:string};
type Purchase={id:number;purchase_no:string;vendor_invoice_no:string;purchase_date:string;vendor:Vendor;subtotal:number;gst_enabled:boolean;supplier_state_code:string;company_state_code:string;cgst_total:number;sgst_total:number;igst_total:number;gst_total:number;grand_total:number;paid_amount:number;balance:number;notes:string;lines:{product_id:number;product_name:string;sku:string;quantity:number;rate:number;amount:number;gst_applicable:boolean;gst_rate:number;hsn_code:string;taxable_amount:number;cgst_amount:number;sgst_amount:number;igst_amount:number;gst_amount:number;total_amount:number}[]};
type Product={id:number;name:string;sku:string;unit:string;selling_price:number;stock_qty:number;gst_applicable:boolean;gst_rate:number;hsn_code:string};
type GSTSettings={enabled:boolean;gstin:string;state_code:string;business_name:string;business_address:string;business_mobile:string};
type Line={product_id:number;quantity:number;rate:number};
type Invoice={id:number;invoice_no:string;invoice_date:string;customer:{name:string;phone:string;address:string};subtotal:number;discount:number;gst_enabled:boolean;customer_state_code:string;company_state_code:string;cgst_total:number;sgst_total:number;igst_total:number;gst_total:number;grand_total:number;paid_amount:number;balance:number;notes:string;lines:{product_name:string;sku:string;quantity:number;rate:number;amount:number;gst_applicable:boolean;gst_rate:number;hsn_code:string;taxable_amount:number;cgst_amount:number;sgst_amount:number;igst_amount:number;gst_amount:number;total_amount:number}[]};
export default function App(){
 const [page,setPage]=useState(()=>{try{return window.localStorage.getItem('vsf-active-page')||'Dashboard'}catch{return 'Dashboard'}}),[customers,setCustomers]=useState<Customer[]>([]),[products,setProducts]=useState<Product[]>([]),[invoices,setInvoices]=useState<Invoice[]>([]),[vendors,setVendors]=useState<Vendor[]>([]),[purchases,setPurchases]=useState<Purchase[]>([]),[dash,setDash]=useState<any>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [licenseStatus,setLicenseStatus]=useState<LicenseStatus|null>(null);
 const [licenseFile,setLicenseFile]=useState<File|null>(null);
 const [licenseKey,setLicenseKey]=useState('');
 const [activationBusy,setActivationBusy]=useState(false);
 const [activationMessage,setActivationMessage]=useState('');
 const isLicenseActive=licenseStatus?.activated===true&&licenseStatus.status==='active';
 const [customerForm,setCustomerForm]=useState({name:'',phone:'',email:'',address:''});
 const [showSalesCustomerForm,setShowSalesCustomerForm]=useState(false);
 const [salesCustomerForm,setSalesCustomerForm]=useState({name:'',customer_type:'individual',contact_person:'',phone:'',email:'',address:''});
 const [productForm,setProductForm]=useState({name:'',sku:'',unit:'pcs',selling_price:0,stock_qty:0,gst_applicable:false,gst_rate:0,hsn_code:''});
 const [editingProductId,setEditingProductId]=useState<number|null>(null);
 const [editingProductForm,setEditingProductForm]=useState({name:'',sku:'',unit:'pcs',selling_price:0,stock_qty:0,gst_applicable:false,gst_rate:0,hsn_code:''});
 const [gstSettings,setGstSettings]=useState<GSTSettings>({enabled:false,gstin:'',state_code:'',business_name:'',business_address:'',business_mobile:''});
 const [gstSettingsSaving,setGstSettingsSaving]=useState(false);
 const [inventorySearch,setInventorySearch]=useState('');
 const [purchaseVendorId,setPurchaseVendorId]=useState(''),[purchaseDate,setPurchaseDate]=useState(new Date().toISOString().slice(0,10)),[vendorInvoiceNo,setVendorInvoiceNo]=useState(''),[purchasePaid,setPurchasePaid]=useState(0),[purchaseNotes,setPurchaseNotes]=useState(''),[purchaseSupplierState,setPurchaseSupplierState]=useState('');
 const [purchaseLines,setPurchaseLines]=useState<Line[]>([]);
 const [showVendorForm,setShowVendorForm]=useState(false),[showPurchaseProductForm,setShowPurchaseProductForm]=useState(false);
 const [editingPurchaseId,setEditingPurchaseId]=useState<number|null>(null),[selectedPurchase,setSelectedPurchase]=useState<Purchase|null>(null);
 const [vendorForm,setVendorForm]=useState({name:'',phone:'',email:'',address:''});
 const [editingVendorId,setEditingVendorId]=useState<number|null>(null);
 const [vendorSearch,setVendorSearch]=useState('');
 const [selectedVendorId,setSelectedVendorId]=useState<number|null>(null);
 const [purchaseProductForm,setPurchaseProductForm]=useState({name:'',sku:'',unit:'pcs',selling_price:0,gst_applicable:false,gst_rate:0,hsn_code:''});
 const [customerId,setCustomerId]=useState(''),[lines,setLines]=useState<Line[]>([]),[discount,setDiscount]=useState(0),[paid,setPaid]=useState(0),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[search,setSearch]=useState('');
 const [salesCustomerState,setSalesCustomerState]=useState('');
 const load=async()=>{try{const [c,p,i,d,v,pu,g]=await Promise.all(['customers','products','invoices','dashboard','vendors','purchases'].map(x=>fetch(`${API}/${x}`).then(r=>{if(!r.ok)throw Error(`${x} API request failed`);return r.json()})).concat([fetch(`${API}/gst/settings`).then(r=>{if(!r.ok)throw Error('GST settings API request failed');return r.json()})]));setCustomers(c);setProducts(p);setInvoices(i);setDash(d);setVendors(v);setPurchases(pu);setGstSettings(g);setError('')}catch(e:any){setError('Cannot load business data. Check that the backend is running on port 8765. '+e.message)}};
 useEffect(()=>{load()},[]);
 useEffect(()=>{
  fetch(`${API}/license/status`)
   .then(r=>r.json())
   .then(data=>setLicenseStatus(data))
   .catch(()=>setLicenseStatus({activated:false,status:'invalid',message:'Could not check license status. Check that the backend is running.'}));
 },[]);
 useEffect(()=>{try{window.localStorage.setItem('vsf-active-page',page)}catch{}},[page]);
 const subtotal=useMemo(()=>lines.reduce((s,l)=>s+l.quantity*l.rate,0),[lines]),total=Math.max(0,subtotal-discount);
 const purchaseSubtotal=useMemo(()=>purchaseLines.reduce((s,l)=>s+l.quantity*l.rate,0),[purchaseLines]);
 const purchaseNeedsSupplierState=gstSettings.enabled&&purchaseLines.some(line=>{const p=products.find(x=>x.id===line.product_id);return !!(p?.gst_applicable&&Number(p.gst_rate)>0)});
 const purchaseLineTax=(line:Line)=>{const p=products.find(x=>x.id===line.product_id);const taxable=Math.round(line.quantity*line.rate*100)/100;const rate=Number(p?.gst_rate)||0;if(!gstSettings.enabled||!p?.gst_applicable||rate<=0||!purchaseSupplierState||!gstSettings.state_code)return {taxable,cgst:0,sgst:0,igst:0,gst:0};const roundedTax=Math.round(taxable*rate)/100;const cgst=purchaseSupplierState===gstSettings.state_code?Math.round(roundedTax/2*100)/100:0;const sgst=purchaseSupplierState===gstSettings.state_code?Math.round((roundedTax-cgst)*100)/100:0;const igst=purchaseSupplierState===gstSettings.state_code?0:roundedTax;return {taxable,cgst,sgst,igst,gst:Math.round((cgst+sgst+igst)*100)/100}};
 const purchaseTaxTotals=useMemo(()=>purchaseLines.reduce((sum,line)=>{const t=purchaseLineTax(line);sum.cgst+=t.cgst;sum.sgst+=t.sgst;sum.igst+=t.igst;return sum},{cgst:0,sgst:0,igst:0}),[purchaseLines,products,gstSettings,purchaseSupplierState]);
 const purchaseGstTotal=Math.round((purchaseTaxTotals.cgst+purchaseTaxTotals.sgst+purchaseTaxTotals.igst)*100)/100;
 const purchaseGrandTotal=Math.round((purchaseSubtotal+purchaseGstTotal)*100)/100;
 const purchaseBalance=Math.max(0,purchaseGrandTotal-purchasePaid);
 const salesNeedsCustomerState=gstSettings.enabled&&lines.some(line=>{
  const p=products.find(x=>x.id===line.product_id);
  return !!(p?.gst_applicable&&Number(p.gst_rate)>0);
 });
 const salesTaxPreview=(()=>{
  const result={cgst:0,sgst:0,igst:0,gst:0};
  if(!salesNeedsCustomerState||!salesCustomerState||!gstSettings.state_code)return result;
  const amounts=lines.map(line=>Math.max(0,Math.round(line.quantity*line.rate*100)));
  const subtotalCents=amounts.reduce((sum,value)=>sum+value,0);
  let remainingDiscount=Math.min(Math.round(discount*100),subtotalCents);
  let remainingAmount=subtotalCents;
  lines.forEach((line,index)=>{
   const amountCents=amounts[index];
   let allocation=0;
   if(index===lines.length-1)allocation=remainingDiscount;
   else if(remainingAmount)allocation=Math.min(remainingDiscount,Math.round(remainingDiscount*amountCents/remainingAmount));
   remainingDiscount-=allocation;
   remainingAmount-=amountCents;
   const p=products.find(x=>x.id===line.product_id);
   const rate=Number(p?.gst_rate)||0;
   if(!p?.gst_applicable||rate<=0)return;
   const taxableCents=Math.max(0,amountCents-allocation);
   const taxCents=Math.round(taxableCents*rate/100);
   if(salesCustomerState===gstSettings.state_code){
    const cgstCents=Math.round(taxCents/2);
    result.cgst+=cgstCents/100;
    result.sgst+=(taxCents-cgstCents)/100;
   }else{
    result.igst+=taxCents/100;
   }
  });
  result.cgst=Math.round(result.cgst*100)/100;
  result.sgst=Math.round(result.sgst*100)/100;
  result.igst=Math.round(result.igst*100)/100;
  result.gst=Math.round((result.cgst+result.sgst+result.igst)*100)/100;
  return result;
 })();
 const salesGrandTotal=Math.round((Math.max(0,subtotal-discount)+salesTaxPreview.gst)*100)/100;
 const salesTrend=useMemo(()=>{
  const days=Array.from({length:7},(_,i)=>{
   const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-6+i);
   const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
   return {key,label:d.toLocaleDateString('en-IN',{day:'numeric',month:'short'}),amount:0};
  });
  invoices.forEach(inv=>{const day=days.find(x=>x.key===String(inv.invoice_date).slice(0,10));if(day)day.amount+=Number(inv.grand_total)||0});
  return days;
 },[invoices]);
 const salesTrendMax=Math.max(1,...salesTrend.map(x=>x.amount));
 const salesPurchaseBars=[{label:'Sales',value:Number(dash.sales_total)||0},{label:'Purchases',value:Number(dash.purchase_total)||0}];
 const salesPurchaseMax=Math.max(1,...salesPurchaseBars.map(x=>x.value));
 const stockChart=useMemo(()=>[...products].sort((a,b)=>b.stock_qty-a.stock_qty).slice(0,6),[products]);
 const stockChartMax=Math.max(1,...stockChart.map(x=>x.stock_qty));
 const topProducts=useMemo(()=>{
  const totals=new Map<string,number>();
  invoices.forEach(inv=>inv.lines?.forEach(line=>totals.set(line.product_name,(totals.get(line.product_name)||0)+(Number(line.quantity)||0))));
  return [...totals.entries()].map(([name,quantity])=>({name,quantity})).sort((a,b)=>b.quantity-a.quantity).slice(0,6);
 },[invoices]);
 const topProductsMax=Math.max(1,...topProducts.map(x=>x.quantity));
 const saveGstSettings=async()=>{if(!isLicenseActive){setError('This ERP is read-only because its license is not active.');return}setGstSettingsSaving(true);setError('');try{const r=await fetch(`${API}/gst/settings`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(gstSettings)});const result=await r.json();if(!r.ok)throw Error(result.detail||'Could not save GST settings');setGstSettings(result);setError('')}catch(e:any){setError(e.message||'Could not save GST settings')}finally{setGstSettingsSaving(false)}};
 const createVendor=async()=>{if(!isLicenseActive){setError('This ERP is read-only because its license is not active.');return}setBusy(true);setError('');try{const r=await fetch(`${API}/vendors`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(vendorForm)});const v=await r.json();if(!r.ok)throw Error(v.detail||'Could not create vendor');setVendors(old=>[...old,v].sort((a,b)=>a.name.localeCompare(b.name)));setPurchaseVendorId(String(v.id));setVendorForm({name:'',phone:'',email:'',address:''});setShowVendorForm(false)}catch(e:any){setError(typeof e.message==='string'?e.message:'Could not create vendor')}finally{setBusy(false)}};
 const saveVendorDirectory=async()=>{
  if(!isLicenseActive){setError('This ERP is read-only because its license is not active.');return}
  if(!vendorForm.name.trim()){setError('Enter a vendor name.');return}
  setBusy(true);setError('');
  try{
   const editing=editingVendorId!==null;
   const url=editing?`${API}/vendors/${editingVendorId}`:`${API}/vendors`;
   const r=await fetch(url,{
    method:editing?'PUT':'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     name:vendorForm.name.trim(),
     phone:vendorForm.phone.trim(),
     email:vendorForm.email.trim(),
     address:vendorForm.address.trim()
    })
   });
   const result=await r.json();
   if(!r.ok)throw Error(result.detail||'Could not save vendor');
   setVendors(old=>(editing
    ?old.map(v=>v.id===result.id?result:v)
    :[...old,result]
   ).sort((a,b)=>a.name.localeCompare(b.name)));
   setVendorForm({name:'',phone:'',email:'',address:''});
   setEditingVendorId(null);
   setSelectedVendorId(result.id);
  }catch(e:any){
   setError(e.message||'Could not save vendor');
  }finally{
   setBusy(false);
  }
 };
 const beginEditVendor=(vendor:Vendor)=>{
  setEditingVendorId(vendor.id);
  setVendorForm({
   name:vendor.name,
   phone:vendor.phone||'',
   email:vendor.email||'',
   address:vendor.address||''
  });
  setError('');
  window.scrollTo({top:0,behavior:'smooth'});
 };
 const cancelVendorEdit=()=>{
  setEditingVendorId(null);
  setVendorForm({name:'',phone:'',email:'',address:''});
 };

 const createSalesCustomer=async()=>{
  if(!isLicenseActive){setError('This ERP is read-only because its license is not active.');return}
  if(!salesCustomerForm.name.trim()){setError('Enter a customer or firm name.');return}
  setBusy(true);setError('');
  try{
   const r=await fetch(`${API}/customers`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(salesCustomerForm)});
   const customer=await r.json();
   if(!r.ok)throw Error(customer.detail||'Could not create customer');
   setCustomers(old=>[...old,customer].sort((a,b)=>a.name.localeCompare(b.name)));
   setCustomerId(String(customer.id));
   setSalesCustomerForm({name:'',customer_type:'individual',contact_person:'',phone:'',email:'',address:''});
   setShowSalesCustomerForm(false);
  }catch(e:any){setError(e.message||'Could not create customer')}
  finally{setBusy(false)}
 };
 const saveProductEdit=async()=>{
  if(!isLicenseActive){setError('This ERP is read-only because its license is not active.');return}
  if(!editingProductId)return;
  setBusy(true);setError('');
  try{
   const r=await fetch(`${API}/products/${editingProductId}`,{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(editingProductForm)
   });
   const result=await r.json();
   if(!r.ok)throw Error(result.detail||'Could not update product');
   setProducts(old=>old.map(p=>p.id===result.id?result:p).sort((a,b)=>a.name.localeCompare(b.name)));
   setEditingProductId(null);
   setEditingProductForm({name:'',sku:'',unit:'pcs',selling_price:0,stock_qty:0,gst_applicable:false,gst_rate:0,hsn_code:''});
  }catch(e:any){
   setError(e.message||'Could not update product');
  }finally{
   setBusy(false);
  }
 };
 const createPurchaseProduct=async()=>{if(!isLicenseActive){setError('This ERP is read-only because its license is not active.');return}setBusy(true);setError('');try{const r=await fetch(`${API}/products`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...purchaseProductForm,stock_qty:0})});const product=await r.json();if(!r.ok)throw Error(typeof product.detail==='string'?product.detail:'Could not create product');setProducts(old=>[...old,product].sort((a,b)=>a.name.localeCompare(b.name)));setPurchaseLines(old=>[...old,{product_id:product.id,quantity:1,rate:0}]);setPurchaseProductForm({name:'',sku:'',unit:'pcs',selling_price:0,gst_applicable:false,gst_rate:0,hsn_code:''});setShowPurchaseProductForm(false)}catch(e:any){setError(e.message||'Could not create product')}finally{setBusy(false)}};

 const resetPurchaseForm=()=>{setPurchaseLines([]);setPurchaseVendorId('');setVendorInvoiceNo('');setPurchasePaid(0);setPurchaseNotes('');setPurchaseDate(new Date().toISOString().slice(0,10));setPurchaseSupplierState('');setEditingPurchaseId(null);setShowVendorForm(false);setShowPurchaseProductForm(false)};
 const beginEditPurchase=(p:Purchase)=>{if(!isLicenseActive){setError('This ERP is read-only because its license is not active.');return}setEditingPurchaseId(p.id);setSelectedPurchase(null);setPurchaseVendorId(String(p.vendor.id));setVendorInvoiceNo(p.vendor_invoice_no||'');setPurchaseDate(p.purchase_date);setPurchasePaid(p.paid_amount);setPurchaseNotes(p.notes||'');setPurchaseSupplierState(p.supplier_state_code||'');setPurchaseLines(p.lines.map(line=>({product_id:line.product_id,quantity:line.quantity,rate:line.rate})));window.scrollTo({top:0,behavior:'smooth'})};
 const savePurchase=async()=>{if(!isLicenseActive){setError('This ERP is read-only because its license is not active.');return}if(!purchaseVendorId){setError('Please select a vendor.');return}if(!purchaseLines.length||purchaseLines.some(x=>!x.product_id||x.quantity<=0||x.rate<0)){setError('Please complete every purchase item.');return}if(purchaseNeedsSupplierState&&!purchaseSupplierState){setError('Select the supplier GST state for GST-applicable purchase items.');return}if(purchasePaid>purchaseGrandTotal){setError('Paid amount cannot exceed purchase total including GST.');return}const payload={vendor_id:+purchaseVendorId,vendor_invoice_no:vendorInvoiceNo,purchase_date:purchaseDate,paid_amount:purchasePaid,notes:purchaseNotes,supplier_state_code:purchaseSupplierState,lines:purchaseLines};if(!editingPurchaseId){save('purchases',payload,resetPurchaseForm);return}setBusy(true);setError('');try{const r=await fetch(`${API}/purchases/${editingPurchaseId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await r.json();if(!r.ok)throw Error(result.detail||'Could not update purchase');resetPurchaseForm();setSelectedPurchase(null);await load()}catch(e:any){setError(e.message||'Could not update purchase')}finally{setBusy(false)}};

 const save=async(url:string,data:any,done:()=>void)=>{if(!isLicenseActive){setError('This ERP is read-only because its license is not active.');return}setBusy(true);setError('');try{const r=await fetch(`${API}/${url}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const v=await r.json();if(!r.ok)throw Error(v.detail||'Could not save');done();await load()}catch(e:any){setError(e.message)}finally{setBusy(false)}};
 const handleLicenseActivation=async(e:React.FormEvent<HTMLFormElement>)=>{
  e.preventDefault();
  if(!licenseFile||!licenseKey.trim()){
   setActivationMessage('Choose your license JSON file and enter the license key.');
   return;
  }
  setActivationBusy(true);
  setActivationMessage('');
  try{
   const licenseRecord=JSON.parse(await licenseFile.text());
   const response=await fetch(`${API}/license/activate`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({license_record:licenseRecord,license_key:licenseKey})
   });
   const result=await response.json();
   if(!response.ok)throw Error(result.detail||'License activation failed.');
   setLicenseKey('');
   setLicenseFile(null);
   setLicenseStatus(await fetch(`${API}/license/status`).then(r=>r.json()));
   setActivationMessage('License activated successfully.');
   await load();
  }catch(err:any){
   setActivationMessage(err.message||'Could not activate this license.');
  }finally{
   setActivationBusy(false);
  }
 };
 const nav=[['Dashboard',LayoutDashboard],['Sales',ShoppingCart],['Purchase',FileText],['Inventory',Boxes],['Customers',Users],['Vendors',Truck]] as const;
 if(licenseStatus===null)return <div className="license-screen"><section className="license-card"><div className="brandicon">V</div><h2>VASUDHARE SALESFORCE</h2><p className="muted">Checking your software license…</p></section></div>;
 const activationForm=<form onSubmit={handleLicenseActivation} className="license-form">
  <div><label>License JSON file</label><input type="file" accept=".json,application/json" onChange={e=>setLicenseFile(e.target.files?.[0]||null)}/></div>
  <div><label>License key</label><input type="password" autoComplete="off" value={licenseKey} onChange={e=>setLicenseKey(e.target.value)} placeholder="Enter your license key"/></div>
  <button className="primary" type="submit" disabled={activationBusy||!licenseFile||!licenseKey.trim()}>{activationBusy?'Activating…':'Activate license'}</button>
  {activationMessage&&<p role="status">{activationMessage}</p>}
 </form>;
 if(licenseStatus.status==='not_activated')return <div className="license-screen"><section className="license-card"><div className="brandicon">V</div><p className="license-eyebrow">BUSINESS MANAGEMENT</p><h2>Activate VasudhAre Salesforce</h2><p className="muted">Enter the license key and select the signed license file supplied by your software administrator to activate this installation.</p>{activationForm}</section></div>;
 return <div className="app"><aside className="sidebar"><div className="brand"><div className="brandicon">V</div><div><b>VASUDHARE SALESFORCE</b><small>BUSINESS MANAGEMENT</small></div></div><div className="navlabel">WORKSPACE</div>{nav.map(([n,I])=><button className={'nav '+(page===n?'active':'')} onClick={()=>setPage(n)} key={n}><I size={18}/>{n}</button>)}<div className="sidebottom"><span className="dot"/> Local database connected when API is running</div></aside><main className={'main '+(!isLicenseActive?'license-readonly':'')}>
 {isLicenseActive&&<div className="panel license-status-active" style={{marginBottom:18}}>
  <div><b>License active</b><span> · VasudhAre Salesforce</span></div><div className="license-dates">Valid from {licenseStatus.starts_at||'—'} · Expires {licenseStatus.expires_at||'—'} · {licenseStatus.days_remaining??'—'} days remaining</div>
  {typeof licenseStatus.days_remaining==='number'&&licenseStatus.days_remaining<=30&&<p className="license-warning" role="status">{licenseStatus.days_remaining<=7?'Your license expires soon. Please arrange renewal immediately.':licenseStatus.days_remaining<=15?'Your license expires within 15 days. Please arrange renewal.':'Your license expires within 30 days. Please arrange renewal.'}</p>}
 </div>}
 {!isLicenseActive&&<section className="panel license-status-inactive" style={{marginBottom:22}}>
  <div className="license-inactive-heading"><div><span className="license-eyebrow">LICENSE STATUS</span><h3>{licenseStatus.status==='expired'?'License expired':licenseStatus.status==='suspended'?'License suspended':licenseStatus.status==='revoked'?'License revoked':licenseStatus.status==='not_yet_valid'?'License not yet valid':'License verification unavailable'}</h3></div><span className="license-state-pill">{(licenseStatus.status||'invalid').replace(/_/g,' ')}</span></div>
  <p className="muted">{licenseStatus.message||'This installation is in read-only mode. Install an active license to restore business operations.'}</p>
  {licenseStatus.starts_at&&<p className="license-dates">Start: {licenseStatus.starts_at} · Expiry: {licenseStatus.expires_at||'—'}</p>}
  <div className="license-readonly-note">Read-only mode: you can view existing records and use available viewing and printing features. Creating or editing business records is disabled until an active license is installed.</div>
  <details className="license-renewal-details"><summary>Install a renewal or replacement license</summary><p className="muted">Select the new signed license file supplied by your software administrator and enter its matching license key.</p>{activationForm}</details>
 </section>}<header><div><small>VASUDHARE SALESFORCE / {page.toUpperCase()}</small><h2>{page}</h2></div><button className="outline" onClick={load}><RefreshCw size={15}/> Refresh</button></header>{error&&<div className="error">{error}</div>}
 {page==='Dashboard'&&<>
 <p className="muted">Welcome back. Here's your business overview.</p>
 <section className="panel" style={{marginTop:18}}>
  <div className="linehead"><div><h3 style={{marginBottom:5}}>Business details</h3><p className="muted" style={{margin:0}}>These details appear on your printed invoices. GST registration is optional.</p></div></div>
  <div className="formgrid" style={{marginTop:18}}>
   <div><label className="fieldlabel">Shop / Business Name</label><input maxLength={200} placeholder="Enter business name" value={gstSettings.business_name} onChange={e=>setGstSettings({...gstSettings,business_name:e.target.value})}/></div>
   <div><label className="fieldlabel">Mobile Number</label><input maxLength={30} placeholder="Business contact number" value={gstSettings.business_mobile} onChange={e=>setGstSettings({...gstSettings,business_mobile:e.target.value})}/></div>
   <div style={{gridColumn:"1 / -1"}}><label className="fieldlabel">Business Address</label><textarea rows={4} style={{width:"100%",boxSizing:"border-box",minHeight:104,padding:"12px 14px",borderRadius:10,lineHeight:1.5,resize:"vertical"}} placeholder="Enter shop / building, street, area, city, state and PIN code" value={gstSettings.business_address} onChange={e=>setGstSettings({...gstSettings,business_address:e.target.value})}/></div>
  </div>
  <div style={{marginTop:16}}>
   <label style={{display:"inline-flex",width:"fit-content",alignItems:"center",gap:8,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}><input style={{width:16,height:16,margin:0,flex:"0 0 auto"}} type="checkbox" checked={gstSettings.enabled} onChange={e=>setGstSettings({...gstSettings,enabled:e.target.checked})}/> <span>Enable GST for this business</span></label>
   {gstSettings.enabled&&<div className="formgrid" style={{marginTop:16}}>
    <div><label className="fieldlabel">Business GSTIN (Optional)</label><input maxLength={15} placeholder="15-character GSTIN, if registered" value={gstSettings.gstin} onChange={e=>setGstSettings({...gstSettings,gstin:e.target.value.toUpperCase()})}/></div>
    <div><label className="fieldlabel">Registered Business State</label><select value={gstSettings.state_code} onChange={e=>setGstSettings({...gstSettings,state_code:e.target.value})}><option value="">Select registered state</option>{GST_STATES.map(([code,name])=><option key={code} value={code}>{code} · {name}</option>)}</select><small className="muted">State code is used to calculate CGST / SGST or IGST.</small></div>
   </div>}
  </div>
  <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}><button type="button" className="primary" disabled={gstSettingsSaving||!isLicenseActive} onClick={saveGstSettings}>{gstSettingsSaving?"Saving business details…":"Save business details"}</button></div>
  {!isLicenseActive&&<small className="muted">Activate the license to change business details.</small>}
 </section>
 <div className="stats">{[['Total sales',money(dash.sales_total),'Revenue'],['Invoices',dash.invoice_count||0,'Created invoices'],['Stock valuation',money(dash.stock_value),'At selling price'],['Low stock',dash.low_stock_count||0,'Products at or below 5']].map(([a,b,c])=><div className="stat"><small>{a}</small><strong>{b}</strong><span>{c}</span></div>)}</div>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:20,marginTop:22}}>
  <section className="panel">
   <h3>Sales trend · Last 7 days</h3>
   <div style={{height:165,display:'flex',alignItems:'flex-end',gap:10,paddingTop:14}}>
    {salesTrend.map(day=><div key={day.key} style={{flex:1,minWidth:0,height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',gap:8}}>
     <small style={{fontSize:10,color:'#64748b',whiteSpace:'nowrap'}}>{day.amount?money(day.amount):''}</small>
     <div title={money(day.amount)} style={{width:'70%',height:`${Math.max(4,day.amount/salesTrendMax*105)}px`,background:'#39966b',borderRadius:'5px 5px 0 0'}}/>
     <small style={{fontSize:10,color:'#64748b'}}>{day.label}</small>
    </div>)}
   </div>
  </section>
  <section className="panel">
   <h3>Sales vs purchases</h3>
   <div style={{display:'flex',gap:24,alignItems:'flex-end',height:165,padding:'14px 12px 0'}}>
    {salesPurchaseBars.map(item=><div key={item.label} style={{flex:1,height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',gap:8}}>
     <b style={{fontSize:12}}>{money(item.value)}</b>
     <div title={money(item.value)} style={{width:'55%',height:`${Math.max(4,item.value/salesPurchaseMax*105)}px`,background:item.label==='Sales'?'#39966b':'#8ba6c1',borderRadius:'5px 5px 0 0'}}/>
     <small className="muted">{item.label}</small>
    </div>)}
   </div>
  </section>
  <section className="panel">
   <h3>Inventory overview · Top 6</h3>
   {stockChart.length?stockChart.map(item=><div key={item.id} style={{marginTop:14}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,fontSize:13,marginBottom:6}}><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</span><b>{item.stock_qty} {item.unit}</b></div>
    <div style={{height:8,background:'#edf1ee',borderRadius:8,overflow:'hidden'}}><div style={{height:'100%',width:`${item.stock_qty/stockChartMax*100}%`,background:'#39966b',borderRadius:8}}/></div>
   </div>):<p className="muted">No products available yet.</p>}
  </section>
  <section className="panel">
   <h3>Top-selling products</h3>
   {topProducts.length?topProducts.map((item,i)=><div key={item.name} style={{marginTop:14}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,fontSize:13,marginBottom:6}}><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{i+1}. {item.name}</span><b>{item.quantity}</b></div>
    <div style={{height:8,background:'#edf1ee',borderRadius:8,overflow:'hidden'}}><div style={{height:'100%',width:`${item.quantity/topProductsMax*100}%`,background:'#8ba6c1',borderRadius:8}}/></div>
   </div>):<p className="muted">Product sales will appear here after invoices are created.</p>}
  </section>
 </div>
 <section className="panel dashboard-recent-invoices" style={{marginTop:22}}><h3>Recent sales invoices</h3><InvoiceTable rows={invoices.slice(0,6)}/></section>
 </>}
 {page==='Vendors'&&<>
  <section className="panel">
   <div className="linehead">
    <div>
     <h3 style={{marginBottom:6}}>{editingVendorId?'Edit vendor':'Add vendor'}</h3>
     <p className="muted" style={{margin:0}}>Vendor details are stored centrally and reused in purchase records.</p>
    </div>
    {editingVendorId!==null&&<button type="button" className="outline" onClick={cancelVendorEdit}>Cancel edit</button>}
   </div>
   <form className="formgrid" onSubmit={e=>{e.preventDefault();saveVendorDirectory()}}>
    <div>
     <label className="fieldlabel">Vendor / supplier name</label>
     <input required maxLength={160} placeholder="Vendor name" value={vendorForm.name} onChange={e=>setVendorForm({...vendorForm,name:e.target.value})}/>
    </div>
    <div>
     <label className="fieldlabel">Phone number</label>
     <input placeholder="Phone number" value={vendorForm.phone} onChange={e=>setVendorForm({...vendorForm,phone:e.target.value})}/>
    </div>
    <div>
     <label className="fieldlabel">Email</label>
     <input type="email" placeholder="Email address" value={vendorForm.email} onChange={e=>setVendorForm({...vendorForm,email:e.target.value})}/>
    </div>
    <div>
     <label className="fieldlabel">Address</label>
     <input placeholder="Vendor address" value={vendorForm.address} onChange={e=>setVendorForm({...vendorForm,address:e.target.value})}/>
    </div>
    <div style={{display:'flex',alignItems:'end',gap:10}}>
     <button className="primary" disabled={busy}>
      <Plus size={16}/>{busy?'Saving…':editingVendorId?'Uate vendor':'Save vendor'}
     </button>
     {editingVendorId!==null&&<button type="button" className="outline" onClick={cancelVendorEdit}>Cancel</button>}
    </div>
   </form>
  </section>

  <section className="panel">
   <div className="linehead">
    <div>
     <h3 style={{marginBottom:5}}>Vendor directory · {vendors.length}</h3>
     <p className="muted" style={{margin:0}}>Purchase totals and outstanding balances are calculated from recorded purchases.</p>
    </div>
   </div>
   <input placeholder="Search vendor by name, phone or email" value={vendorSearch} onChange={e=>setVendorSearch(e.target.value)}/>
   <div className="tablewrap">
    <table>
     <thead><tr><th>Vendor</th><th>Phone</th><th>Email</th><th>Purchases</th><th>Total</th><th>Paid</th><th>Balance</th><th>Actions</th></tr></thead>
     <tbody>
      {vendors.filter(v=>[v.name,v.phone,v.email].some(x=>(x||'').toLowerCase().includes(vendorSearch.toLowerCase()))).map(v=>{
       const rows=purchases.filter(p=>p.vendor?.id===v.id);
       const total=rows.reduce((sum,p)=>sum+(Number(p.grand_total??p.subtotal)||0),0);
       const paidTotal=rows.reduce((sum,p)=>sum+(Number(p.paid_amount)||0),0);
       const balance=rows.reduce((sum,p)=>sum+(Number(p.balance)||0),0);
       return <tr key={v.id}>
        <td><b>{v.name}</b><div className="muted">{v.address||'—'}</div></td>
        <td>{v.phone||'—'}</td>
        <td>{v.email||'—'}</td>
        <td>{rows.length}</td>
        <td>{money(total)}</td>
        <td>{money(paidTotal)}</td>
        <td>{money(balance)}</td>
        <td><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
         <button type="button" className="iconbtn" title="Edit vendor" aria-label={`Edit ${v.name}`} onClick={()=>beginEditVendor(v)}><Pencil size={16}/></button>
         <button type="button" className="outline" onClick={()=>setSelectedVendorId(selectedVendorId===v.id?null:v.id)}>{selectedVendorId===v.id?'Hide purchases':'Purchases'}</button>
        </div></td>
       </tr>;
      })}
      {!vendors.length&&<tr><td colSpan={8} className="muted">No vendors have been added yet.</td></tr>}
      {!!vendors.length&&!vendors.some(v=>[v.name,v.phone,v.email].some(x=>(x||'').toLowerCase().includes(vendorSearch.toLowerCase())))&&<tr><td colSpan={8} className="muted">No vendors match this search.</td></tr>}
     </tbody>
    </table>
   </div>
  </section>

  {selectedVendorId!==null&&(()=>{
   const vendor=vendors.find(v=>v.id===selectedVendorId);
   const rows=purchases.filter(p=>p.vendor?.id===selectedVendorId);
   return vendor?<section className="panel">
    <div className="linehead">
     <div><h3 style={{margin:0}}>Purchase history · {vendor.name}</h3><p className="muted" style={{margin:'6px 0 0'}}>Existing purchases remain linked to this vendor.</p></div>
     <button type="button" className="outline" onClick={()=>setSelectedVendorId(null)}>Close</button>
    </div>
    <div className="tablewrap">
     <table><thead><tr><th>Purchase no.</th><th>Date</th><th>Vendor invoice</th><th>Total</th><th>Paid</th><th>Balance</th></tr></thead>
      <tbody>{rows.map(p=><tr key={p.id}><td><b>{p.purchase_no}</b></td><td>{p.purchase_date}</td><td>{p.vendor_invoice_no||'—'}</td><td>{money(p.grand_total??p.subtotal)}</td><td>{money(p.paid_amount)}</td><td>{money(p.balance)}</td></tr>)}
       {!rows.length&&<tr><td colSpan={6} className="muted">No purchases recorded for this vendor.</td></tr>}
      </tbody>
     </table>
    </div>
   </section>:null;
  })()}
 </>}
 {page==='Customers'&&<><section className="panel"><h3>Add customer</h3><form className="formgrid" onSubmit={e=>{e.preventDefault();save('customers',customerForm,()=>setCustomerForm({name:'',phone:'',email:'',address:''}))}}><input required placeholder="Customer name" value={customerForm.name} onChange={e=>setCustomerForm({...customerForm,name:e.target.value})}/><input placeholder="Phone" value={customerForm.phone} onChange={e=>setCustomerForm({...customerForm,phone:e.target.value})}/><input placeholder="Email" value={customerForm.email} onChange={e=>setCustomerForm({...customerForm,email:e.target.value})}/><input placeholder="Address" value={customerForm.address} onChange={e=>setCustomerForm({...customerForm,address:e.target.value})}/><button className="primary"><Plus size={16}/> Save customer</button></form></section><section className="panel"><h3>Customer directory · {customers.length}</h3><input placeholder="Search customers" value={search} onChange={e=>setSearch(e.target.value)}/><div className="tablewrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Address</th></tr></thead><tbody>{customers.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())).map(c=><tr><td>{c.name}</td><td>{c.phone}</td><td>{c.email}</td><td>{c.address}</td></tr>)}</tbody></table></div></section></>}
 {page==='Inventory'&&<>
 {editingProductId!==null&&<section className="panel">
  <div className="linehead"><h3 style={{margin:0}}>Edit product</h3><button type="button" className="outline" onClick={()=>setEditingProductId(null)}>Cancel</button></div>
  <form className="formgrid" onSubmit={e=>{e.preventDefault();saveProductEdit()}}>
   <div><label className="fieldlabel">Product name</label><input required value={editingProductForm.name} onChange={e=>setEditingProductForm({...editingProductForm,name:e.target.value})}/></div>
   <div><label className="fieldlabel">SKU / Code</label><input required value={editingProductForm.sku} onChange={e=>setEditingProductForm({...editingProductForm,sku:e.target.value})}/></div>
   <div><label className="fieldlabel">Unit</label><input value={editingProductForm.unit} onChange={e=>setEditingProductForm({...editingProductForm,unit:e.target.value})}/></div>
   <div><label className="fieldlabel">Selling price (₹)</label><input type="number" min="0" step=".01" value={editingProductForm.selling_price} onChange={e=>setEditingProductForm({...editingProductForm,selling_price:+e.target.value})}/></div>
   <div><label className="fieldlabel">Available stock</label><input type="number" min="0" step=".01" value={editingProductForm.stock_qty} onChange={e=>setEditingProductForm({...editingProductForm,stock_qty:+e.target.value})}/></div>
   <div style={{gridColumn:'1 / -1'}}><label style={{display:'flex',alignItems:'center',gap:9,fontWeight:600}}><input type="checkbox" checked={editingProductForm.gst_applicable} onChange={e=>setEditingProductForm({...editingProductForm,gst_applicable:e.target.checked,gst_rate:e.target.checked?editingProductForm.gst_rate:0})}/> GST applies to this product</label>{editingProductForm.gst_applicable&&<div className="formgrid" style={{marginTop:12}}><div><label className="fieldlabel">GST rate</label><select value={editingProductForm.gst_rate} onChange={e=>setEditingProductForm({...editingProductForm,gst_rate:+e.target.value})}><option value={0}>Select GST rate</option>{[5,12,18,28].map(rate=><option key={rate} value={rate}>{rate}%</option>)}</select></div><div><label className="fieldlabel">HSN code (optional)</label><input maxLength={20} value={editingProductForm.hsn_code} onChange={e=>setEditingProductForm({...editingProductForm,hsn_code:e.target.value})} placeholder="Enter HSN code"/></div></div>}</div>
   <div className="edit-actions"><button className="primary" disabled={busy}>{busy?'Saving…':'Save changes'}</button></div>
  </form>
  <p className="muted" style={{margin:'8px 0 0'}}>Stock changes are saved in the stock movement history.</p>
 </section>}
 <section className="panel">
  <h3>Add product / opening stock</h3>
  <form className="formgrid" onSubmit={e=>{e.preventDefault();save('products',productForm,()=>setProductForm({name:'',sku:'',unit:'pcs',selling_price:0,stock_qty:0,gst_applicable:false,gst_rate:0,hsn_code:''}))}}>
   <div><label className="fieldlabel">Product name</label><input required placeholder="Enter product name" value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})}/></div>
   <div><label className="fieldlabel">SKU / Code</label><input required placeholder="Unique product code" value={productForm.sku} onChange={e=>setProductForm({...productForm,sku:e.target.value})}/></div>
   <div><label className="fieldlabel">Unit</label><input placeholder="pcs" value={productForm.unit} onChange={e=>setProductForm({...productForm,unit:e.target.value})}/></div>
   <div><label className="fieldlabel">Selling price (₹)</label><input type="number" min="0" step=".01" value={productForm.selling_price} onChange={e=>setProductForm({...productForm,selling_price:+e.target.value})}/></div>
   <div><label className="fieldlabel">Opening stock</label><input type="number" min="0" step=".01" value={productForm.stock_qty} onChange={e=>setProductForm({...productForm,stock_qty:+e.target.value})}/></div>
   <div style={{gridColumn:'1 / -1'}}><label style={{display:'flex',alignItems:'center',gap:9,fontWeight:600}}><input type="checkbox" checked={productForm.gst_applicable} onChange={e=>setProductForm({...productForm,gst_applicable:e.target.checked,gst_rate:e.target.checked?productForm.gst_rate:0})}/> GST applies to this product</label>{productForm.gst_applicable&&<div className="formgrid" style={{marginTop:12}}><div><label className="fieldlabel">GST rate</label><select value={productForm.gst_rate} onChange={e=>setProductForm({...productForm,gst_rate:+e.target.value})}><option value={0}>Select GST rate</option>{[5,12,18,28].map(rate=><option key={rate} value={rate}>{rate}%</option>)}</select></div><div><label className="fieldlabel">HSN code (optional)</label><input maxLength={20} value={productForm.hsn_code} onChange={e=>setProductForm({...productForm,hsn_code:e.target.value})} placeholder="Enter HSN code"/></div></div>}</div>
   <div className="edit-actions"><button className="primary" disabled={busy}><Plus size={16}/> Save product</button></div>
  </form>
 </section>
 <section className="panel">
  <div className="inventory-toolbar">
   <h3>Products · {products.length}</h3>
   <input className="inventory-search" placeholder="Search product or SKU…" value={inventorySearch} onChange={e=>setInventorySearch(e.target.value)}/>
  </div>
  <div className="tablewrap">
   <table><thead><tr><th>Product</th><th>SKU</th><th>Unit</th><th>Price</th><th>Available stock</th><th>Action</th></tr></thead>
    <tbody>{products.filter(p=>(p.name+' '+p.sku).toLowerCase().includes(inventorySearch.toLowerCase())).map(p=><tr key={p.id}>
     <td>{p.name}</td><td>{p.sku}</td><td>{p.unit}</td><td>{money(p.selling_price)}</td><td>{p.stock_qty}</td>
     <td><button type="button" className="outline row-action" onClick={()=>{setEditingProductId(p.id);setEditingProductForm({name:p.name,sku:p.sku,unit:p.unit,selling_price:p.selling_price,stock_qty:p.stock_qty,gst_applicable:!!p.gst_applicable,gst_rate:Number(p.gst_rate)||0,hsn_code:p.hsn_code||''});window.scrollTo({top:0,behavior:'smooth'})}}><Pencil size={14}/> Edit</button></td>
    </tr>)}</tbody>
   </table>
   {products.length>0&&products.filter(p=>(p.name+' '+p.sku).toLowerCase().includes(inventorySearch.toLowerCase())).length===0&&<p className="muted">No products match your search.</p>}
  </div>
 </section>
 </>}
 {page==='Sales'&&<>
 <section className="panel sales-invoice-panel">
  <div className="sales-panel-heading">
   <div>
    <h3>Create sales invoice</h3>
    <p className="muted">Add products to automatically calculate their saved GST rates and HSN details.</p>
   </div>
   <span className="sales-section-number">NEW INVOICE</span>
  </div>

  <form className="sales-form" onSubmit={e=>{
   e.preventDefault();
   if(salesNeedsCustomerState&&!salesCustomerState){
    setError('Select the customer state to calculate GST.');
    return;
   }
   if(paid>salesGrandTotal){
    setError('Paid amount cannot exceed the invoice total including GST.');
    return;
   }
   save('invoices',{
    customer_id:+customerId,
    invoice_date:date,
    discount,
    paid_amount:paid,
    customer_state_code:salesCustomerState,
    lines
   },()=>{
    setLines([]);
    setDiscount(0);
    setPaid(0);
    setCustomerId('');
    setSalesCustomerState('');
   })
  }}>
   <section className="sales-section">
    <div className="sales-section-heading">
     <span className="sales-step">1</span>
     <div>
      <h4>Invoice information</h4>
      <p>Select the customer and invoice date.</p>
     </div>
    </div>

    <div className="sales-meta-grid">
     <div>
      <label className="fieldlabel">Customer <span className="required-mark">*</span></label>
      <select required value={customerId} onChange={e=>setCustomerId(e.target.value)}>
       <option value="">Select customer</option>
       {customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.customer_type==='firm'?' · Firm':''}</option>)}
      </select>
     </div>
     <div>
      <label className="fieldlabel">Invoice date</label>
      <input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
     </div>
     <div className="sales-add-customer">
      <button type="button" className="outline" onClick={()=>setShowSalesCustomerForm(v=>!v)}>
       <Plus size={15}/> {showSalesCustomerForm?'Close':'Add customer'}
      </button>
     </div>
    </div>

    {showSalesCustomerForm&&<section className="sales-new-customer">
     <div className="sales-subheading">
      <h4>New customer</h4>
      <span>Customer details</span>
     </div>
     <div className="formgrid">
      <div>
       <label className="fieldlabel">Customer type</label>
       <select value={salesCustomerForm.customer_type} onChange={e=>setSalesCustomerForm({...salesCustomerForm,customer_type:e.target.value})}>
        <option value="individual">Individual</option>
        <option value="firm">Firm / Business</option>
       </select>
      </div>
      <div>
       <label className="fieldlabel">{salesCustomerForm.customer_type==='firm'?'Firm / Business name':'Customer name'} <span className="required-mark">*</span></label>
       <input required placeholder={salesCustomerForm.customer_type==='firm'?'Enter firm name':'Enter customer name'} value={salesCustomerForm.name} onChange={e=>setSalesCustomerForm({...salesCustomerForm,name:e.target.value})}/>
      </div>
      {salesCustomerForm.customer_type==='firm'&&<div>
       <label className="fieldlabel">Contact person</label>
       <input placeholder="Contact person name" value={salesCustomerForm.contact_person} onChange={e=>setSalesCustomerForm({...salesCustomerForm,contact_person:e.target.value})}/>
      </div>}
      <div>
       <label className="fieldlabel">Mobile number</label>
       <input placeholder="Mobile number" value={salesCustomerForm.phone} onChange={e=>setSalesCustomerForm({...salesCustomerForm,phone:e.target.value})}/>
      </div>
      <div>
       <label className="fieldlabel">Email</label>
       <input type="email" placeholder="Email address" value={salesCustomerForm.email} onChange={e=>setSalesCustomerForm({...salesCustomerForm,email:e.target.value})}/>
      </div>
      <div>
       <label className="fieldlabel">Billing address</label>
       <input placeholder="Billing address" value={salesCustomerForm.address} onChange={e=>setSalesCustomerForm({...salesCustomerForm,address:e.target.value})}/>
      </div>
     </div>
     <div className="sales-customer-actions">
      <button type="button" className="primary" disabled={busy||!salesCustomerForm.name.trim()} onClick={createSalesCustomer}>
       <Plus size={15}/> {busy?'Saving…':'Save customer'}
      </button>
     </div>
    </section>}
   </section>

   <section className="sales-section sales-products-section">
    <div className="sales-section-heading">
     <span className="sales-step">2</span>
     <div>
      <h4>Product details</h4>
      <p>Add products, quantities and selling rates.</p>
     </div>
     <button type="button" className="outline sales-add-product" onClick={()=>setLines([...lines,{product_id:0,quantity:1,rate:0}])}>
      <Plus size={15}/> Add product
     </button>
    </div>

    <div className="sales-items-table">
     <div className="sales-table-head">
      <span>Product</span>
      <span>Quantity</span>
      <span>Rate (₹)</span>
      <span>Amount (₹)</span>
      <span></span>
     </div>
     {lines.map((l,i)=><div className="sales-item-row" key={i}>
      <select required aria-label="Product" value={l.product_id||''} onChange={e=>{
       const p=products.find(p=>p.id===+e.target.value);
       setLines(lines.map((x,j)=>j===i?{...x,product_id:+e.target.value,rate:p?.selling_price||0}:x));
      }}>
       <option value="">Choose product</option>
       {products.map(p=><option key={p.id} value={p.id}>{p.name} · stock {p.stock_qty}{p.gst_applicable?` · GST ${p.gst_rate}% · HSN ${p.hsn_code||'—'}`:' · No GST'}</option>)}
      </select>
      <input aria-label="Quantity" type="number" min=".01" step=".01" value={l.quantity} onChange={e=>setLines(lines.map((x,j)=>j===i?{...x,quantity:+e.target.value}:x))}/>
      <input aria-label="Rate" type="number" min="0" step=".01" value={l.rate} onChange={e=>setLines(lines.map((x,j)=>j===i?{...x,rate:+e.target.value}:x))}/>
      <strong className="sales-item-amount">{money(l.quantity*l.rate)}</strong>
      <button type="button" className="sales-remove-item" aria-label="Remove product" title="Remove product" onClick={()=>setLines(lines.filter((_,j)=>j!==i))}>
       <X size={16}/>
      </button>
     </div>)}
     {!lines.length&&<div className="sales-empty-items">
      No products added. Select “Add product” to begin this invoice.
     </div>}
    </div>
   </section>

   <section className="sales-section sales-payment-section">
    <div className="sales-section-heading">
     <span className="sales-step">3</span>
     <div>
      <h4>Payment summary</h4>
      <p>Review the invoice amount and payment received.</p>
     </div>
    </div>

    <div className="sales-summary">
     <div className="sales-summary-fields">
      <div className="sales-summary-row">
       <span>Subtotal</span>
       <strong>{money(subtotal)}</strong>
      </div>
      <label className="sales-summary-row">
       <span>Discount (₹)</span>
       <input type="number" min="0" max={subtotal} value={discount} onChange={e=>setDiscount(+e.target.value)}/>
      </label>
      {salesNeedsCustomerState&&<div style={{padding:'12px 0',borderTop:'1px solid var(--border,#e5e7eb)'}}>
       <label className="fieldlabel">Customer state <span className="required-mark">*</span></label>
       <select required value={salesCustomerState} onChange={e=>setSalesCustomerState(e.target.value)}>
        <option value="">Select customer's state</option>
        {GST_STATES.map(([code,name])=><option key={code} value={code}>{code} · {name}</option>)}
       </select>
       <small className="muted" style={{display:'block',marginTop:6}}>Used to determine CGST + SGST or IGST.</small>
      </div>}
      {salesNeedsCustomerState&&<div style={{padding:'10px 0',borderTop:'1px solid var(--border,#e5e7eb)'}}>
       <div className="sales-summary-row"><span>CGST</span><strong>{salesCustomerState?money(salesTaxPreview.cgst):'Select customer state'}</strong></div>
       <div className="sales-summary-row"><span>SGST</span><strong>{salesCustomerState?money(salesTaxPreview.sgst):'—'}</strong></div>
       <div className="sales-summary-row"><span>IGST</span><strong>{salesCustomerState?money(salesTaxPreview.igst):'—'}</strong></div>
       <div className="sales-summary-row"><span>Total GST</span><strong>{salesCustomerState?money(salesTaxPreview.gst):'Pending state selection'}</strong></div>
      </div>}
      <div className="sales-summary-row sales-grand-total">
       <strong>Grand total (including GST)</strong>
       <strong>{money(salesGrandTotal)}</strong>
      </div>
      <label className="sales-summary-row">
       <span>Paid amount (₹)</span>
       <input type="number" min="0" max={salesGrandTotal} value={paid} onChange={e=>setPaid(+e.target.value)}/>
      </label>
      <div className="sales-summary-row sales-balance">
       <span>Balance due</span>
       <strong>{money(Math.max(0,salesGrandTotal-paid))}</strong>
      </div>
     </div>
    </div>
   </section>

   <div className="sales-form-actions">
    <span className="muted">Please review the invoice before saving.</span>
    <button className="primary sales-save-button" disabled={busy||!lines.length||!customerId}>
     {busy?'Saving…':'Save invoice & reduce stock'}
    </button>
   </div>
  </form>
 </section>

 <section className="panel sales-history-panel">
  <div className="sales-panel-heading">
   <div>
    <h3>Invoice history</h3>
    <p className="muted">Previously created sales invoices.</p>
   </div>
   <span className="sales-history-count">{invoices.length} invoices</span>
  </div>
  <InvoiceTable rows={invoices} onPrint={id=>window.open(`${API}/invoices/${id}/print`,'_blank')}/>
 </section>
</>}{page==='Purchase'&&<>
 <section className="panel" style={{padding:'28px 30px'}}>
  <div className="linehead" style={{marginBottom:28}}><div><h3 style={{marginBottom:8}}>{editingPurchaseId?`Edit purchase ${purchases.find(p=>p.id===editingPurchaseId)?.purchase_no||''}`:'New purchase entry'}</h3><p className="muted" style={{margin:0}}>{editingPurchaseId?'Correct the vendor bill and purchase items. Inventory will be adjusted automatically.':'Record a vendor bill and receive products into inventory.'}</p></div>{editingPurchaseId&&<button type="button" className="outline" onClick={resetPurchaseForm}>Cancel edit</button>}</div>
  <div className="formgrid" style={{gap:'22px 24px',marginBottom:30}}>
   <div><label style={{display:"block",margin:"0 0 10px"}}>Vendor</label><select value={purchaseVendorId} onChange={e=>setPurchaseVendorId(e.target.value)}><option value="">Select vendor</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}{v.phone?' · '+v.phone:''}</option>)}</select></div>
   <div style={{display:'flex',alignItems:'end'}}><button type="button" className="outline" onClick={()=>setShowVendorForm(!showVendorForm)}><Plus size={15}/> {showVendorForm?'Close vendor form':'Add new vendor'}</button></div>
   <div><label style={{display:"block",margin:"0 0 10px"}}>Vendor invoice number</label><input placeholder="Supplier bill / invoice number" value={vendorInvoiceNo} onChange={e=>setVendorInvoiceNo(e.target.value)}/></div>
   <div><label style={{display:"block",margin:"0 0 10px"}}>Purchase date</label><input type="date" value={purchaseDate} onChange={e=>setPurchaseDate(e.target.value)}/></div>
   {purchaseNeedsSupplierState&&<div><label style={{display:'block',margin:'0 0 10px'}}>Supplier GST state <span style={{color:'#b45309'}}>*</span></label><select required value={purchaseSupplierState} onChange={e=>setPurchaseSupplierState(e.target.value)}><option value="">Select supplier registered state</option>{GST_STATES.map(([code,name])=><option key={code} value={code}>{code} · {name}</option>)}</select><small className="muted">Used to calculate CGST/SGST or IGST. This is saved on this purchase only.</small></div>}
  </div>
  {showVendorForm&&<div className="panel" style={{background:'transparent',marginTop:20,padding:24,border:'none',borderRadius:10,boxShadow:'none'}}>
   <h3>Add vendor</h3>
   <form className="formgrid" onSubmit={e=>{e.preventDefault();createVendor()}}>
    <input required placeholder="Vendor / supplier name" value={vendorForm.name} onChange={e=>setVendorForm({...vendorForm,name:e.target.value})}/>
    <input placeholder="Phone number" value={vendorForm.phone} onChange={e=>setVendorForm({...vendorForm,phone:e.target.value})}/>
    <input placeholder="Email" value={vendorForm.email} onChange={e=>setVendorForm({...vendorForm,email:e.target.value})}/>
    <input placeholder="Address" value={vendorForm.address} onChange={e=>setVendorForm({...vendorForm,address:e.target.value})}/>
    <div style={{gridColumn:'1 / -1',display:'flex',justifyContent:'flex-end',marginTop:8}}>
     <button className="primary" style={{width:'auto',minWidth:130,padding:'10px 20px'}} disabled={busy}><Plus size={15}/> Save vendor</button>
    </div>
   </form>
  </div>}
  <div className="linehead" style={{marginTop:34,marginBottom:18,paddingTop:24,borderTop:'1px solid #e5e7eb'}}><b>Purchase items</b><div style={{display:'flex',gap:10}}><button type="button" className="outline" onClick={()=>setShowPurchaseProductForm(!showPurchaseProductForm)}><Plus size={15}/> New product</button><button type="button" className="outline" onClick={()=>setPurchaseLines(old=>[...old,{product_id:0,quantity:1,rate:0}])}><Plus size={15}/> Add item</button></div></div>
  {showPurchaseProductForm&&<div className="panel" style={{background:'transparent',marginTop:24,padding:'24px 0',border:'none',borderTop:'1px solid #e5e7eb',borderRadius:0,boxShadow:'none'}}>
   <div style={{marginBottom:22}}>
    <h3 style={{marginBottom:6}}>Create new product</h3>
    <p className="muted" style={{margin:0}}>Enter product details. The new product will automatically be added to this purchase bill.</p>
   </div>
   <form onSubmit={e=>{e.preventDefault();createPurchaseProduct()}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:20,marginBottom:22}}>
     <div>
      <label style={{display:'block',fontWeight:600,marginBottom:8}}>Product name</label>
      <input required style={{width:'100%',boxSizing:'border-box'}} placeholder="e.g. Orthodox Tea" value={purchaseProductForm.name} onChange={e=>setPurchaseProductForm({...purchaseProductForm,name:e.target.value})}/>
     </div>
     <div>
      <label style={{display:'block',fontWeight:600,marginBottom:8}}>SKU / Product code</label>
      <input required style={{width:'100%',boxSizing:'border-box'}} placeholder="e.g. HSN-4501" value={purchaseProductForm.sku} onChange={e=>setPurchaseProductForm({...purchaseProductForm,sku:e.target.value.trim()})}/>
     </div>
     <div>
      <label style={{display:'block',fontWeight:600,marginBottom:8}}>Unit of measurement</label>
      <input required style={{width:'100%',boxSizing:'border-box'}} placeholder="e.g. pcs, kg, box, litre" value={purchaseProductForm.unit} onChange={e=>setPurchaseProductForm({...purchaseProductForm,unit:e.target.value})}/>
     </div>
     <div>
      <label style={{display:'block',fontWeight:600,marginBottom:8}}>Selling price (customer price) ₹</label>
      <input type="number" min="0" step=".01" style={{width:'100%',boxSizing:'border-box'}} placeholder="Enter selling price in ₹" value={purchaseProductForm.selling_price} onChange={e=>setPurchaseProductForm({...purchaseProductForm,selling_price:+e.target.value})}/>
      <small className="muted" style={{display:'block',marginTop:6}}>Price charged to your customer, not the vendor purchase rate.</small>
     </div>
     <div style={{gridColumn:'1 / -1'}}><label style={{display:'flex',alignItems:'center',gap:9,fontWeight:600}}><input type="checkbox" checked={purchaseProductForm.gst_applicable} onChange={e=>setPurchaseProductForm({...purchaseProductForm,gst_applicable:e.target.checked,gst_rate:e.target.checked?purchaseProductForm.gst_rate:0})}/> GST applies to this product</label>{purchaseProductForm.gst_applicable&&<div className="formgrid" style={{marginTop:12}}><div><label className="fieldlabel">GST rate</label><select value={purchaseProductForm.gst_rate} onChange={e=>setPurchaseProductForm({...purchaseProductForm,gst_rate:+e.target.value})}><option value={0}>Select GST rate</option>{[5,12,18,28].map(rate=><option key={rate} value={rate}>{rate}%</option>)}</select></div><div><label className="fieldlabel">HSN code (optional)</label><input maxLength={20} value={purchaseProductForm.hsn_code} onChange={e=>setPurchaseProductForm({...purchaseProductForm,hsn_code:e.target.value})} placeholder="Enter HSN code"/></div></div>}</div>
    </div>
    <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
     <button className="primary" disabled={busy}><Plus size={15}/> {busy?'Creating product…':'Create product & add to bill'}</button>
     <span className="muted">Opening stock: 0. Stock updates when you save this purchase.</span>
    </div>
   </form>
  </div>}
  <div className="tablewrap"><table><thead><tr><th style={{minWidth:220}}>Product</th><th>Quantity</th><th>Purchase rate ₹</th><th>Taxable amount</th><th>GST</th><th></th></tr></thead><tbody>
   {purchaseLines.map((l,i)=><tr key={i}>
    <td><select value={l.product_id||''} onChange={e=>setPurchaseLines(old=>old.map((x,j)=>j===i?{...x,product_id:+e.target.value}:x))}><option value="">Select product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></td>
    <td><input aria-label="Purchase quantity" type="number" min=".01" step=".01" value={l.quantity} onChange={e=>setPurchaseLines(old=>old.map((x,j)=>j===i?{...x,quantity:+e.target.value}:x))}/></td>
    <td><input aria-label="Purchase rate" type="number" min="0" step=".01" value={l.rate} onChange={e=>setPurchaseLines(old=>old.map((x,j)=>j===i?{...x,rate:+e.target.value}:x))}/></td>
    <td><b>{money(l.quantity*l.rate)}</b></td>
    <td>{(()=>{const p=products.find(x=>x.id===l.product_id);const tax=purchaseLineTax(l);return p&&gstSettings.enabled&&p.gst_applicable&&Number(p.gst_rate)>0?<span>{p.gst_rate}% · {money(tax.gst)}{!purchaseSupplierState&&purchaseNeedsSupplierState?<small className="muted" style={{display:'block'}}>Select supplier state</small>:null}</span>:<span className="muted">—</span>})()}</td>
    <td><button type="button" className="iconbtn" onClick={()=>setPurchaseLines(old=>old.filter((_,j)=>j!==i))}><X size={16}/></button></td>
   </tr>)}
   {!purchaseLines.length&&<tr><td colSpan={6} className="muted">No items added. Use Add item or New product.</td></tr>}
  </tbody></table></div>
  <div className="formgrid" style={{marginTop:18}}>
   <div><label style={{display:"block",margin:"0 0 10px"}}>Description</label><input placeholder="Optional purchase notes" value={purchaseNotes} onChange={e=>setPurchaseNotes(e.target.value)}/></div>
   <div className="totals" style={{margin:'0 0 0 auto'}}>
    <label>Taxable subtotal <b>{money(purchaseSubtotal)}</b></label>
    {purchaseGstTotal>0&&<><label>CGST <b>{money(purchaseTaxTotals.cgst)}</b></label><label>SGST <b>{money(purchaseTaxTotals.sgst)}</b></label><label>IGST <b>{money(purchaseTaxTotals.igst)}</b></label><label>Total GST <b>{money(purchaseGstTotal)}</b></label></>}
    {purchaseNeedsSupplierState&&!purchaseSupplierState&&<small className="muted" style={{display:'block',maxWidth:280}}>Choose supplier state to calculate GST and final total.</small>}
    <label>Purchase grand total <b>{money(purchaseGrandTotal)}</b></label>
    <label>Amount paid ₹ <input type="number" min="0" max={purchaseGrandTotal} step=".01" value={purchasePaid} onChange={e=>setPurchasePaid(+e.target.value)}/></label>
    <label>Outstanding balance <strong>{money(purchaseBalance)}</strong></label>
   </div>
  </div>
  <button className="primary" disabled={busy||!purchaseVendorId||!purchaseLines.length} onClick={savePurchase}>{busy?(editingPurchaseId?'Updating purchase…':'Saving purchase…'):(editingPurchaseId?'Update purchase & inventory':'Save purchase & update inventory')}</button>
 </section>
 <section className="panel"><h3>Purchase history · {purchases.length}</h3><div className="tablewrap"><table><thead><tr><th>Purchase no.</th><th>Date</th><th>Vendor</th><th>Vendor invoice</th><th>Total</th><th>Paid</th><th>Balance</th><th>Actions</th></tr></thead><tbody>
  {purchases.map(p=><tr key={p.id}><td><b>{p.purchase_no}</b></td><td>{p.purchase_date}</td><td>{p.vendor?.name||'—'}</td><td>{p.vendor_invoice_no||'—'}</td><td>{money(p.grand_total??p.subtotal)}</td><td>{money(p.paid_amount)}</td><td>{money(p.balance)}</td><td><div style={{display:'flex',gap:8}}><button type="button" className="iconbtn" title="View purchase" aria-label={`View ${p.purchase_no}`} onClick={()=>setSelectedPurchase(p)}><Eye size={16}/></button><button type="button" className="iconbtn" title="Edit purchase" aria-label={`Edit ${p.purchase_no}`} onClick={()=>beginEditPurchase(p)}><Pencil size={16}/></button></div></td></tr>)}
  {!purchases.length&&<tr><td colSpan={8} className="muted">No purchases recorded yet.</td></tr>}
 </tbody></table></div></section>
 {selectedPurchase&&<section className="panel" style={{marginTop:18}}><div className="linehead"><div><h3 style={{margin:0}}>Purchase details · {selectedPurchase.purchase_no}</h3><p className="muted" style={{margin:'6px 0 0'}}>Vendor: {selectedPurchase.vendor?.name||'—'} · Date: {selectedPurchase.purchase_date}</p></div><button type="button" className="outline" onClick={()=>setSelectedPurchase(null)}>Close</button></div><div className="tablewrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Quantity</th><th>Rate</th><th>Taxable</th><th>GST</th><th>Total</th></tr></thead><tbody>{selectedPurchase.lines.map((line,i)=><tr key={`${line.product_id}-${i}`}><td>{line.product_name}</td><td>{line.sku}</td><td>{line.quantity}</td><td>{money(line.rate)}</td><td>{money(line.taxable_amount??line.amount)}</td><td>{line.gst_applicable?`${line.gst_rate}% · ${money(line.gst_amount)}`:'—'}</td><td>{money(line.total_amount??line.amount)}</td></tr>)}</tbody></table></div><div style={{display:'flex',justifyContent:'flex-end',gap:24,flexWrap:'wrap',marginTop:16}}><span>Taxable subtotal: <b>{money(selectedPurchase.subtotal)}</b></span>{selectedPurchase.gst_total>0&&<><span>CGST: <b>{money(selectedPurchase.cgst_total)}</b></span><span>SGST: <b>{money(selectedPurchase.sgst_total)}</b></span><span>IGST: <b>{money(selectedPurchase.igst_total)}</b></span><span>Total GST: <b>{money(selectedPurchase.gst_total)}</b></span></>}<span>Grand total: <b>{money(selectedPurchase.grand_total??selectedPurchase.subtotal)}</b></span><span>Paid: <b>{money(selectedPurchase.paid_amount)}</b></span><span>Balance: <b>{money(selectedPurchase.balance)}</b></span></div><p className="muted" style={{marginBottom:0}}>Vendor invoice: {selectedPurchase.vendor_invoice_no||'—'}{selectedPurchase.notes?` · Description: ${selectedPurchase.notes}`:''}</p></section>}
 </>}
 </main></div>
}
function InvoiceTable({rows,onPrint}:{rows:Invoice[];onPrint?:(id:number)=>void}){return <div className="tablewrap"><table><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Total</th><th>Paid</th><th>Balance</th>{onPrint&&<th>Actions</th>}</tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><b>{x.invoice_no}</b></td><td>{x.invoice_date}</td><td>{x.customer.name}</td><td>{money(x.grand_total)}</td><td>{money(x.paid_amount)}</td><td>{money(x.balance)}</td>{onPrint&&<td><button type="button" className="outline" onClick={()=>onPrint(x.id)}>Print</button></td>}</tr>)}</tbody></table>{!rows.length&&<p className="muted">No invoices yet.</p>}</div>}
