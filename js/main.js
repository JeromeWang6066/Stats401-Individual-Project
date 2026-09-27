const DIMENSIONS = [
  { key: "Housing", color: "#2f9e8f" },
  { key: "Income and wealth", color: "#3b6fd8" },
  { key: "Work and job quality", color: "#3cbcec" },
  { key: "Social connections", color: "#d4537e" },
  { key: "Knowledge and skills", color: "#7dae34" },
  { key: "Environmental quality", color: "#2f9d4a" },
  { key: "Civic engagement", color: "#e0b000" },
  { key: "Health", color: "#7a4ea3" },
  { key: "Subjective well-being", color: "#e07a4c" },
  { key: "Safety", color: "#6d7278" },
  { key: "Work-life balance", color: "#9a3b4c" },
];

const weights = new Map(DIMENSIONS.map((dimension) => [dimension.key, 5]));
let countries = [];
let selectedDim = "Income and wealth";
let sortMode = "perf-asc";

const tooltip = d3.select("#tooltip");

function formatRaw(row) {
  if (row.unit.startsWith("US dollars")) return d3.format(",.0f")(row.value);
  if (row.unit === "Points") return d3.format(".0f")(row.value);
  if (row.unit === "Years" || row.unit === "0-10 scale") return d3.format(".1f")(row.value);
  return d3.format(".1f")(row.value);
}

function showTip(event, html) {
  tooltip.html(html).style("opacity", 1);
  const node = tooltip.node();
  const w = node.offsetWidth || 308;
  const h = node.offsetHeight || 430;
  const preferLeft = event.clientX > innerWidth * 0.5;
  let left = preferLeft ? event.clientX - w - 18 : event.clientX + 18;
  let top = event.clientY - 36;
  if (left + w > innerWidth - 8) left = Math.max(8, event.clientX - w - 18);
  if (left < 8) left = 8;
  if (top + h > innerHeight - 8) top = innerHeight - h - 8;
  if (top < 8) top = 8;
  tooltip.style("left", `${left}px`).style("top", `${top}px`);
}

function hideTip() {
  tooltip.style("opacity", 0);
}

function profileCard(d) {
  const ticks = [0, 2, 4, 6, 8, 10].map((tick) =>
    `<span style="left:${tick * 10}%">${tick}</span>`
  ).join("");
  const rows = DIMENSIONS.map((dimension) => {
    const row = d.byDim.get(dimension.key);
    const width = row ? `${Math.max(0, Math.min(100, row.score * 100))}%` : "0%";
    return `<div class="profile-row"><span class="profile-label">${dimension.key}</span><span class="profile-track"><span style="width:${width};background:${dimension.color}"></span></span></div>`;
  }).join("");
  return `<div class="profile-card"><div class="profile-title">${d.country}</div><div class="profile-scale"><span class="profile-ticks">${ticks}</span></div>${rows}</div>`;
}

function weighted(country) {
  let total = 0;
  let weightSum = 0;
  DIMENSIONS.forEach((dimension) => {
    const weight = weights.get(dimension.key);
    const row = country.byDim.get(dimension.key);
    if (!row || !weight) return;
    total += weight * row.score;
    weightSum += weight;
  });
  return weightSum === 0 ? null : total / weightSum;
}

function strongest(country) {
  let best = DIMENSIONS[0];
  let top = -1;
  DIMENSIONS.forEach((dimension) => {
    const row = country.byDim.get(dimension.key);
    const score = row ? row.score : -1;
    if (score > top) {
      top = score;
      best = dimension;
    }
  });
  return best;
}

function ordered() {
  const list = countries.map((country) => ({
    country: country.country,
    byDim: country.byDim,
    total: weighted(country),
    lead: strongest(country),
    bar: country.byDim.get(selectedDim).score,
  }));
  const byName = (a, b) => d3.ascending(a.country, b.country);
  if (sortMode === "perf-desc") list.sort((a, b) => d3.descending(a.total ?? -1, b.total ?? -1) || byName(a, b));
  else if (sortMode === "ind-asc") list.sort((a, b) => d3.ascending(a.bar, b.bar) || byName(a, b));
  else if (sortMode === "ind-desc") list.sort((a, b) => d3.descending(a.bar, b.bar) || byName(a, b));
  else list.sort((a, b) => d3.ascending(a.total ?? 2, b.total ?? 2) || byName(a, b));
  return list;
}

function draw() {
  const list = ordered();
  const host = document.getElementById("chart");
  const height = Math.max(host.clientHeight, 640);
  const colW = 26;
  const nameH = 118;
  const cellH = 7;
  const cellGap = 2;
  const barcodeH = DIMENSIONS.length * (cellH + cellGap) - cellGap;
  const barH = 100;
  const gap = 10;
  const margin = { top: 14, right: 20, bottom: 16, left: 54 };
  const width = Math.max(host.clientWidth, margin.left + margin.right + list.length * colW);
  const dotTop = margin.top + nameH;
  const barcodeTop = height - margin.bottom - barH - gap - barcodeH;
  const dotBottom = barcodeTop - 22;
  const barTop = barcodeTop + barcodeH + gap;
  const barBottom = barTop + barH;

  const svg = d3.select(host).html("").append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("role", "img")
    .attr("aria-label", "Countries as columns. Dot height is the weighted score and colour is the strongest dimension. The strip is the full 11-dimension profile. Bar height is the selected indicator.");

  if (!list.length || dotBottom <= dotTop + 40) {
    svg.append("text").attr("x", 24).attr("y", 40).text("Chart could not be drawn.");
    return;
  }

  const x = d3.scaleBand()
    .domain(list.map((country) => country.country))
    .range([margin.left, width - margin.right])
    .padding(0.22);
  const yDot = d3.scaleLinear().domain([0, 10]).range([dotBottom, dotTop]);
  const yBar = d3.scaleLinear().domain([0, 1]).range([barBottom, barTop]);
  const color = DIMENSIONS.find((dimension) => dimension.key === selectedDim).color;

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yDot).tickValues([2, 4, 6, 8, 10]).tickSize(0))
    .call((g) => g.select(".domain").remove())
    .call((g) => g.selectAll("text").attr("fill", "#8b909a").attr("font-size", 12));

  const columns = svg.selectAll("g.column")
    .data(list)
    .join("g")
    .attr("class", "column");

  columns.append("line")
    .attr("x1", (d) => x(d.country) + x.bandwidth() / 2)
    .attr("x2", (d) => x(d.country) + x.bandwidth() / 2)
    .attr("y1", dotTop)
    .attr("y2", barcodeTop - 4)
    .attr("stroke", "#e7ebf0");

  columns.append("rect")
    .attr("x", (d) => x(d.country))
    .attr("y", (d) => yBar(d.bar))
    .attr("width", x.bandwidth())
    .attr("height", (d) => Math.max(0, yBar(0) - yBar(d.bar)))
    .attr("fill", color)
    .attr("rx", 2)
    .on("mousemove", (event, d) => {
      const row = d.byDim.get(selectedDim);
      const direction = row.higher ? "Higher raw value is better" : "Lower raw value is better";
      showTip(event, `<div class="value-tip"><strong>${d.country}</strong><br>${row.indicator}<br>${formatRaw(row)} ${row.unit}<br>${row.year}<br>${direction}</div>`);
    })
    .on("mouseleave", hideTip);

  const band = x.bandwidth();
  const cellStep = cellH + cellGap;
  DIMENSIONS.forEach((dimension, i) => {
    const y = barcodeTop + i * cellStep;
    columns.append("rect")
      .attr("x", (d) => x(d.country))
      .attr("y", y)
      .attr("width", band)
      .attr("height", cellH)
      .attr("fill", "#f1f3f6");
    columns.append("rect")
      .attr("x", (d) => x(d.country))
      .attr("y", y)
      .attr("width", (d) => {
        const row = d.byDim.get(dimension.key);
        return Math.max(0, (row ? row.score : 0) * band);
      })
      .attr("height", cellH)
      .attr("fill", dimension.color)
      .style("cursor", "pointer")
      .on("mousemove", (event, d) => {
        const row = d.byDim.get(dimension.key);
        const n = row ? d3.format(".1f")(row.score * 10) : "—";
        showTip(event, `<div class="value-tip"><strong>${d.country}</strong><br>${dimension.key}<br>${n} / 10</div>`);
      })
      .on("mouseleave", hideTip);
    svg.append("rect")
      .attr("x", 18)
      .attr("y", y)
      .attr("width", 8)
      .attr("height", cellH)
      .attr("rx", 1)
      .attr("fill", dimension.color);
  });

  const hits = columns.filter((d) => d.total != null).append("g")
    .attr("class", "dot-hit")
    .style("cursor", "pointer")
    .on("mouseenter", (event, d) => showTip(event, profileCard(d)))
    .on("mousemove", (event, d) => showTip(event, profileCard(d)))
    .on("mouseleave", hideTip);
  hits.append("circle")
    .attr("cx", (d) => x(d.country) + x.bandwidth() / 2)
    .attr("cy", (d) => yDot(d.total * 10))
    .attr("r", 16)
    .attr("fill", "transparent");
  hits.append("circle")
    .attr("cx", (d) => x(d.country) + x.bandwidth() / 2)
    .attr("cy", (d) => yDot(d.total * 10))
    .attr("r", 6.5)
    .attr("fill", (d) => d.lead.color)
    .attr("stroke", "#243044")
    .attr("stroke-width", 0.9);

  columns.append("text")
    .attr("class", "country-label")
    .attr("text-anchor", "start")
    .attr("transform", (d) => {
      const cx = x(d.country) + x.bandwidth() / 2;
      return `translate(${cx},${dotTop - 10}) rotate(-90)`;
    })
    .text((d) => d.country);
}

function paintSelection() {
  d3.selectAll("#controls .dim button").classed("on", function onDim() {
    return this.dataset.key === selectedDim;
  });
  d3.selectAll("#controls input[type=range]").each(function colorSlider() {
    const dimension = DIMENSIONS.find((item) => item.key === this.dataset.key);
    if (dimension) this.style.accentColor = dimension.color;
  });
}

function buildControls() {
  const root = d3.select("#controls");
  root.append("h1").attr("class", "tool-title").text("Create your Better Life Index");

  DIMENSIONS.forEach((dimension) => {
    const row = root.append("div").attr("class", "dim");
    row.append("span").attr("class", "swatch").style("background", dimension.color);
    row.append("button")
      .attr("type", "button")
      .attr("data-key", dimension.key)
      .text(dimension.key)
      .on("click", () => {
        selectedDim = dimension.key;
        paintSelection();
        draw();
      });
    const badge = row.append("span").attr("class", "badge").text("5");
    row.append("input")
      .attr("type", "range")
      .attr("min", 0)
      .attr("max", 10)
      .attr("step", 1)
      .attr("value", 5)
      .attr("data-key", dimension.key)
      .attr("aria-label", `${dimension.key} weight`)
      .on("input", function onInput() {
        weights.set(dimension.key, +this.value);
        badge.text(this.value);
        draw();
      });
  });

  const sort = root.append("label").attr("class", "sort-label").text("Sort countries by");
  const select = sort.append("select");
  [
    ["perf-asc", "Performance (lowest first)"],
    ["perf-desc", "Performance (highest first)"],
    ["ind-asc", "Selected indicator (low to high)"],
    ["ind-desc", "Selected indicator (high to low)"],
  ].forEach(([value, label]) => {
    select.append("option").attr("value", value).text(label);
  });
  select.on("change", function onChange() {
    sortMode = this.value;
    draw();
  });

  paintSelection();
}

d3.csv("data/bli-headline.csv", (d) => ({
  country: d.country,
  dimension: d.dimension,
  indicator: d.indicator,
  unit: d.unit,
  year: +d.year,
  value: +d.value,
  higher: +d.higher_is_better === 1,
})).then((rows) => {
  const extent = d3.rollup(rows, (values) => d3.extent(values, (d) => d.value), (d) => d.dimension);
  rows.forEach((row) => {
    const [min, max] = extent.get(row.dimension);
    const scaled = max === min ? 0.5 : (row.value - min) / (max - min);
    row.score = row.higher ? scaled : 1 - scaled;
  });
  countries = d3.groups(rows, (d) => d.country).map(([country, items]) => ({
    country,
    byDim: new Map(items.map((item) => [item.dimension, item])),
  }));
  buildControls();
  draw();
  window.addEventListener("resize", draw);
}).catch((error) => {
  document.getElementById("chart").textContent = `Could not load data: ${error.message}`;
});
