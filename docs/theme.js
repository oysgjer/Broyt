/* Globalt tema basert på data-theme på <html>. Gjelder alle sider. */
:root{
  --bg:#ffffff; --fg:#111827; --muted:#6b7280; --border:#e5e7eb;
  --btn-bg:#ffffff; --btn-border:#e5e7eb; --pill-bg:#f8fafc;
  --primary-bg:#eef2ff; --primary-border:#c7d2fe;
  --affirm-bg:#ecfdf5; --affirm-border:#bbf7d0;
  --warn-bg:#fff7ed; --warn-border:#fed7aa;
  --danger-bg:#fee2e2; --danger-border:#fecaca;
  --progress:#10b981; --card-bg:#ffffff; --modal-bg:rgba(0,0,0,.35);
}

/* Lys (eksplisitt) */
html[data-theme="light"] {
  --bg:#ffffff; --fg:#111827; --muted:#6b7280; --border:#e5e7eb;
  --btn-bg:#ffffff; --btn-border:#e5e7eb; --pill-bg:#f8fafc;
  --primary-bg:#eef2ff; --primary-border:#c7d2fe;
  --affirm-bg:#ecfdf5; --affirm-border:#bbf7d0;
  --warn-bg:#fff7ed; --warn-border:#fed7aa;
  --danger-bg:#fee2e2; --danger-border:#fecaca;
  --progress:#10b981; --card-bg:#ffffff; --modal-bg:rgba(0,0,0,.35);
}

/* Mørk (eksplisitt) */
html[data-theme="dark"] {
  --bg:#111827; --fg:#f9fafb; --muted:#9ca3af; --border:#374151;
  --btn-bg:#1f2937; --btn-border:#374151; --pill-bg:#1f2937;
  --primary-bg:#312e81; --primary-border:#4338ca;
  --affirm-bg:#064e3b;  --affirm-border:#065f46;
  --warn-bg:#78350f;    --warn-border:#92400e;
  --danger-bg:#7f1d1d;  --danger-border:#991b1b;
  --progress:#10b981; --card-bg:#111827; --modal-bg:rgba(0,0,0,.55);
}

/* Auto: følger system. Setter dark-variabler når systemet er mørkt. */
@media (prefers-color-scheme: dark) {
  html[data-theme="auto"] {
    --bg:#111827; --fg:#f9fafb; --muted:#9ca3af; --border:#374151;
    --btn-bg:#1f2937; --btn-border:#374151; --pill-bg:#1f2937;
    --primary-bg:#312e81; --primary-border:#4338ca;
    --affirm-bg:#064e3b;  --affirm-border:#065f46;
    --warn-bg:#78350f;    --warn-border:#92400e;
    --danger-bg:#7f1d1d;  --danger-border:#991b1b;
    --progress:#10b981; --card-bg:#111827; --modal-bg:rgba(0,0,0,.55);
  }
}

/* Bruk variablene på generelle elementer (fungerer for alle del-sider) */
body{ background:var(--bg); color:var(--fg); }
.card, .card-big { background:var(--card-bg); border-color:var(--border); }
.muted{ color:var(--muted); }
button{ background:var(--btn-bg); border:1px solid var(--btn-border); }
.btn{ background:var(--btn-bg); border:1px solid var(--btn-border); color:var(--fg); }
.btn-primary{ background:var(--primary-bg); border-color:var(--primary-border); }
.btn-affirm{ background:var(--affirm-bg); border-color:var(--affirm-border); color:#ecfdf5; }
.btn-warn{ background:var(--warn-bg); border-color:var(--warn-border); color:#fff7ed; }
.btn-danger{ background:var(--danger-bg); border-color:var(--danger-border); color:#fee2e2; }
.pill{ background:var(--pill-bg); border-color:var(--border); }
.b-progress, .progress-all{ background:#f3f4f6; }
.b-prog-done, .bar-done{ background:var(--progress); }
.modal{ background:var(--modal-bg); }
input, textarea, select{ background:var(--bg); color:var(--fg); border:1px solid var(--border); }