// ---------- Sample options-portfolio data — replace with a real data source. ----------
const portfolioSeries = (() => {
  const points = [];
  let value = 24800;
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    value += (Math.sin(i / 3) * 180) + (Math.random() - 0.45) * 220;
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    points.push({ date: d, value: Math.round(value) });
  }
  return points;
})();

const positions = [
  { symbol: "AAPL", type: "Call", strike: 210, expiry: "2026-08-21", qty: 4, entry: 3.2, current: 4.65, pnl: 580 },
  { symbol: "TSLA", type: "Put", strike: 260, expiry: "2026-08-07", qty: 2, entry: 8.1, current: 6.4, pnl: -340 },
  { symbol: "NVDA", type: "Call", strike: 145, expiry: "2026-09-18", qty: 3, entry: 5.5, current: 7.9, pnl: 720 },
  { symbol: "MSFT", type: "Call", strike: 470, expiry: "2026-08-21", qty: 2, entry: 6.0, current: 5.1, pnl: -180 },
  { symbol: "AMZN", type: "Put", strike: 200, expiry: "2026-08-14", qty: 5, entry: 2.4, current: 3.35, pnl: 475 },
  { symbol: "GOOGL", type: "Call", strike: 195, expiry: "2026-09-04", qty: 3, entry: 4.8, current: 4.2, pnl: -180 },
];

const fmtCurrency = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtSigned = (n) => (n >= 0 ? "+" : "") + fmtCurrency(n);
const fmtDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const fmtIndex = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtSignedIndex = (n) => (n >= 0 ? "+" : "") + fmtIndex(n);

// ---------- Stat tiles (generic) ----------
function renderStatTiles(containerId, tiles) {
  const grid = document.getElementById(containerId);
  grid.innerHTML = tiles.map((t) => `
    <div class="stat-tile">
      <div class="stat-label">${t.label}</div>
      <div class="stat-value">${t.value}</div>
      <div class="stat-delta ${t.noDeltaColor ? "" : t.up ? "up" : "down"}">${t.delta}</div>
    </div>
  `).join("");
}

// ---------- Tooltip helper ----------
function makeTooltip(container) {
  const el = document.createElement("div");
  el.className = "tooltip";
  container.appendChild(el);
  return {
    show(x, y, html) {
      el.innerHTML = html;
      el.style.left = `${x + 12}px`;
      el.style.top = `${y - 10}px`;
      el.classList.add("visible");
    },
    hide() { el.classList.remove("visible"); },
  };
}

function svgPoint(svg, evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

// ---------- Line chart (generic: series = [{date, value}]) ----------
function renderLineChartInto(chartWrapId, tableWrapId, series, ariaLabel, valueFormatter) {
  const wrap = document.getElementById(chartWrapId);
  const W = 520, H = 220, padL = 52, padR = 12, padT = 12, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const values = series.map((d) => d.value);
  const min = Math.min(...values), max = Math.max(...values);
  const yPad = (max - min) * 0.15 || 1;
  const yMin = min - yPad, yMax = max + yPad;

  const x = (i) => padL + (i / (series.length - 1)) * plotW;
  const y = (v) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const linePath = series.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${x(series.length - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

  const gridSteps = 4;
  let gridlines = "";
  let yTicks = "";
  for (let i = 0; i <= gridSteps; i++) {
    const v = yMin + ((yMax - yMin) * i) / gridSteps;
    const gy = y(v);
    gridlines += `<line class="gridline" x1="${padL}" y1="${gy.toFixed(1)}" x2="${W - padR}" y2="${gy.toFixed(1)}" />`;
    yTicks += `<text class="axis-label" x="${padL - 8}" y="${(gy + 3).toFixed(1)}" text-anchor="end">${Math.round(v).toLocaleString()}</text>`;
  }

  const xTickEvery = Math.max(1, Math.ceil(series.length / 6));
  let xTicks = "";
  series.forEach((d, i) => {
    if (i % xTickEvery === 0 || i === series.length - 1) {
      xTicks += `<text class="axis-label" x="${x(i).toFixed(1)}" y="${H - 4}" text-anchor="middle">${fmtDate(d.date)}</text>`;
    }
  });

  const last = series[series.length - 1];

  wrap.innerHTML = `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ariaLabel}">
      ${gridlines}
      ${yTicks}
      ${xTicks}
      <path class="area-fill" d="${areaPath}" />
      <path class="line-path" d="${linePath}" />
      <circle class="end-dot" cx="${x(series.length - 1).toFixed(1)}" cy="${y(last.value).toFixed(1)}" r="4" />
      <line class="crosshair" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" style="opacity:0" />
      <circle class="hover-dot" r="4" style="opacity:0" />
      <rect class="hit-layer" x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" />
    </svg>
  `;

  const svg = wrap.querySelector("svg");
  const crosshair = wrap.querySelector(".crosshair");
  const hoverDot = wrap.querySelector(".hover-dot");
  const tooltip = makeTooltip(wrap);

  svg.addEventListener("mousemove", (evt) => {
    const p = svgPoint(svg, evt);
    const idx = Math.round(((p.x - padL) / plotW) * (series.length - 1));
    const clamped = Math.max(0, Math.min(series.length - 1, idx));
    const d = series[clamped];
    const cx = x(clamped), cy = y(d.value);

    crosshair.setAttribute("x1", cx); crosshair.setAttribute("x2", cx);
    crosshair.style.opacity = 1;
    hoverDot.setAttribute("cx", cx); hoverDot.setAttribute("cy", cy);
    hoverDot.style.opacity = 1;

    const rect = wrap.getBoundingClientRect();
    const scale = rect.width / W;
    tooltip.show(cx * scale, cy * scale, `<span class="tt-label">${fmtDate(d.date)}</span><br><strong>${valueFormatter(d.value)}</strong>`);
  });

  svg.addEventListener("mouseleave", () => {
    crosshair.style.opacity = 0;
    hoverDot.style.opacity = 0;
    tooltip.hide();
  });

  const tableWrap = document.getElementById(tableWrapId);
  tableWrap.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Date</th><th class="num">Value</th></tr></thead>
      <tbody>
        ${series.map((d) => `<tr><td>${fmtDate(d.date)}</td><td class="num">${valueFormatter(d.value)}</td></tr>`).join("")}
      </tbody>
    </table>
  `;
}

// ---------- Bar chart (P&L by symbol) ----------
function renderBarChart() {
  const wrap = document.getElementById("barChartWrap");
  const W = 520, H = 220, padL = 44, padR = 12, padT = 16, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const maxAbs = Math.max(...positions.map((p) => Math.abs(p.pnl))) * 1.15;
  const zeroY = padT + plotH / 2;
  const scale = (plotH / 2) / maxAbs;

  const n = positions.length;
  const slot = plotW / n;
  const barWidth = Math.min(24, slot * 0.5);

  let bars = "";
  let labels = "";
  let ticks = "";
  positions.forEach((p, i) => {
    const cx = padL + slot * i + slot / 2;
    const barH = Math.abs(p.pnl) * scale;
    const isPos = p.pnl >= 0;
    const y = isPos ? zeroY - barH : zeroY;
    bars += `<rect class="${isPos ? "bar-pos" : "bar-neg"}" data-idx="${i}" x="${(cx - barWidth / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth}" height="${barH.toFixed(1)}" rx="4" />`;
    const labelY = isPos ? y - 6 : y + barH + 12;
    labels += `<text class="bar-label" x="${cx.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle">${fmtSigned(p.pnl)}</text>`;
    ticks += `<text class="bar-tick" x="${cx.toFixed(1)}" y="${H - 4}">${p.symbol}</text>`;
  });

  wrap.innerHTML = `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Profit and loss by symbol">
      <line class="baseline" x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${W - padR}" y2="${zeroY.toFixed(1)}" />
      ${labels}
      ${ticks}
      ${bars}
    </svg>
  `;

  const svg = wrap.querySelector("svg");
  const tooltip = makeTooltip(wrap);
  const rectEls = wrap.querySelectorAll("rect[data-idx]");

  rectEls.forEach((rect) => {
    rect.addEventListener("mousemove", (evt) => {
      const idx = Number(rect.dataset.idx);
      const p = positions[idx];
      const bbox = rect.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      tooltip.show(
        bbox.left - wrapRect.left + bbox.width / 2,
        bbox.top - wrapRect.top,
        `<span class="tt-label">${p.symbol} ${p.type} ${p.strike}</span><br><strong>${fmtSigned(p.pnl)}</strong>`
      );
    });
    rect.addEventListener("mouseleave", () => tooltip.hide());
  });

  const tableWrap = document.getElementById("barTableWrap");
  tableWrap.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Symbol</th><th class="num">P&amp;L</th></tr></thead>
      <tbody>
        ${positions.map((p) => `<tr><td>${p.symbol}</td><td class="num ${p.pnl >= 0 ? "status-good" : "status-critical"}">${fmtSigned(p.pnl)}</td></tr>`).join("")}
      </tbody>
    </table>
  `;
}

// ---------- Positions table ----------
function renderPositionsTable() {
  const wrap = document.getElementById("positionsTableWrap");
  wrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Symbol</th><th>Type</th><th class="num">Strike</th><th>Expiry</th>
          <th class="num">Qty</th><th class="num">Entry</th><th class="num">Current</th><th class="num">P&amp;L</th>
        </tr>
      </thead>
      <tbody>
        ${positions.map((p) => `
          <tr>
            <td>${p.symbol}</td>
            <td>${p.type}</td>
            <td class="num">${p.strike}</td>
            <td>${p.expiry}</td>
            <td class="num">${p.qty}</td>
            <td class="num">$${p.entry.toFixed(2)}</td>
            <td class="num">$${p.current.toFixed(2)}</td>
            <td class="num ${p.pnl >= 0 ? "status-good" : "status-critical"}">${fmtSigned(p.pnl)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// ---------- Table-view toggles ----------
function wireToggles() {
  document.querySelectorAll(".table-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      const chartWrap = document.getElementById(`${target}ChartWrap`);
      const tableWrap = document.getElementById(`${target}TableWrap`);
      const showingTable = !tableWrap.classList.contains("hidden");
      chartWrap.classList.toggle("hidden", !showingTable);
      tableWrap.classList.toggle("hidden", showingTable);
      btn.textContent = showingTable ? "View as table" : "View as chart";
    });
  });
}

// ---------- AEX live data (fetched from data/, refreshed by the refresh-aex-data skill) ----------
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}

async function loadAexData() {
  const note = document.getElementById("aexSectionNote");
  try {
    const [csvRes, summaryRes] = await Promise.all([
      fetch("data/aex_history.csv"),
      fetch("data/aex_history_summary.json"),
    ]);
    if (!csvRes.ok) throw new Error(`data/aex_history.csv: HTTP ${csvRes.status}`);
    if (!summaryRes.ok) throw new Error(`data/aex_history_summary.json: HTTP ${summaryRes.status}`);

    const [csvText, summary] = await Promise.all([csvRes.text(), summaryRes.json()]);
    const rows = parseCsv(csvText)
      .map((r) => ({ date: new Date(r.Date), value: parseFloat(r.Close) }))
      .filter((r) => !Number.isNaN(r.value));

    if (rows.length < 2) throw new Error("aex_history.csv has fewer than 2 usable rows");

    const recent = rows.slice(-180);
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    const dayDelta = last.value - prev.value;
    const dayDeltaPct = (dayDelta / prev.value) * 100;

    renderStatTiles("aexStatGrid", [
      {
        label: "AEX close",
        value: fmtIndex(last.value),
        delta: `${fmtSignedIndex(dayDelta)} (${dayDeltaPct >= 0 ? "+" : ""}${dayDeltaPct.toFixed(2)}%) vs prev session`,
        up: dayDelta >= 0,
      },
      {
        label: "Avg High–Open gap (trimmed)",
        value: fmtIndex(summary.average_diff_trimmed),
        delta: `${fmtIndex(summary.average_diff_full)} untrimmed`,
        up: true,
        noDeltaColor: true,
      },
      {
        label: "History",
        value: `${summary.total_rows.toLocaleString()} sessions`,
        delta: `since ${fmtDate(rows[0].date)}`,
        up: true,
        noDeltaColor: true,
      },
      {
        label: "Data as of",
        value: fmtDate(last.date),
        delta: `${summary.rows_excluded_as_outliers} outlier days trimmed`,
        up: true,
        noDeltaColor: true,
      },
    ]);

    renderLineChartInto("aexChartWrap", "aexTableWrap", recent, "AEX close price, most recent sessions", fmtIndex);

    note.textContent = `Live data: ${summary.total_rows.toLocaleString()} sessions through ${fmtDate(last.date)} — chart shows the most recent ${recent.length}.`;
  } catch (err) {
    note.textContent = `Couldn't load live AEX data (${err.message}). Run the refresh-aex-data skill, or check that data/ files exist and this page is served over HTTP.`;
    document.getElementById("aexChartWrap").innerHTML = "";
  }
}

function init() {
  document.getElementById("updated").textContent = `Updated ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`;

  renderStatTiles("statGrid", (() => {
    const totalValue = portfolioSeries[portfolioSeries.length - 1].value;
    const prevValue = portfolioSeries[portfolioSeries.length - 2].value;
    const dayDelta = totalValue - prevValue;
    const dayDeltaPct = (dayDelta / prevValue) * 100;
    const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
    const winners = positions.filter((p) => p.pnl > 0).length;
    const winRate = Math.round((winners / positions.length) * 100);
    return [
      { label: "Portfolio value", value: fmtCurrency(totalValue), delta: `${fmtSigned(dayDelta)} (${dayDeltaPct >= 0 ? "+" : ""}${dayDeltaPct.toFixed(1)}%) today`, up: dayDelta >= 0 },
      { label: "Open positions P&L", value: fmtSigned(totalPnl), delta: `${positions.length} open positions`, up: totalPnl >= 0, noDeltaColor: true },
      { label: "Open positions", value: String(positions.length), delta: `${winners} in profit`, up: true, noDeltaColor: true },
      { label: "Win rate", value: `${winRate}%`, delta: "of open positions", up: true, noDeltaColor: true },
    ];
  })());
  renderLineChartInto("lineChartWrap", "lineTableWrap", portfolioSeries, "Portfolio value over the last 30 days", fmtCurrency);
  renderBarChart();
  renderPositionsTable();
  wireToggles();

  loadAexData();
}

init();
