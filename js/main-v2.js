const DIMENSIONS = [
  { key: "Housing", color: "#2f9e8f" },
  { key: "Income and wealth", color: "#3b6fd8" },
  { key: "Work and job quality", color: "#4c62b5" },
  { key: "Social connections", color: "#d4537e" },
  { key: "Knowledge and skills", color: "#7dae34" },
  { key: "Environmental quality", color: "#2f9d4a" },
  { key: "Civic engagement", color: "#e0b000" },
  { key: "Health", color: "#ef8a32" },
  { key: "Subjective well-being", color: "#e07a4c" },
  { key: "Safety", color: "#6d7278" },
  { key: "Work-life balance", color: "#9a3b4c" },
];

const weights = new Map(DIMENSIONS.map((dimension) => [dimension.key, 5]));
let countries = [];
let selectedDim = "Income and wealth";
let sortMode = "ind-better";
let selectedCountry = null;

const tooltip = d3.select("#tooltip");

function formatRaw(row) {
  if (row.unit.startsWith("US dollars")) return d3.format(",.0f")(row.value);
  if (row.unit === "Points") return d3.format(".0f")(row.value);
  if (row.unit === "Years" || row.unit === "0-10 scale") return d3.format(".1f")(row.value);
  return d3.format(".1f")(row.value);
}

function tickFormat(unit) {
  if (unit.startsWith("US dollars")) return d3.format(".2s");
  if (unit === "Points") return d3.format(".0f");
  if (unit === "Years" || unit === "0-10 scale") return d3.format(".0f");
  return d3.format(".0f");
}

function shortUnit(unit) {
  if (unit.startsWith("US dollars")) return "USD, PPP";
  if (unit.startsWith("Percentage")) return "%";
  return unit;
}

function showTip(event, html) {
  tooltip.style("opacity", 1).html(html)
    .style("left", `${event.clientX + 12}px`)
    .style("top", `${event.clientY + 12}px`);
}

function hideTip() {
  tooltip.style("opacity", 0);
}

function selectedRow() {
  return countries[0].byDim.get(selectedDim);
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

function betterValue(row) {
  return row.higher ? row.value : -row.value;
}

function ordered() {
  const list = countries.map((country) => ({
    country: country.country,
    byDim: country.byDim,
    total: weighted(country),
    bar: country.byDim.get(selectedDim),
  }));
  const byName = (a, b) => d3.ascending(a.country, b.country);
  if (sortMode === "perf-desc") list.sort((a, b) => d3.descending(a.total ?? -1, b.total ?? -1) || byName(a, b));
  else if (sortMode === "perf-asc") list.sort((a, b) => d3.ascending(a.total ?? 2, b.total ?? 2) || byName(a, b));
  else if (sortMode === "ind-worse") list.sort((a, b) => d3.ascending(betterValue(a.bar), betterValue(b.bar)) || byName(a, b));
  else list.sort((a, b) => d3.descending(betterValue(a.bar), betterValue(b.bar)) || byName(a, b));
  return list;
}

function barDomain(values) {
  const min = d3.min(values);
  const max = d3.max(values);
  const span = max - min || Math.abs(max) || 1;
  let lo = min - span * 0.12;
  let hi = max + span * 0.08;
  if (min >= 0 && min <= 0.25 * max) lo = 0;
  else if (min >= 0) lo = Math.max(0, lo);
  return [lo, hi];
}

function drawMain() {
  const list = ordered();
  const host = document.getElementById("chart");
  const height = Math.max(host.clientHeight, 520);
  const colW = 23;
  const margin = { top: 36, right: 16, bottom: 24, left: 56 };
  const width = Math.max(host.clientWidth, margin.left + margin.right + list.length * colW);
  const nameH = 118;
  const barH = 130;
  const bandGap = 22;
  const dotBottom = height - margin.bottom - nameH - bandGap - barH;
  const dotTop = margin.top;
  const nameTop = dotBottom + 10;
  const barTop = nameTop + nameH + bandGap;
  const barBottom = barTop + barH;

  const svg = d3.select(host).html("").append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("role", "img")
    .attr("aria-label", "Weighted scores as dots and the selected indicator as bars in real units");

  if (!list.length || dotBottom <= dotTop + 40) {
    svg.append("text").attr("x", 24).attr("y", 40).text("Chart could not be drawn.");
    return;
  }

  const sample = list[0].bar;
  const values = list.map((d) => d.bar.value);
  const [lo, hi] = barDomain(values);
  const color = DIMENSIONS.find((dimension) => dimension.key === selectedDim).color;

  const x = d3.scaleBand()
    .domain(list.map((country) => country.country))
    .range([margin.left, width - margin.right])
    .padding(0.35);
  const yDot = d3.scaleLinear().domain([0, 10]).range([dotBottom, dotTop]);
  const yBar = d3.scaleLinear()
    .domain(sample.higher ? [lo, hi] : [hi, lo])
    .range([barBottom, barTop]);

  svg.append("text")
    .attr("x", margin.left)
    .attr("y", 14)
    .attr("fill", "#8b909a")
    .attr("font-size", 11)
    .text("Weighted score (0–10)");

  const barTitle = `${sample.indicator} (${shortUnit(sample.unit)}${sample.higher ? "" : ", lower is better"})`;
  svg.append("text")
    .attr("x", margin.left)
    .attr("y", barTop - 8)
    .attr("fill", "#8b909a")
    .attr("font-size", 11)
    .text(barTitle);

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yDot).ticks(5).tickSize(0))
    .call((g) => g.select(".domain").remove())
    .call((g) => g.selectAll("text").attr("fill", "#8b909a").attr("font-size", 12));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yBar).ticks(4).tickFormat(tickFormat(sample.unit)).tickSize(0))
    .call((g) => g.select(".domain").remove())
    .call((g) => g.selectAll("text").attr("fill", "#8b909a").attr("font-size", 11));

  const columns = svg.selectAll("g.column")
    .data(list)
    .join("g")
    .attr("class", "column")
    .style("cursor", "pointer")
    .on("click", (event, d) => {
      selectedCountry = selectedCountry === d.country ? null : d.country;
      draw();
    });

  columns.append("rect")
    .attr("class", "hit")
    .attr("x", (d) => x(d.country) - 2)
    .attr("y", dotTop)
    .attr("width", x.bandwidth() + 4)
    .attr("height", barBottom - dotTop)
    .attr("fill", (d) => (d.country === selectedCountry ? "#eef3fb" : "transparent"));

  columns.append("line")
    .attr("x1", (d) => x(d.country) + x.bandwidth() / 2)
    .attr("x2", (d) => x(d.country) + x.bandwidth() / 2)
    .attr("y1", dotTop)
    .attr("y2", barBottom)
    .attr("stroke", "#e7ebf0");

  columns.filter((d) => d.total != null).append("circle")
    .attr("cx", (d) => x(d.country) + x.bandwidth() / 2)
    .attr("cy", (d) => yDot(d.total * 10))
    .attr("r", (d) => (d.country === selectedCountry ? 7 : 6))
    .attr("fill", "#243044")
    .on("mousemove", (event, d) => {
      showTip(event, `<strong>${d.country}</strong><br>Weighted score ${d3.format(".1f")(d.total * 10)}`);
    })
    .on("mouseleave", hideTip);

  columns.append("text")
    .attr("fill", (d) => (d.country === selectedCountry ? "#1c1c1c" : "#5c6370"))
    .attr("font-size", 11)
    .attr("font-weight", (d) => (d.country === selectedCountry ? 700 : 400))
    .attr("text-anchor", "start")
    .attr("transform", (d) => {
      const cx = x(d.country) + x.bandwidth() / 2;
      return `translate(${cx},${nameTop + nameH - 10}) rotate(-90)`;
    })
    .text((d) => d.country);

  columns.append("rect")
    .attr("x", (d) => x(d.country))
    .attr("y", (d) => Math.min(yBar(d.bar.value), yBar(sample.higher ? lo : hi)))
    .attr("width", x.bandwidth())
    .attr("height", (d) => Math.abs(yBar(d.bar.value) - yBar(sample.higher ? lo : hi)))
    .attr("fill", color)
    .attr("rx", 2)
    .on("mousemove", (event, d) => {
      const row = d.bar;
      const direction = row.higher ? "Higher raw value is better" : "Lower raw value is better";
      showTip(event, `<strong>${d.country}</strong><br>${row.indicator}<br>${formatRaw(row)} ${row.unit}<br>${row.year}<br>${direction}`);
    })
    .on("mouseleave", hideTip);
}

function drawProfile() {
  const hint = document.getElementById("profile-hint");
  const host = document.getElementById("profile-chart");
  if (!selectedCountry) {
    hint.textContent = "Click a country to see all eleven dimensions.";
    host.innerHTML = "";
    return;
  }

  const country = countries.find((item) => item.country === selectedCountry);
  hint.textContent = `${selectedCountry}: all eleven dimensions on a 0–1 scale (higher is better). Click the country again to clear.`;

  const width = host.clientWidth || 640;
  const margin = { top: 4, right: 88, bottom: 20, left: 148 };
  const rowH = 22;
  const height = margin.top + margin.bottom + DIMENSIONS.length * rowH;
  const svg = d3.select(host).html("").append("svg")
    .attr("width", width)
    .attr("height", height);

  const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
  const y = d3.scaleBand()
    .domain(DIMENSIONS.map((d) => d.key))
    .range([margin.top, margin.top + DIMENSIONS.length * rowH])
    .padding(0.28);

  svg.append("g")
    .attr("transform", `translate(0,${margin.top + DIMENSIONS.length * rowH})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".1f")))
    .call((g) => g.select(".domain").attr("stroke", "#e6e8ee"))
    .call((g) => g.selectAll("text").attr("fill", "#8b909a").attr("font-size", 10));

  DIMENSIONS.forEach((dimension) => {
    const row = country.byDim.get(dimension.key);
    const cy = y(dimension.key);
    svg.append("text")
      .attr("x", margin.left - 8)
      .attr("y", cy + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .attr("font-size", 12)
      .attr("fill", "#1c1c1c")
      .text(dimension.key);

    svg.append("rect")
      .attr("x", x(0))
      .attr("y", cy)
      .attr("width", Math.max(0, x(row.score) - x(0)))
      .attr("height", y.bandwidth())
      .attr("fill", dimension.color)
      .attr("rx", 2)
      .on("mousemove", (event) => {
        showTip(event, `<strong>${dimension.key}</strong><br>${row.indicator}<br>${formatRaw(row)} ${row.unit}<br>${row.year}`);
      })
      .on("mouseleave", hideTip);

    svg.append("text")
      .attr("x", width - margin.right + 6)
      .attr("y", cy + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("font-size", 11)
      .attr("fill", "#5c6370")
      .text(formatRaw(row));
  });
}

function draw() {
  drawMain();
  drawProfile();
}

function paintSelection() {
  d3.selectAll("#controls .dim button").classed("on", function onDim() {
    return this.dataset.key === selectedDim;
  });
  d3.selectAll("#controls input[type=range]").each(function colorSlider() {
    const dimension = DIMENSIONS.find((item) => item.key === this.dataset.key);
    if (dimension) this.style.accentColor = dimension.color;
  });
  const select = document.getElementById("sort-select");
  if (select) select.value = sortMode;
}

function selectDimension(key) {
  selectedDim = key;
  sortMode = "ind-better";
  paintSelection();
  draw();
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
      .on("click", () => selectDimension(dimension.key));
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

  const sort = root.append("label").attr("class", "sort-label").attr("for", "sort-select").text("Sort countries by");
  const select = sort.append("select").attr("id", "sort-select");
  [
    ["ind-better", "Selected indicator (better first)"],
    ["ind-worse", "Selected indicator (worse first)"],
    ["perf-desc", "Weighted score (highest first)"],
    ["perf-asc", "Weighted score (lowest first)"],
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
