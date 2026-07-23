const fmtDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtDateFull = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtIndex = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtSignedIndex = (n) => (n >= 0 ? "+" : "") + fmtIndex(n);

// ---------- Stat tiles ----------
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

// ---------- Line chart (series = [{date, value}]) ----------
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

  // If the series crosses a calendar year boundary, dates need the year to stay
  // unambiguous (a bare "Jan 2" could be any of several years in an 11-year series).
  const spansMultipleYears = series[0].date.getFullYear() !== series[series.length - 1].date.getFullYear();
  const dateFmt = spansMultipleYears ? fmtDateFull : fmtDate;

  const xTickEvery = Math.max(1, Math.ceil(series.length / 6));
  let xTicks = "";
  series.forEach((d, i) => {
    if (i % xTickEvery === 0 || i === series.length - 1) {
      xTicks += `<text class="axis-label" x="${x(i).toFixed(1)}" y="${H - 4}" text-anchor="middle">${dateFmt(d.date)}</text>`;
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
    tooltip.show(cx * scale, cy * scale, `<span class="tt-label">${dateFmt(d.date)}</span><br><strong>${valueFormatter(d.value)}</strong>`);
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
        ${series.map((d) => `<tr><td>${dateFmt(d.date)}</td><td class="num">${valueFormatter(d.value)}</td></tr>`).join("")}
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
  const updatedEl = document.getElementById("updated");
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
        label: `Avg High–Open gap (±${summary.sigma_k}σ)`,
        value: fmtIndex(summary.diff_mean),
        delta: `up to ${fmtIndex(summary.diff_upper_bound)} for ${summary.diff_within_sigma_pct.toFixed(1)}% of sessions`,
        up: true,
        noDeltaColor: true,
      },
      {
        label: `Avg Open–Low gap (±${summary.sigma_k}σ)`,
        value: fmtIndex(summary.ol_diff_mean),
        delta: `up to ${fmtIndex(summary.ol_diff_upper_bound)} for ${summary.ol_diff_within_sigma_pct.toFixed(1)}% of sessions`,
        up: true,
        noDeltaColor: true,
      },
      {
        label: "History",
        value: `${summary.total_rows.toLocaleString()} sessions`,
        delta: `since ${fmtDateFull(rows[0].date)}`,
        up: true,
        noDeltaColor: true,
      },
      {
        label: "Data as of",
        value: fmtDateFull(last.date),
        delta: "",
        up: true,
        noDeltaColor: true,
      },
    ]);

    renderLineChartInto("aexChartWrap", "aexTableWrap", rows, `AEX close price, full history since ${fmtDateFull(rows[0].date)}`, fmtIndex);

    note.textContent = `Live data: ${summary.total_rows.toLocaleString()} sessions, ${fmtDateFull(rows[0].date)} through ${fmtDateFull(last.date)}.`;

    // generated_at is stamped by analyze_high_open_diff.py at the moment the
    // refresh pipeline last ran — this is data freshness, not page-load time.
    if (summary.generated_at) {
      const runAt = new Date(summary.generated_at);
      updatedEl.textContent = `Data refreshed ${runAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`;
    } else {
      updatedEl.textContent = "Data refresh time unknown (rerun the refresh-aex-data skill to record it)";
    }
  } catch (err) {
    note.textContent = `Couldn't load live AEX data (${err.message}). Run the refresh-aex-data skill, or check that data/ files exist and this page is served over HTTP.`;
    document.getElementById("aexChartWrap").innerHTML = "";
    updatedEl.textContent = "Data refresh time unavailable";
  }
}

function init() {
  wireToggles();
  loadAexData();
}

init();
