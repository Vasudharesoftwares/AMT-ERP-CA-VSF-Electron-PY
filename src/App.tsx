import { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, Users, Package, FileText, Plus, Search, Printer, RefreshCw, ShoppingCart, Boxes, X, Pencil, Eye } from 'lucide-react';

const API='http://127.0.0.1:8765/api';
const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n||0);
type Customer={id:number;name:string;customer_type:string;contact_person:string;phone:string;email:string;address:string};
type Vendor={id:number;name:string;phone:string;email:string;address:string};
type Purchase={id:number;purchase_no:string;vendor_invoice_no:string;purchase_date:string;vendor:Vendor;subtotal:number;paid_amount:number;balance:number;notes:string;lines:{product_id:number;product_name:string;sku:string;quantity:number;rate:number;amount:number}[]};
type Product={id:number;name:string;sku:string;unit:string;selling_price:number;stock_qty:number};
type Line={product_id:number;quantity:number;rate:number};
type Invoice={id:number;invoice_no:string;invoice_date:string;customer:{name:string;phone:string;address:string};subtotal:number;discount:number;grand_total:number;paid_amount:number;balance:number;lines:{product_name:string;sku:string;quantity:number;rate:number;amount:number}[]};
export default function App(){
 const [page,setPage]=useState(()=>{try{return window.localStorage.getItem('vsf-active-page')||'Dashboard'}catch{return 'Dashboard'}}),[customers,setCustomers]=useState<Customer[]>([]),[products,setProducts]=useState<Product[]>([]),[invoices,setInvoices]=useState<Invoice[]>([]),[vendors,setVendors]=useState<Vendor[]>([]),[purchases,setPurchases]=useState<Purchase[]>([]),[dash,setDash]=useState<any>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [customerForm,setCustomerForm]=useState({name:'',phone:'',email:'',address:''});
 const [showSalesCustomerForm,setShowSalesCustomerForm]=useState(false);
 const [salesCustomerForm,setSalesCustomerForm]=useState({name:'',customer_type:'individual',contact_person:'',phone:'',email:'',address:''});
 const [productForm,setProductForm]=useState({name:'',sku:'',unit:'pcs',selling_price:0,stock_qty:0});
 const [editingProductId,setEditingProductId]=useState<number|null>(null);
 const [editingProductForm,setEditingProductForm]=useState({name:'',sku:'',unit:'pcs',selling_price:0,stock_qty:0});
 const [inventorySearch,setInventorySearch]=useState('');
 const [purchaseVendorId,setPurchaseVendorId]=useState(''),[purchaseDate,setPurchaseDate]=useState(new Date().toISOString().slice(0,10)),[vendorInvoiceNo,setVendorInvoiceNo]=useState(''),[purchasePaid,setPurchasePaid]=useState(0),[purchaseNotes,setPurchaseNotes]=useState('');
 const [purchaseLines,setPurchaseLines]=useState<Line[]>([]);
 const [showVendorForm,setShowVendorForm]=useState(false),[showPurchaseProductForm,setShowPurchaseProductForm]=useState(false);
 const [editingPurchaseId,setEditingPurchaseId]=useState<number|null>(null),[selectedPurchase,setSelectedPurchase]=useState<Purchase|null>(null);
 const [vendorForm,setVendorForm]=useState({name:'',phone:'',email:'',address:''});
 const [purchaseProductForm,setPurchaseProductForm]=useState({name:'',sku:'',unit:'pcs',selling_price:0});
 const [customerId,setCustomerId]=useState(''),[lines,setLines]=useState<Line[]>([]),[discount,setDiscount]=useState(0),[paid,setPaid]=useState(0),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[search,setSearch]=useState('');
 const load=async()=>{try{const [c,p,i,d,v,pu]=await Promise.all(['customers','products','invoices','dashboard','vendors','purchases'].map(x=>fetch(`${API}/${x}`).then(r=>{if(!r.ok)throw Error(`${x} API request failed`);return r.json()})));setCustomers(c);setProducts(p);setInvoices(i);setDash(d);setVendors(v);setPurchases(pu);setError('')}catch(e:any){setError('Cannot load business data. Check that the backend is running on port 8765. '+e.message)}};
 useEffect(()=>{load()},[]);
 useEffect(()=>{try{window.localStorage.setItem('vsf-active-page',page)}catch{}},[page]);
 const subtotal=useMemo(()=>lines.reduce((s,l)=>s+l.quantity*l.rate,0),[lines]),total=Math.max(0,subtotal-discount);
 const purchaseSubtotal=useMemo(()=>purchaseLines.reduce((s,l)=>s+l.quantity*l.rate,0),[purchaseLines]);
 const purchaseBalance=Math.max(0,purchaseSubtotal-purchasePaid);
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
 const createVendor=async()=>{setBusy(true);setError('');try{const r=await fetch(`${API}/vendors`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(vendorForm)});const v=await r.json();if(!r.ok)throw Error(v.detail||'Could not create vendor');setVendors(old=>[...old,v].sort((a,b)=>a.name.localeCompare(b.name)));setPurchaseVendorId(String(v.id));setVendorForm({name:'',phone:'',email:'',address:''});setShowVendorForm(false)}catch(e:any){setError(typeof e.message==='string'?e.message:'Could not create vendor')}finally{setBusy(false)}};
 const createSalesCustomer=async()=>{
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
   setEditingProductForm({name:'',sku:'',unit:'pcs',selling_price:0,stock_qty:0});
  }catch(e:any){
   setError(e.message||'Could not update product');
  }finally{
   setBusy(false);
  }
 };
 const createPurchaseProduct=async()=>{setBusy(true);setError('');try{const r=await fetch(`${API}/products`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...purchaseProductForm,stock_qty:0})});const product=await r.json();if(!r.ok)throw Error(typeof product.detail==='string'?product.detail:'Could not create product');setProducts(old=>[...old,product].sort((a,b)=>a.name.localeCompare(b.name)));setPurchaseLines(old=>[...old,{product_id:product.id,quantity:1,rate:0}]);setPurchaseProductForm({name:'',sku:'',unit:'pcs',selling_price:0});setShowPurchaseProductForm(false)}catch(e:any){setError(e.message||'Could not create product')}finally{setBusy(false)}};

 const resetPurchaseForm=()=>{setPurchaseLines([]);setPurchaseVendorId('');setVendorInvoiceNo('');setPurchasePaid(0);setPurchaseNotes('');setPurchaseDate(new Date().toISOString().slice(0,10));setEditingPurchaseId(null);setShowVendorForm(false);setShowPurchaseProductForm(false)};
 const beginEditPurchase=(p:Purchase)=>{setEditingPurchaseId(p.id);setSelectedPurchase(null);setPurchaseVendorId(String(p.vendor.id));setVendorInvoiceNo(p.vendor_invoice_no||'');setPurchaseDate(p.purchase_date);setPurchasePaid(p.paid_amount);setPurchaseNotes(p.notes||'');setPurchaseLines(p.lines.map(line=>({product_id:line.product_id,quantity:line.quantity,rate:line.rate})));window.scrollTo({top:0,behavior:'smooth'})};
 const savePurchase=async()=>{if(!purchaseVendorId){setError('Please select a vendor.');return}if(!purchaseLines.length||purchaseLines.some(x=>!x.product_id||x.quantity<=0||x.rate<0)){setError('Please complete every purchase item.');return}if(purchasePaid>purchaseSubtotal){setError('Paid amount cannot exceed purchase total.');return}const payload={vendor_id:+purchaseVendorId,vendor_invoice_no:vendorInvoiceNo,purchase_date:purchaseDate,paid_amount:purchasePaid,notes:purchaseNotes,lines:purchaseLines};if(!editingPurchaseId){save('purchases',payload,resetPurchaseForm);return}setBusy(true);setError('');try{const r=await fetch(`${API}/purchases/${editingPurchaseId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await r.json();if(!r.ok)throw Error(result.detail||'Could not update purchase');resetPurchaseForm();setSelectedPurchase(null);await load()}catch(e:any){setError(e.message||'Could not update purchase')}finally{setBusy(false)}};

 const save=async(url:string,data:any,done:()=>void)=>{setBusy(true);setError('');try{const r=await fetch(`${API}/${url}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const v=await r.json();if(!r.ok)throw Error(v.detail||'Could not save');done();await load()}catch(e:any){setError(e.message)}finally{setBusy(false)}};
 const nav=[['Dashboard',LayoutDashboard],['Sales',ShoppingCart],['Purchase',FileText],['Inventory',Boxes],['Customers',Users]] as const;
 return <div className="app"><aside className="sidebar"><div className="brand"><div className="brandicon">V</div><div><b>VASUDHARE SALESFORCE</b><small>BUSINESS MANAGEMENT</small></div></div><div className="navlabel">WORKSPACE</div>{nav.map(([n,I])=><button className={'nav '+(page===n?'active':'')} onClick={()=>setPage(n)} key={n}><I size={18}/>{n}</button>)}<div className="sidebottom"><span className="dot"/> Local database connected when API is running</div></aside><main className="main"><header><div><small>VASUDHARE SALESFORCE / {page.toUpperCase()}</small><h2>{page}</h2></div><button className="outline" onClick={load}><RefreshCw size={15}/> Refresh</button></header>{error&&<div className="error">{error}</div>}
 {page==='Dashboard'&&<>
 <p className="muted">Welcome back. Here's your business overview.</p>
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
   <div className="edit-actions"><button className="primary" disabled={busy}>{busy?'Saving…':'Save changes'}</button></div>
  </form>
  <p className="muted" style={{margin:'8px 0 0'}}>Stock changes are saved in the stock movement history.</p>
 </section>}
 <section className="panel">
  <h3>Add product / opening stock</h3>
  <form className="formgrid" onSubmit={e=>{e.preventDefault();save('products',productForm,()=>setProductForm({name:'',sku:'',unit:'pcs',selling_price:0,stock_qty:0}))}}>
   <div><label className="fieldlabel">Product name</label><input required placeholder="Enter product name" value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})}/></div>
   <div><label className="fieldlabel">SKU / Code</label><input required placeholder="Unique product code" value={productForm.sku} onChange={e=>setProductForm({...productForm,sku:e.target.value})}/></div>
   <div><label className="fieldlabel">Unit</label><input placeholder="pcs" value={productForm.unit} onChange={e=>setProductForm({...productForm,unit:e.target.value})}/></div>
   <div><label className="fieldlabel">Selling price (₹)</label><input type="number" min="0" step=".01" value={productForm.selling_price} onChange={e=>setProductForm({...productForm,selling_price:+e.target.value})}/></div>
   <div><label className="fieldlabel">Opening stock</label><input type="number" min="0" step=".01" value={productForm.stock_qty} onChange={e=>setProductForm({...productForm,stock_qty:+e.target.value})}/></div>
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
     <td><button type="button" className="outline row-action" onClick={()=>{setEditingProductId(p.id);setEditingProductForm({name:p.name,sku:p.sku,unit:p.unit,selling_price:p.selling_price,stock_qty:p.stock_qty});window.scrollTo({top:0,behavior:'smooth'})}}><Pencil size={14}/> Edit</button></td>
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
    <p className="muted">Enter customer details, add products and record payment.</p>
   </div>
   <span className="sales-section-number">NEW INVOICE</span>
  </div>

  <form className="sales-form" onSubmit={e=>{
   e.preventDefault();
   save('invoices',{
    customer_id:+customerId,
    invoice_date:date,
    discount,
    paid_amount:paid,
    lines
   },()=>{
    setLines([]);
    setDiscount(0);
    setPaid(0);
    setCustomerId('');
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
       {products.map(p=><option key={p.id} value={p.id}>{p.name} · stock {p.stock_qty}</option>)}
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
      <div className="sales-summary-row sales-grand-total">
       <strong>Grand total</strong>
       <strong>{money(total)}</strong>
      </div>
      <label className="sales-summary-row">
       <span>Paid amount (₹)</span>
       <input type="number" min="0" max={total} value={paid} onChange={e=>setPaid(+e.target.value)}/>
      </label>
      <div className="sales-summary-row sales-balance">
       <span>Balance due</span>
       <strong>{money(Math.max(0,total-paid))}</strong>
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
    </div>
    <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
     <button className="primary" disabled={busy}><Plus size={15}/> {busy?'Creating product…':'Create product & add to bill'}</button>
     <span className="muted">Opening stock: 0. Stock updates when you save this purchase.</span>
    </div>
   </form>
  </div>}
  <div className="tablewrap"><table><thead><tr><th style={{minWidth:220}}>Product</th><th>Quantity</th><th>Purchase rate ₹</th><th>Amount</th><th></th></tr></thead><tbody>
   {purchaseLines.map((l,i)=><tr key={i}>
    <td><select value={l.product_id||''} onChange={e=>setPurchaseLines(old=>old.map((x,j)=>j===i?{...x,product_id:+e.target.value}:x))}><option value="">Select product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></td>
    <td><input aria-label="Purchase quantity" type="number" min=".01" step=".01" value={l.quantity} onChange={e=>setPurchaseLines(old=>old.map((x,j)=>j===i?{...x,quantity:+e.target.value}:x))}/></td>
    <td><input aria-label="Purchase rate" type="number" min="0" step=".01" value={l.rate} onChange={e=>setPurchaseLines(old=>old.map((x,j)=>j===i?{...x,rate:+e.target.value}:x))}/></td>
    <td><b>{money(l.quantity*l.rate)}</b></td>
    <td><button type="button" className="iconbtn" onClick={()=>setPurchaseLines(old=>old.filter((_,j)=>j!==i))}><X size={16}/></button></td>
   </tr>)}
   {!purchaseLines.length&&<tr><td colSpan={5} className="muted">No items added. Use Add item or New product.</td></tr>}
  </tbody></table></div>
  <div className="formgrid" style={{marginTop:18}}>
   <div><label style={{display:"block",margin:"0 0 10px"}}>Description</label><input placeholder="Optional purchase notes" value={purchaseNotes} onChange={e=>setPurchaseNotes(e.target.value)}/></div>
   <div className="totals" style={{margin:'0 0 0 auto'}}>
    <label>Purchase total <b>{money(purchaseSubtotal)}</b></label>
    <label>Amount paid ₹ <input type="number" min="0" max={purchaseSubtotal} step=".01" value={purchasePaid} onChange={e=>setPurchasePaid(+e.target.value)}/></label>
    <label>Outstanding balance <strong>{money(purchaseBalance)}</strong></label>
   </div>
  </div>
  <button className="primary" disabled={busy||!purchaseVendorId||!purchaseLines.length} onClick={savePurchase}>{busy?(editingPurchaseId?'Updating purchase…':'Saving purchase…'):(editingPurchaseId?'Update purchase & inventory':'Save purchase & update inventory')}</button>
 </section>
 <section className="panel"><h3>Purchase history · {purchases.length}</h3><div className="tablewrap"><table><thead><tr><th>Purchase no.</th><th>Date</th><th>Vendor</th><th>Vendor invoice</th><th>Total</th><th>Paid</th><th>Balance</th><th>Actions</th></tr></thead><tbody>
  {purchases.map(p=><tr key={p.id}><td><b>{p.purchase_no}</b></td><td>{p.purchase_date}</td><td>{p.vendor?.name||'—'}</td><td>{p.vendor_invoice_no||'—'}</td><td>{money(p.subtotal)}</td><td>{money(p.paid_amount)}</td><td>{money(p.balance)}</td><td><div style={{display:'flex',gap:8}}><button type="button" className="iconbtn" title="View purchase" aria-label={`View ${p.purchase_no}`} onClick={()=>setSelectedPurchase(p)}><Eye size={16}/></button><button type="button" className="iconbtn" title="Edit purchase" aria-label={`Edit ${p.purchase_no}`} onClick={()=>beginEditPurchase(p)}><Pencil size={16}/></button></div></td></tr>)}
  {!purchases.length&&<tr><td colSpan={8} className="muted">No purchases recorded yet.</td></tr>}
 </tbody></table></div></section>
 {selectedPurchase&&<section className="panel" style={{marginTop:18}}><div className="linehead"><div><h3 style={{margin:0}}>Purchase details · {selectedPurchase.purchase_no}</h3><p className="muted" style={{margin:'6px 0 0'}}>Vendor: {selectedPurchase.vendor?.name||'—'} · Date: {selectedPurchase.purchase_date}</p></div><button type="button" className="outline" onClick={()=>setSelectedPurchase(null)}>Close</button></div><div className="tablewrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Quantity</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{selectedPurchase.lines.map((line,i)=><tr key={`${line.product_id}-${i}`}><td>{line.product_name}</td><td>{line.sku}</td><td>{line.quantity}</td><td>{money(line.rate)}</td><td>{money(line.amount)}</td></tr>)}</tbody></table></div><div style={{display:'flex',justifyContent:'flex-end',gap:24,flexWrap:'wrap',marginTop:16}}><span>Total: <b>{money(selectedPurchase.subtotal)}</b></span><span>Paid: <b>{money(selectedPurchase.paid_amount)}</b></span><span>Balance: <b>{money(selectedPurchase.balance)}</b></span></div><p className="muted" style={{marginBottom:0}}>Vendor invoice: {selectedPurchase.vendor_invoice_no||'—'}{selectedPurchase.notes?` · Description: ${selectedPurchase.notes}`:''}</p></section>}
 </>}
 </main></div>
}
function InvoiceTable({rows,onPrint}:{rows:Invoice[];onPrint?:(id:number)=>void}){return <div className="tablewrap"><table><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Total</th><th>Paid</th><th>Balance</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><b>{x.invoice_no}</b></td><td>{x.invoice_date}</td><td>{x.customer.name}</td><td>{money(x.grand_total)}</td><td>{money(x.paid_amount)}</td><td>{money(x.balance)}</td></tr>)}</tbody></table>{!rows.length&&<p className="muted">No invoices yet.</p>}</div>}
