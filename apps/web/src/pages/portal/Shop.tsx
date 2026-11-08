// Shop (Katalog → Warenkorb → Bestellung auf Rechnung) und Bestellübersicht; Team bestätigt und erzeugt Rechnungsentwürfe.
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, useApi, useAuth } from "../../api";
import { money, useI18n } from "../../i18n";
import { Field, Loading, useSubmit } from "../../ui";

const ST = {
  de: { shop: "Shop", orders: "Bestellungen", cart: "Warenkorb", add: "In den Warenkorb", empty: "Der Warenkorb ist leer.", order: "Verbindlich bestellen (auf Rechnung)",
    note: "Hinweis zur Bestellung", total: "Summe netto", onRequest: "Preis auf Anfrage", ask: "Anfrage stellen", ordered: "Bestellung eingegangen – wir melden uns.",
    customer: "Kunde", status: "Status", items: "Positionen", confirm: "Bestätigen", invoice: "Rechnung erstellen", deliver: "Geliefert", cancel: "Stornieren", none: "Keine Bestellungen.",
    s: { requested: "eingegangen", confirmed: "bestätigt", invoiced: "berechnet", delivered: "geliefert", cancelled: "storniert" },
    b: { one_time: "einmalig", hourly: "pro Stunde", monthly: "pro Monat", yearly: "pro Jahr", on_request: "auf Anfrage" } },
  en: { shop: "Shop", orders: "Orders", cart: "Cart", add: "Add to cart", empty: "Your cart is empty.", order: "Place order (pay by invoice)",
    note: "Note", total: "Total net", onRequest: "Price on request", ask: "Send request", ordered: "Order received – we will get back to you.",
    customer: "Customer", status: "Status", items: "Items", confirm: "Confirm", invoice: "Create invoice", deliver: "Delivered", cancel: "Cancel", none: "No orders.",
    s: { requested: "received", confirmed: "confirmed", invoiced: "invoiced", delivered: "delivered", cancelled: "cancelled" },
    b: { one_time: "one-time", hourly: "per hour", monthly: "per month", yearly: "per year", on_request: "on request" } },
  ar: { shop: "المتجر", orders: "الطلبات", cart: "السلة", add: "أضف إلى السلة", empty: "السلة فارغة.", order: "تأكيد الطلب (الدفع بفاتورة)",
    note: "ملاحظة", total: "المجموع الصافي", onRequest: "السعر عند الطلب", ask: "إرسال استفسار", ordered: "تم استلام الطلب – سنتواصل معك.",
    customer: "العميل", status: "الحالة", items: "البنود", confirm: "تأكيد", invoice: "إنشاء فاتورة", deliver: "تم التسليم", cancel: "إلغاء", none: "لا توجد طلبات.",
    s: { requested: "مستلم", confirmed: "مؤكد", invoiced: "مفوتر", delivered: "مسلّم", cancelled: "ملغى" },
    b: { one_time: "مرة واحدة", hourly: "بالساعة", monthly: "شهرياً", yearly: "سنوياً", on_request: "عند الطلب" } },
};

type Price = { id: string; name: string; billing: keyof (typeof ST)["de"]["b"]; amount_cents: number | null; currency: string; features: string[] };
type Product = { id: string; slug: string; kind: string; name: string; description: string; images: { url: string }[]; prices: Price[] };
type Order = {
  id: string; number: string; customer: string; status: keyof (typeof ST)["de"]["s"]; currency: string; net_cents: number; note: string;
  invoice_id: string | null; invoice_number: string | null; created_by_name: string | null; created_at: string;
  items: { name: string; billing: string; quantity: number; unit_price_cents: number; total_cents: number }[];
};

export default function Shop() {
  const { locale } = useI18n();
  const T = ST[locale];
  const { me } = useAuth();
  const staff = !!me?.is_employee;
  const [tab, setTab] = useState<"shop" | "orders">(staff ? "orders" : "shop");
  return (
    <>
      <div className="row between">
        <h1>{T[tab]}</h1>
        <div className="seg">
          {!staff && <button className={tab === "shop" ? "on" : ""} onClick={() => setTab("shop")}>{T.shop}</button>}
          <button className={tab === "orders" ? "on" : ""} onClick={() => setTab("orders")}>{T.orders}</button>
        </div>
      </div>
      {tab === "shop" ? <Catalog onOrdered={() => setTab("orders")} /> : <Orders />}
    </>
  );
}

function Catalog({ onOrdered }: { onOrdered: () => void }) {
  const { locale } = useI18n();
  const T = ST[locale];
  const cat = useApi<{ products: Product[] }>(`/api/v1/public/catalog?locale=${locale}`, [locale]);
  const [cart, setCart] = useState<Record<string, { price: Price; product: string; qty: number }>>({});
  const [note, setNote] = useState("");
  const s = useSubmit();
  const lines = Object.values(cart);
  const total = lines.reduce((a, l) => a + (l.price.amount_cents ?? 0) * l.qty, 0);
  const currency = lines[0]?.price.currency ?? "EUR";
  if (!cat.data) return <Loading error={cat.error} />;
  return (
    <div className="shop">
      <div className="grid">
        {cat.data.products.map((p) => (
          <div key={p.id} className="card shop-item">
            {p.images[0] && <img src={p.images[0].url} alt="" loading="lazy" />}
            <h3>{p.name}</h3>
            <p className="muted" style={{ whiteSpace: "pre-line" }}>{p.description.slice(0, 220)}{p.description.length > 220 && " …"}</p>
            {p.prices.map((pr) => (
              <div key={pr.id} className="row between shop-price">
                <div><b>{pr.name}</b><div className="muted" style={{ fontSize: ".85em" }}>
                  {pr.amount_cents == null ? T.onRequest : `${money(pr.amount_cents, locale, pr.currency)} ${T.b[pr.billing]}`}</div></div>
                {pr.amount_cents == null
                  ? <Link className="btn small ghost" to="/portal/anfragen-entwicklung">{T.ask}</Link>
                  : <button className="btn small" disabled={!!lines.length && pr.currency !== currency}
                      onClick={() => setCart({ ...cart, [pr.id]: { price: pr, product: p.name, qty: (cart[pr.id]?.qty ?? 0) + 1 } })}>{T.add}</button>}
              </div>
            ))}
          </div>
        ))}
      </div>
      <aside className="card cart">
        <h3>🛒 {T.cart}</h3>
        {lines.length === 0 ? <p className="muted">{T.empty}</p> : (
          <form onSubmit={s.run(async () => {
            await api("/api/v1/orders", { body: { items: lines.map((l) => ({ price_id: l.price.id, quantity: l.qty })), note } });
            setCart({}); setNote(""); alert(T.ordered); onOrdered();
          })}>
            {lines.map((l) => (
              <div key={l.price.id} className="row between cart-line">
                <span>{l.product} – {l.price.name}</span>
                <span className="row" style={{ gap: 4 }}>
                  <input type="number" min={0} max={10000} value={l.qty} style={{ width: 70 }}
                    onChange={(e) => {
                      const q = Math.max(0, Math.min(10000, +e.target.value || 0));
                      const c = { ...cart };
                      if (q === 0) delete c[l.price.id]; else c[l.price.id] = { ...l, qty: q };
                      setCart(c);
                    }} />
                  <b>{money((l.price.amount_cents ?? 0) * l.qty, locale, l.price.currency)}</b>
                </span>
              </div>
            ))}
            <div className="row between" style={{ margin: "10px 0" }}><span>{T.total}</span><b>{money(total, locale, currency)}</b></div>
            <Field label={T.note}><textarea rows={2} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            {s.error && <div className="alert">{s.error}</div>}
            <button className="btn" disabled={s.busy}>{T.order}</button>
          </form>
        )}
      </aside>
    </div>
  );
}

function Orders() {
  const { locale } = useI18n();
  const T = ST[locale];
  const { me } = useAuth();
  const staff = !!me?.is_employee;
  const { data, error, reload } = useApi<Order[]>("/api/v1/orders");
  const [err, setErr] = useState<string | null>(null);
  const act = (p: Promise<unknown>) => p.then(reload).catch((e) => setErr(e.message));
  const setStatus = (id: string, status: string) => act(api(`/api/v1/orders/${id}`, { method: "PATCH", body: { status } }));
  if (!data) return <Loading error={error} />;
  if (data.length === 0) return <div className="card"><p className="muted">{T.none}</p></div>;
  return (
    <div className="card" style={{ padding: 0 }}>
      {err && <div className="alert">{err}</div>}
      <table>
        <thead><tr><th>#</th>{staff && <th>{T.customer}</th>}<th>{T.items}</th><th className="n">{T.total}</th><th>{T.status}</th><th /></tr></thead>
        <tbody>
          {data.map((o) => (
            <tr key={o.id}>
              <td><b>{o.number}</b><div className="muted" style={{ fontSize: ".8em" }}>{new Date(o.created_at).toLocaleDateString(locale)}</div></td>
              {staff && <td>{o.customer}</td>}
              <td>{o.items.map((i, n) => <div key={n}>{i.quantity} × {i.name}</div>)}{o.note && <div className="muted" style={{ fontSize: ".85em" }}>„{o.note}“</div>}</td>
              <td className="n">{money(o.net_cents, locale, o.currency)}</td>
              <td><span className={`badge ord-${o.status}`}>{T.s[o.status]}</span>
                {o.invoice_id && <div><Link to={`/portal/rechnungen/${o.invoice_id}`}>{o.invoice_number ?? "Entwurf"}</Link></div>}</td>
              <td className="n">
                {staff && o.status === "requested" && <button className="btn small" onClick={() => setStatus(o.id, "confirmed")}>{T.confirm}</button>}
                {staff && !o.invoice_id && o.status !== "cancelled" && <button className="btn small ghost" onClick={() => act(api(`/api/v1/orders/${o.id}/invoice`, { method: "POST" }))}>{T.invoice}</button>}
                {staff && ["confirmed", "invoiced"].includes(o.status) && <button className="btn small ghost" onClick={() => setStatus(o.id, "delivered")}>{T.deliver}</button>}
                {o.status === "requested" && <button className="btn small danger" onClick={() => setStatus(o.id, "cancelled")}>{T.cancel}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
