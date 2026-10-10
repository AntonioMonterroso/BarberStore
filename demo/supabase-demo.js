/* Imperio Store Barber — simulador de Supabase para la versión DEMO.
   Reemplaza a supabase-js: guarda todo en localStorage (solo en tu navegador), imita las
   consultas que usa la aplicación y las funciones del servidor (reservar, mis_datos...).
   No se conecta a ningún servidor. Se carga solo desde demo.html (generado por demo/build.py). */
(function(){
"use strict";
var KEY = "imperio_demo_db_v1", SES = "imperio_demo_session", DEMO_TOKEN = "11111111-1111-4111-8111-111111111111";
var pad = function(n){ return String(n).padStart(2,"0"); };
var iso = function(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); };
var addDays = function(n){ var d = new Date(); d.setDate(d.getDate()+n); return iso(d); };
var uuid = function(){ return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){ var r = Math.random()*16|0; return (c==="x"?r:(r&3|8)).toString(16); }); };
var toMin = function(t){ var p = String(t).slice(0,5).split(":").map(Number); return p[0]*60+p[1]; };
var hms = function(m){ return pad(Math.floor(m/60))+":"+pad(m%60)+":00"; };
var nowIso = function(){ return new Date().toISOString(); };
var UUID_TABLES = {clientes:1, visitas:1, citas:1, waitlist:1, resenas:1, ventas_producto:1, gastos:1};

/* ---------------- datos de ejemplo ---------------- */
function seed(){
  var db = {
    config_negocio: [{id:1, nombre:"Imperio Store Barber", direccion:"[Dirección del local]", maps_link:"", whatsapp:"50200000000",
      fidelidad_activa:true, puntos_por_visita:1, puntos_para_premio:10, referidos_activo:true, premio_texto:"Corte gratis",
      hero_eyebrow:"", hero_titulo:"", hero_subtitulo:"", hero_imagen_url:"", hero_recorte:false, barbero_nombre:"", barbero_titulo:"", barbero_frase:"", barbero_bio:"",
      barbero_foto_url:"", anios_experiencia:"", clientes_atendidos:"", maps_embed_url:"", instagram:"", facebook:"", tiktok:"", mostrar_galeria:true, mostrar_resenas:true,
      frase_cierre:"", msg_recordatorio:"", msg_espera:"", msg_reactivar:"", mostrar_paso_productos:false, texto_paso_productos:"", qr_llegada_activo:false}],
    horarios: [0,1,2,3,4,5,6].map(function(d,i){ return {id:i+1, dia_semana:d, activo:d!==0, hora_inicio:"09:00:00", hora_fin:"18:00:00", intervalo_minutos:30}; }),
    bloqueos: [],
    servicios: [
      {id:1, nombre:"Corte de cabello", descripcion:"Un corte de cabello va desde los Q50. Todo servicio extra al corte se cobra por separado.", precio:50, duracion_minutos:60, foto_url:"", activo:true, orden:1, categoria:"Barbería"},
      {id:2, nombre:"Barba", descripcion:"Perfilado de barba, con toalla caliente y acabado limpio.", precio:35, duracion_minutos:30, foto_url:"", activo:true, orden:2, categoria:"Barbería"},
      {id:3, nombre:"Limpieza facial", descripcion:"Servicio para hombres y mujeres. El precio se confirma en el local.", precio:0, duracion_minutos:60, foto_url:"", activo:true, orden:3, categoria:"Cuidado"},
      {id:4, nombre:"Cejas", descripcion:"El precio se confirma en el local.", precio:0, duracion_minutos:30, foto_url:"", activo:true, orden:4, categoria:"Cuidado"}],
    estilos_corte: [
      {id:1, nombre:"Fade bajo", categoria:"Fade", foto_url:"", activo:true, orden:1},
      {id:2, nombre:"Fade medio", categoria:"Fade", foto_url:"", activo:true, orden:2},
      {id:3, nombre:"Clásico a tijera", categoria:"Clásico", foto_url:"", activo:true, orden:3}],
    productos: [
      {id:1, nombre:"Cera mate", precio:80, foto_url:"", stock:5, activo:true, orden:1},
      {id:2, nombre:"Aceite para barba", precio:60, foto_url:"", stock:null, activo:true, orden:2}],
    clientes: [
      {id:"c0000000-0000-4000-8000-000000000001", nombre:"Carlos Demo", telefono:"55512345", estilo_preferido_id:null, notas:"", puntos_actuales:6, codigo_referido:"CARL1234", referido_por:null, creado_en:nowIso(), token_acceso:DEMO_TOKEN},
      {id:"c0000000-0000-4000-8000-000000000002", nombre:"Luis Demo", telefono:"55500002", estilo_preferido_id:null, notas:"Prefiere la máquina en el lateral.", puntos_actuales:2, codigo_referido:"LUIS2222", referido_por:null, creado_en:nowIso(), token_acceso:uuid()},
      {id:"c0000000-0000-4000-8000-000000000003", nombre:"Marta Demo", telefono:"55500003", estilo_preferido_id:null, notas:"", puntos_actuales:0, codigo_referido:"MART3333", referido_por:null, creado_en:nowIso(), token_acceso:uuid()}],
    visitas: [], citas: [], waitlist: [],
    resenas: [
      {id:uuid(), cita_id:null, calificacion:5, comentario:"Reseña de ejemplo: excelente atención y muy puntual.", nombre:"Cliente demo", creado_en:nowIso()},
      {id:uuid(), cita_id:null, calificacion:5, comentario:"Reseña de ejemplo: salí con el mejor corte.", nombre:"Cliente demo", creado_en:nowIso()},
      {id:uuid(), cita_id:null, calificacion:4, comentario:"Reseña de ejemplo: buen ambiente y buen precio.", nombre:"Cliente demo", creado_en:nowIso()}],
    ventas_producto: [], gastos: []
  };
  function visita(cid, fecha){ var v = {id:uuid(), cliente_id:cid, fecha:fecha, anticipo_monto:0, anticipo_recibido:false, recibo_enviado:false, creado_en:nowIso()}; db.visitas.push(v); return v.id; }
  function cita(cid, vid, sid, fecha, ini, fin, estado){ db.citas.push({id:uuid(), cliente_id:cid, servicio_id:sid, estilo_id:null, visita_id:vid, etiqueta:"", fecha:fecha, hora_inicio:ini, hora_fin:fin, estado:estado, notas:"", creado_en:nowIso(), llego_en:null}); }
  var C1 = db.clientes[0].id, C2 = db.clientes[1].id, C3 = db.clientes[2].id;
  var v1 = visita(C1, addDays(-14)); cita(C1, v1, 1, addDays(-14), "10:00:00", "11:00:00", "completada");
  var v2 = visita(C1, addDays(3)); cita(C1, v2, 1, addDays(3), "15:00:00", "16:00:00", "confirmada"); cita(C1, v2, 2, addDays(3), "16:00:00", "16:30:00", "confirmada");
  var v3 = visita(C2, addDays(0)); cita(C2, v3, 1, addDays(0), "10:00:00", "11:00:00", "confirmada");
  var v4 = visita(C3, addDays(0)); cita(C3, v4, 2, addDays(0), "14:00:00", "14:30:00", "confirmada");
  return db;
}
var DBX = null;
function DB(){ if(DBX) return DBX; try{ var raw = localStorage.getItem(KEY); if(raw) DBX = JSON.parse(raw); }catch(e){} if(!DBX){ DBX = seed(); save(); } return DBX; }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(DBX)); }catch(e){} }
function reset(){ try{ localStorage.removeItem(KEY); localStorage.removeItem(SES); localStorage.removeItem("imperio_cliente"); }catch(e){} location.reload(); }

/* ---------------- motor de consultas (imita PostgREST) ---------------- */
var REL = {clientes:"cliente_id", servicios:"servicio_id", estilos_corte:"estilo_id", citas:"cita_id", productos:"producto_id", visitas:"visita_id"};
function splitTop(str){ var out = [], depth = 0, cur = ""; for(var i=0;i<str.length;i++){ var ch = str[i]; if(ch==="(") depth++; if(ch===")") depth--; if(ch===","&&depth===0){ out.push(cur.trim()); cur = ""; } else cur += ch; } if(cur.trim()) out.push(cur.trim()); return out; }
function embed(rows, cols, db){
  var items = splitTop(cols||"*"), rels = items.map(function(it){ var m = it.match(/^(\w+)\((.*)\)$/s); return m ? {name:m[1], cols:m[2]} : null; }).filter(Boolean);
  if(!rels.length) return rows.map(function(r){ return Object.assign({}, r); });
  return rows.map(function(r){
    var o = Object.assign({}, r);
    rels.forEach(function(rel){
      var fk = REL[rel.name], target = (db[rel.name]||[]).find(function(x){ return x.id === r[fk]; });
      o[rel.name] = target ? embed([target], rel.cols, db)[0] : null;
    });
    return o;
  });
}
function cmp(a, b){ if(a===b) return 0; if(a===null||a===undefined) return 1; if(b===null||b===undefined) return -1; return a < b ? -1 : 1; }
function matchFilter(row, f){
  var v = row[f.col];
  switch(f.op){
    case "eq": return v === f.val || (v !== null && v !== undefined && String(v) === String(f.val));
    case "neq": return !(v === f.val || String(v) === String(f.val));
    case "gt": return v > f.val; case "gte": return v >= f.val; case "lt": return v < f.val; case "lte": return v <= f.val;
    case "in": return f.val.some(function(x){ return x === v || String(x) === String(v); });
    case "ilike": return String(v||"").toLowerCase().indexOf(String(f.val).replace(/%/g,"").toLowerCase()) >= 0;
    case "or": return f.val.some(function(sub){ return matchFilter(row, sub); });
    default: return true;
  }
}
function parseOr(expr){ return splitTop(expr).map(function(p){ var m = p.match(/^(\w+)\.(\w+)\.(.*)$/); return m ? {col:m[1], op:m[2], val:m[3]} : null; }).filter(Boolean); }
function defaults(table, db, row){
  var o = Object.assign({}, row);
  if(o.id === undefined){ if(UUID_TABLES[table]) o.id = uuid(); else o.id = (db[table].reduce(function(m,x){ return Math.max(m, Number(x.id)||0); }, 0)) + 1; }
  if(UUID_TABLES[table] && o.creado_en === undefined) o.creado_en = nowIso();
  if(table==="clientes" && !o.token_acceso) o.token_acceso = uuid();
  if(table==="citas"){ if(o.estado===undefined) o.estado = "confirmada"; if(o.llego_en===undefined) o.llego_en = null; }
  if(table==="waitlist" && o.estado===undefined) o.estado = "esperando";
  if(table==="gastos" && o.fecha===undefined) o.fecha = iso(new Date());
  if(table==="ventas_producto" && o.fecha===undefined) o.fecha = iso(new Date());
  if(["servicios","estilos_corte","productos"].indexOf(table)>=0 && o.activo===undefined) o.activo = true;
  return o;
}
function run(q){
  var db = DB(), rows = db[q.table];
  if(!rows) return {data:null, error:{message:"Tabla desconocida: "+q.table}};
  var sel = rows.filter(function(r){ return q.filters.every(function(f){ return matchFilter(r, f); }); });
  var res, err = null;
  if(q.op === "insert"){
    var list = Array.isArray(q.payload) ? q.payload : [q.payload], made = [];
    for(var i=0;i<list.length;i++){
      var row = defaults(q.table, db, list[i]);
      if(q.table==="clientes" && rows.some(function(c){ return c.telefono === row.telefono; })) return {data:null, error:{message:"duplicate key value violates unique constraint (telefono)"}};
      rows.push(row); made.push(row);
    }
    save(); res = made;
  } else if(q.op === "upsert"){
    var list2 = Array.isArray(q.payload) ? q.payload : [q.payload], out = [], key = q.onConflict || "id";
    list2.forEach(function(r){ var cur = rows.find(function(x){ return x[key] === r[key]; }); if(cur){ Object.assign(cur, r); out.push(cur); } else { var n = defaults(q.table, db, r); rows.push(n); out.push(n); } });
    save(); res = out;
  } else if(q.op === "update"){ sel.forEach(function(r){ Object.assign(r, q.payload); }); save(); res = sel; }
  else if(q.op === "delete"){ db[q.table] = rows.filter(function(r){ return sel.indexOf(r) < 0; }); save(); res = sel; }
  else res = sel;
  if(q.order){ res = res.slice().sort(function(a,b){ var c = cmp(a[q.order.col], b[q.order.col]); return q.order.asc ? c : -c; }); }
  if(q.limit != null) res = res.slice(0, q.limit);
  var count = res.length;
  var writeNoReturn = (q.op !== "select") && !q.ret;
  if(writeNoReturn) return {data:null, error:null};
  if(q.head) return {data:null, count:count, error:null};
  var data = embed(res, q.cols, db);
  if(q.single){ if(!data.length) return q.single==="maybe" ? {data:null, error:null} : {data:null, error:{message:"Sin resultados"}}; data = data[0]; }
  var out2 = {data:data, error:err}; if(q.count) out2.count = count; return out2;
}
function builder(table){
  var q = {table:table, filters:[], op:"select", cols:"*", order:null, limit:null, single:null, head:false, count:null, ret:false, payload:null, onConflict:null};
  var api = {};
  function f(op){ return function(col, val){ q.filters.push({col:col, op:op, val:val}); return api; }; }
  api.select = function(cols, opt){ q.cols = cols || "*"; if(opt && opt.count) q.count = opt.count; if(opt && opt.head) q.head = true; if(q.op !== "select") q.ret = true; return api; };
  api.insert = function(rows){ q.op = "insert"; q.payload = rows; return api; };
  api.update = function(vals){ q.op = "update"; q.payload = vals; return api; };
  api.upsert = function(rows, opt){ q.op = "upsert"; q.payload = rows; q.onConflict = opt && opt.onConflict; return api; };
  api.delete = function(){ q.op = "delete"; return api; };
  ["eq","neq","gt","gte","lt","lte","in","ilike"].forEach(function(op){ api[op] = f(op); });
  api.or = function(expr){ q.filters.push({op:"or", val:parseOr(expr)}); return api; };
  api.order = function(col, opt){ q.order = {col:col, asc:!(opt && opt.ascending === false)}; return api; };
  api.limit = function(n){ q.limit = n; return api; };
  api.maybeSingle = function(){ q.single = "maybe"; return api; };
  api.single = function(){ q.single = "one"; return api; };
  api.then = function(ok, no){ return Promise.resolve().then(function(){ return run(q); }).then(ok, no); };
  return api;
}

/* ---------------- funciones del servidor (imitan supabase/seguridad.sql) ---------------- */
function clienteObtener(db, nombre, telefono, ref, token){
  var tel = String(telefono||"").replace(/\D/g,""), nom = String(nombre||"").trim().slice(0,80);
  if(nom.length < 2) throw new Error("nombre_invalido");
  if(tel.length < 8 || tel.length > 15) throw new Error("telefono_invalido");
  var c = db.clientes.find(function(x){ return x.telefono === tel; }), nuevo = false;
  if(!c){
    var refc = ref ? db.clientes.find(function(x){ return x.codigo_referido === String(ref).trim().toUpperCase(); }) : null;
    var base = nom.normalize("NFD").replace(/[^A-Za-z]/g,"").toUpperCase().slice(0,4) || "CLI";
    c = {id:uuid(), nombre:nom, telefono:tel, estilo_preferido_id:null, notas:"", puntos_actuales:0, codigo_referido:base+(1000+Math.floor(Math.random()*9000)), referido_por:refc?refc.id:null, creado_en:nowIso(), token_acceso:uuid()};
    db.clientes.push(c); nuevo = true;
  }
  return {c:c, nuevo:nuevo, token:(nuevo || token === c.token_acceso) ? c.token_acceso : null};
}
function clienteAuth(db, tel, token){ var t = String(tel||"").replace(/\D/g,""); return db.clientes.find(function(c){ return c.telefono === t && token && c.token_acceso === token; }) || null; }
var RPC = {
  horarios_ocupados: function(a){ var db = DB(); return db.citas.filter(function(c){ return c.fecha >= a.p_desde && c.fecha <= a.p_hasta && c.estado !== "cancelada"; }).map(function(c){ return {fecha:c.fecha, hora_inicio:c.hora_inicio, hora_fin:c.hora_fin, estado:c.estado}; }); },
  resenas_publicas: function(){ return DB().resenas.slice().sort(function(a,b){ return a.creado_en < b.creado_en ? 1 : -1; }).map(function(r){ return {calificacion:r.calificacion, comentario:r.comentario, nombre:r.nombre||"", creado_en:r.creado_en}; }); },
  enviar_resena: function(a){ var db = DB(); if(!(a.p_calificacion >= 1 && a.p_calificacion <= 5)) throw new Error("calificacion_invalida"); db.resenas.push({id:uuid(), cita_id:null, calificacion:a.p_calificacion, comentario:String(a.p_comentario||"").trim().slice(0,600), nombre:String(a.p_nombre||"").trim().slice(0,40), creado_en:nowIso()}); save(); return null; },
  reservar: function(a){
    var db = DB(), now = new Date(), hoy = iso(now);
    if(!a.p_fecha || !a.p_hora || !Array.isArray(a.p_items) || a.p_items.length < 1 || a.p_items.length > 8) return {error:"datos_invalidos"};
    if(a.p_fecha < hoy || a.p_fecha > addDays(60)) return {error:"fecha_invalida"};
    var h = db.horarios.find(function(x){ return x.dia_semana === new Date(a.p_fecha+"T00:00:00").getDay(); });
    if(!h || !h.activo) return {error:"cerrado"};
    var ini = toMin(a.p_hora);
    if(a.p_fecha === hoy && ini < now.getHours()*60 + now.getMinutes()) return {error:"hora_pasada"};
    var total = 0, servs = [];
    for(var i=0;i<a.p_items.length;i++){ var s = db.servicios.find(function(x){ return x.id === Number(a.p_items[i].servicio_id) && x.activo; }); if(!s) return {error:"servicio_invalido"}; servs.push([s, a.p_items[i]]); total += s.duracion_minutos; }
    if(ini < toMin(h.hora_inicio) || ini + total > toMin(h.hora_fin)) return {error:"fuera_de_horario"};
    if(db.bloqueos.some(function(b){ return b.fecha === a.p_fecha && (b.todo_el_dia || (b.hora_inicio && b.hora_fin && ini < toMin(b.hora_fin) && ini + total > toMin(b.hora_inicio))); })) return {error:"bloqueado"};
    var cli = clienteObtener(db, a.p_nombre, a.p_telefono, a.p_codigo_ref, a.p_token), c = cli.c;
    var futuras = db.citas.filter(function(x){ return x.cliente_id === c.id && x.estado === "confirmada" && x.fecha >= hoy; }).length;
    if(futuras >= 10) return {error:"limite_citas"};
    if(!a.p_forzar){
      var ex = db.citas.filter(function(x){ return x.cliente_id === c.id && x.fecha === a.p_fecha && x.estado === "confirmada"; }).sort(function(p,q){ return p.hora_inicio < q.hora_inicio ? -1 : 1; });
      if(ex.length){ var sv = db.servicios.find(function(x){ return x.id === ex[0].servicio_id; }); return {conflicto:{hora_inicio:ex[0].hora_inicio, servicio:sv?sv.nombre:"", cantidad:ex.length}}; }
    }
    var cur = ini, tramos = servs.map(function(p){ var t = {s:p[0], it:p[1], ini:cur, fin:cur + p[0].duracion_minutos}; cur = t.fin; return t; });
    var choca = tramos.some(function(t){ return db.citas.some(function(x){ return x.fecha === a.p_fecha && (x.estado === "confirmada" || x.estado === "completada") && t.ini < toMin(x.hora_fin) && t.fin > toMin(x.hora_inicio); }); });
    if(choca) return {error:"ocupado"};
    var prods = [];
    for(var j=0;j<(a.p_productos||[]).length;j++){
      var it = a.p_productos[j], cant = Number(it.cantidad)||0; if(cant < 1) continue; if(cant > 20) return {error:"datos_invalidos"};
      var p = db.productos.find(function(x){ return x.id === Number(it.producto_id) && x.activo; }); if(!p) return {error:"producto_invalido"};
      if(p.stock !== null && p.stock !== undefined && p.stock < cant) return {error:"sin_stock"};
      prods.push([p, cant]);
    }
    if(a.p_estilo_id && db.estilos_corte.some(function(e){ return e.id === Number(a.p_estilo_id) && e.activo; })) c.estilo_preferido_id = Number(a.p_estilo_id);
    var v = {id:uuid(), cliente_id:c.id, fecha:a.p_fecha, anticipo_monto:0, anticipo_recibido:false, recibo_enviado:false, creado_en:nowIso()}; db.visitas.push(v);
    var ids = tramos.map(function(t){ var row = {id:uuid(), cliente_id:c.id, servicio_id:t.s.id, estilo_id:c.estilo_preferido_id && a.p_estilo_id ? Number(a.p_estilo_id) : null, visita_id:v.id, etiqueta:String(t.it.etiqueta||"").trim().slice(0,30), fecha:a.p_fecha, hora_inicio:hms(t.ini), hora_fin:hms(t.fin), estado:"confirmada", notas:"", creado_en:nowIso(), llego_en:null}; db.citas.push(row); return row.id; });
    var pout = prods.map(function(pc){ var p = pc[0], n = pc[1]; if(p.stock !== null && p.stock !== undefined) p.stock -= n; db.ventas_producto.push({id:uuid(), producto_id:p.id, visita_id:v.id, cliente_id:c.id, cantidad:n, precio_unit:p.precio, fecha:a.p_fecha, creado_en:nowIso()}); return {producto_id:p.id, cantidad:n, precio_unit:p.precio}; });
    save();
    return {ok:true, cliente:{id:c.id, nombre:c.nombre, codigo_referido:c.codigo_referido}, token:cli.token, visita_id:v.id, cita_id:ids[0], citas:ids, hora_fin:hms(cur), productos:pout};
  },
  mis_datos: function(a){
    var db = DB(), c = clienteAuth(db, a.p_telefono, a.p_token); if(!c) return null;
    return {cliente:{id:c.id, nombre:c.nombre, telefono:c.telefono, puntos_actuales:c.puntos_actuales, estilo_preferido_id:c.estilo_preferido_id, codigo_referido:c.codigo_referido},
      citas: db.citas.filter(function(x){ return x.cliente_id === c.id; }).sort(function(p,q){ return (q.fecha+q.hora_inicio) < (p.fecha+p.hora_inicio) ? -1 : 1; }).map(function(x){
        var s = db.servicios.find(function(y){ return y.id === x.servicio_id; }), e = db.estilos_corte.find(function(y){ return y.id === x.estilo_id; });
        return {id:x.id, visita_id:x.visita_id, servicio_id:x.servicio_id, estilo_id:x.estilo_id, etiqueta:x.etiqueta, fecha:x.fecha, hora_inicio:x.hora_inicio, hora_fin:x.hora_fin, estado:x.estado, servicios:s?{nombre:s.nombre, precio:s.precio}:null, estilos_corte:e?{nombre:e.nombre}:null}; }),
      waitlist: db.waitlist.filter(function(w){ return w.cliente_id === c.id; }).map(function(w){ return {id:w.id, fecha_deseada:w.fecha_deseada, estado:w.estado}; })};
  },
  cancelar_citas: function(a){
    var db = DB(), c = clienteAuth(db, a.p_telefono, a.p_token); if(!c) throw new Error("no_autorizado");
    var ahora = new Date(), n = 0;
    db.citas.forEach(function(x){ if(a.p_ids.indexOf(x.id) >= 0 && x.cliente_id === c.id && x.estado === "confirmada" && new Date(x.fecha+"T"+String(x.hora_inicio).slice(0,5)+":00") > ahora){ x.estado = "cancelada"; n++; } });
    save(); return n;
  },
  anotar_espera: function(a){
    var db = DB(), cli = clienteObtener(db, a.p_nombre, a.p_telefono, null, a.p_token);
    if(!a.p_fecha || a.p_fecha < iso(new Date()) || a.p_fecha > addDays(60)) throw new Error("fecha_invalida");
    var ya = db.waitlist.some(function(w){ return w.cliente_id === cli.c.id && w.fecha_deseada === a.p_fecha && w.estado === "esperando"; });
    if(!ya) db.waitlist.push({id:uuid(), cliente_id:cli.c.id, fecha_deseada:a.p_fecha, hora_desde:null, hora_hasta:null, estado:"esperando", creado_en:nowIso()});
    save(); return {ya:ya, token:cli.token};
  }
};

/* ---------------- cliente falso ---------------- */
var files = {};
function createClient(){
  return {
    from: builder,
    rpc: function(name, args){ return Promise.resolve().then(function(){ try{ if(!RPC[name]) throw new Error("Función desconocida: "+name); return {data:RPC[name](args||{}), error:null}; }catch(e){ return {data:null, error:{message:e.message}}; } }); },
    auth: {
      getSession: function(){ var s = null; try{ s = localStorage.getItem(SES); }catch(e){} return Promise.resolve({data:{session: s ? {user:{email:s}} : null}}); },
      signInWithPassword: function(c){ try{ localStorage.setItem(SES, (c && c.email) || "demo@imperio.test"); }catch(e){} return Promise.resolve({data:{session:{}}, error:null}); },
      signOut: function(){ try{ localStorage.removeItem(SES); }catch(e){} return Promise.resolve({error:null}); },
      onAuthStateChange: function(){ return {data:{subscription:{unsubscribe:function(){}}}}; }
    },
    storage: { from: function(){ return {
      upload: function(path, file){ try{ files[path] = URL.createObjectURL(file); }catch(e){} return Promise.resolve({data:{path:path}, error:null}); },
      getPublicUrl: function(path){ return {data:{publicUrl: files[path] || ""}}; }
    }; } }
  };
}
window.supabase = { createClient: createClient };

/* ---------------- cinta de demo ---------------- */
/* ?qr=1 activa el registro de llegada con QR (se aplica antes de que la app lea la configuración) */
if(new URLSearchParams(location.search).get("qr") === "1"){ var cfg0 = DB().config_negocio[0]; if(!cfg0.qr_llegada_activo){ cfg0.qr_llegada_activo = true; save(); } }
function cinta(){
  var css = document.createElement("style");
  css.textContent = "#demoBar{position:fixed;left:12px;bottom:12px;z-index:9999;font:600 13px/1.4 system-ui,sans-serif;color:#f3ece0}#demoBar button{font:inherit;color:inherit;cursor:pointer}"+
    "#demoBar .dm-pill{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border-radius:999px;background:#c98a3e;color:#140d05;border:0;font-weight:800;box-shadow:0 8px 24px rgba(0,0,0,.45)}"+
    "#demoBar .dm-box{display:none;position:absolute;left:0;bottom:54px;width:290px;padding:16px;border-radius:18px;background:#1b1916;box-shadow:0 0 0 1px rgba(243,236,224,.2),0 18px 40px rgba(0,0,0,.6)}"+
    "#demoBar.open .dm-box{display:block}#demoBar p{margin:0 0 10px;color:#a39b8f;font-weight:500}#demoBar .dm-b{display:block;width:100%;min-height:44px;margin-top:8px;padding:0 14px;border-radius:999px;border:0;background:#f3ece0;color:#0f0e0d;font-weight:800;text-align:center}#demoBar .dm-b.g{background:transparent;color:#f3ece0;box-shadow:inset 0 0 0 1px rgba(243,236,224,.3)}";
  document.head.appendChild(css);
  var bar = document.createElement("div"); bar.id = "demoBar";
  bar.innerHTML = '<button class="dm-pill" aria-expanded="false">DEMO · toca para ver opciones</button><div class="dm-box" role="dialog" aria-label="Opciones de la demo"><p><b style="color:#f3ece0">Versión de demostración.</b> Los datos viven solo en tu navegador; no se conecta a ningún servidor.</p><p>Panel del negocio: entra con cualquier correo y contraseña.</p><button class="dm-b" id="dmCliente">Entrar como cliente demo (Mis citas)</button><a class="dm-b g" href="#admin" id="dmAdmin" style="text-decoration:none;line-height:44px;padding:0">Ir al panel del negocio</a><button class="dm-b g" id="dmReset">Reiniciar los datos de ejemplo</button></div>';
  document.body.appendChild(bar);
  var pill = bar.querySelector(".dm-pill");
  pill.onclick = function(){ var o = bar.classList.toggle("open"); pill.setAttribute("aria-expanded", o ? "true" : "false"); };
  bar.querySelector("#dmCliente").onclick = function(){ try{ localStorage.setItem("imperio_cliente", JSON.stringify({nombre:"Carlos Demo", telefono:"55512345", token:DEMO_TOKEN, tokenTel:"55512345", acepto:true})); }catch(e){} location.hash = "#mis-citas"; location.reload(); };
  bar.querySelector("#dmReset").onclick = reset;
}
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", cinta); else cinta();
})();
