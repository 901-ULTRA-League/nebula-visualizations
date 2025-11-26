const API_URL = "https://nebula-collection-api.vercel.app/cards";

const state = {
  cards: [],
  filtered: [],
  charts: {},
};

const elements = {
  search: document.getElementById("searchInput"),
  rarity: document.getElementById("rarityFilter"),
  feature: document.getElementById("featureFilter"),
  section: document.getElementById("sectionFilter"),
  reload: document.getElementById("reloadButton"),
  stats: {
    total: document.getElementById("totalCards"),
    display: document.getElementById("displayCount"),
    errata: document.getElementById("errataCount"),
  },
  chips: {
    total: document.getElementById("chipTotal"),
    works: document.getElementById("chipWorks"),
    rarities: document.getElementById("chipRarities"),
    characters: document.getElementById("chipCharacters"),
    sets: document.getElementById("chipSets"),
    types: document.getElementById("chipTypes"),
    errata: document.getElementById("chipErrata"),
    updated: document.getElementById("chipUpdated"),
  },
};

const COLORS = {
  rarities: ["#ff4654", "#ff9f43", "#4dd4ff", "#8f8cff", "#9ce36a", "#ffd166"],
  neutrals: ["#4dd4ff", "#ff4654", "#8f8cff", "#ffd166", "#e0e7ff"],
};

function normalizeText(value, fallback = "Unknown") {
  if (value === null || value === undefined) return fallback;
  const clean = String(value).trim();
  return clean.length ? clean : fallback;
}

function deriveSet(card) {
  const patterns = /(BP\d{2}|SD\d{2}|PR|PP|SP\d{2}|PZ\d{2}|CP\d{2}|BPX\d{2}|BP0\d|EXD\d{2}|UD\d{2})/i;
  const sources = [
    normalizeText(card.number, ""),
    normalizeText(card.section, ""),
    normalizeText(card.display_card_bundle_names, ""),
  ];
  for (const source of sources) {
    const match = source.match(patterns);
    if (match) return match[1].toUpperCase();
  }
  const fallback = normalizeText(card.section);
  return fallback === "Unknown" ? "Unknown" : fallback.toUpperCase();
}

function aggregate(cards, key) {
  return cards.reduce((acc, card) => {
    const bucket = normalizeText(card[key]);
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});
}

function aggregateTypes(cards) {
  return cards.reduce((acc, card) => {
    const bucket = normalizeText(card.type);
    if (bucket === "Unknown" || bucket === "-") return acc;
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});
}

function aggregateFiltered(cards, key, { filterFn, skipUnknown = false, skipValues = [] } = {}) {
  return cards.reduce((acc, card) => {
    if (filterFn && !filterFn(card)) return acc;
    const bucket = normalizeText(card[key]);
    if (skipUnknown && bucket === "Unknown") return acc;
    if (skipValues.includes(bucket)) return acc;
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});
}

function aggregateBySet(cards) {
  return cards.reduce((acc, card) => {
    const bucket = deriveSet(card);
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});
}

async function fetchCards() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const payload = await res.json();
    const cards = Array.isArray(payload) ? payload : payload.data || [];
    state.cards = cards;
    state.filtered = cards;
    hydrateFilters(cards);
    renderAll(cards);
  } catch (error) {
    console.error(error);
  }
}

function hydrateFilters(cards) {
  populateSelect(elements.rarity, uniqueValues(cards, "rarity"));
  populateSelect(elements.feature, uniqueValues(cards, "feature"));
  populateSelect(elements.section, uniqueSets(cards));
}

function uniqueValues(cards, key) {
  return Array.from(
    new Set(cards.map((card) => normalizeText(card[key]))).values()
  ).sort();
}

function uniqueValuesFiltered(cards, key, { skipUnknown = false, skipValues = [] } = {}) {
  const values = cards
    .map((card) => normalizeText(card[key]))
    .filter((v) => (skipUnknown ? v !== "Unknown" : true))
    .filter((v) => !skipValues.includes(v));
  return Array.from(new Set(values)).sort();
}

function uniqueSets(cards) {
  return Array.from(new Set(cards.map((card) => deriveSet(card)))).sort();
}

function populateSelect(selectEl, values) {
  selectEl.innerHTML = '<option value="">All</option>';
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  });
}

function renderAll(cards) {
  updateStats(cards, cards);
  drawCharts(cards);
}

function updateStats(currentCards, allCards) {
  elements.stats.total.textContent = allCards.length.toLocaleString();
  elements.stats.display.textContent = currentCards.length.toLocaleString();
  elements.stats.errata.textContent = currentCards.filter((c) => c.errata_enable === true).length.toLocaleString();

  elements.chips.total.textContent = allCards.length.toLocaleString();
  elements.chips.works.textContent = uniqueValuesFiltered(currentCards, "participating_works", { skipUnknown: true }).length;
  elements.chips.rarities.textContent = uniqueValues(currentCards, "rarity").length;
  elements.chips.characters.textContent = uniqueValuesFiltered(currentCards, "character_name", { skipUnknown: true, skipValues: ["-"] }).length;
  elements.chips.sets.textContent = uniqueSets(currentCards).length;
  elements.chips.types.textContent = uniqueValuesFiltered(currentCards, "type", { skipUnknown: true, skipValues: ["-", "Unknown"] }).length;
  elements.chips.errata.textContent = currentCards.filter((c) => c.errata_enable === true).length.toLocaleString();
  elements.chips.updated.textContent = new Date().toLocaleTimeString();
}

function drawCharts(cards) {
  const rarityData = sortCounts(aggregate(cards, "rarity"));
  const featureData = sortCounts(aggregate(cards, "feature")).slice(0, 8);
  const typeData = sortCounts(aggregateTypes(cards)).slice(0, 8);
  const sectionData = sortCounts(aggregateBySet(cards)).slice(0, 10);

  createChart(
    "rarity",
    "doughnut",
    rarityData,
    COLORS.rarities,
    { cutout: "55%" }
  );

  createChart(
    "feature",
    "bar",
    featureData,
    COLORS.neutrals,
    {
      indexAxis: "y",
      plugins: { legend: { display: false } },
    }
  );

  createChart(
    "type",
    "bar",
    typeData,
    COLORS.neutrals,
    {
      plugins: { legend: { display: false } },
      indexAxis: "y",
    }
  );

  createChart(
    "section",
    "bar",
    sectionData,
    COLORS.neutrals,
    {
      plugins: { legend: { display: false } },
    }
  );

  const worksData = sortCounts(
    aggregate(cards.filter((c) => normalizeText(c.participating_works) !== "Unknown"), "participating_works")
  ).slice(0, 12);
  createChart(
    "works",
    "bar",
    worksData,
    COLORS.neutrals,
    {
      plugins: { legend: { display: false } },
      indexAxis: "y",
    }
  );

  const stackedData = buildStackedData(cards, deriveSet, (c) => normalizeText(c.rarity));
  createStackedChart("sectionRarity", stackedData);

  const yearCounts = aggregateFiltered(cards, "publication_year", {
    skipUnknown: true,
    skipValues: ["-", "Unknown"],
  });
  const yearData = Object.entries(yearCounts)
    .filter(([label]) => label && label !== "Unknown" && label !== "-")
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => Number(a.label) - Number(b.label));
  createChart(
    "year",
    "line",
    yearData,
    ["#4dd4ff"]
  );

  const illustrators = sortCounts(
    aggregateFiltered(cards, "illustrator_name", { skipUnknown: true, skipValues: ["-"] })
  ).slice(0, 12);
  createChart(
    "illustrator",
    "bar",
    illustrators,
    COLORS.neutrals,
    { plugins: { legend: { display: false } }, indexAxis: "y" }
  );

  const charactersOverall = sortCounts(
    aggregateFiltered(cards, "character_name", { skipUnknown: true, skipValues: ["-"] })
  ).slice(0, 12);
  createChart(
    "characters",
    "bar",
    charactersOverall,
    COLORS.neutrals,
    { plugins: { legend: { display: false } }, indexAxis: "y" }
  );

  const ultraChars = sortCounts(
    aggregateFiltered(cards, "character_name", {
      skipUnknown: true,
      skipValues: ["-"],
      filterFn: (c) => normalizeText(c.feature) === "Ultra Hero",
    })
  ).slice(0, 10);
  createChart(
    "ultra",
    "bar",
    ultraChars,
    COLORS.neutrals,
    { plugins: { legend: { display: false } }, indexAxis: "y" }
  );

  const kaijuChars = sortCounts(
    aggregateFiltered(cards, "character_name", {
      skipUnknown: true,
      skipValues: ["-"],
      filterFn: (c) => normalizeText(c.feature) === "Kaiju",
    })
  ).slice(0, 10);
  createChart(
    "kaiju",
    "bar",
    kaijuChars,
    COLORS.neutrals,
    { plugins: { legend: { display: false } }, indexAxis: "y" }
  );
}

function sortCounts(counts) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}

function buildStackedData(cards, primaryFn, secondaryFn) {
  const sections = Array.from(new Set(cards.map((c) => primaryFn(c))));
  const rarities = Array.from(new Set(cards.map((c) => secondaryFn(c))));

  const table = {};
  sections.forEach((s) => {
    table[s] = {};
    rarities.forEach((r) => (table[s][r] = 0));
  });

  cards.forEach((card) => {
    const s = primaryFn(card);
    const r = secondaryFn(card);
    if (!table[s]) table[s] = {};
    if (table[s][r] === undefined) table[s][r] = 0;
    table[s][r] += 1;
  });

  return { labels: sections, series: rarities, table };
}

function createStackedChart(key, dataset) {
  if (typeof Chart === "undefined") return;
  const canvas = document.getElementById(`${key}Chart`);
  if (!canvas) return;
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();
  canvas.height = 260;
  canvas.style.height = "260px";

  const colors = COLORS.neutrals;
  const data = {
    labels: dataset.labels,
    datasets: dataset.series.map((rarity, idx) => ({
      label: rarity,
      data: dataset.labels.map((section) => dataset.table[section][rarity] || 0),
      backgroundColor: colors[idx % colors.length],
      borderWidth: 0,
      borderRadius: 6,
    })),
  };

  const ctx = canvas.getContext("2d");
  state.charts[key] = new Chart(ctx, {
    type: "bar",
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { stacked: true, grid: { color: "rgba(255,255,255,0.05)" } },
      },
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          mode: "index",
          intersect: false,
          backgroundColor: "#0f162c",
          borderColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
        },
      },
    },
  });
}

function createChart(key, type, entries, palette, extraOptions = {}) {
  if (typeof Chart === "undefined") {
    console.warn("Chart.js not ready, skip chart draw:", key);
    return;
  }

  const canvas = document.getElementById(`${key}Chart`);
  if (!canvas) return;

  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  // Lock canvas height to avoid runaway resize loops
  canvas.height = 240;
  canvas.style.height = "240px";

  const ctx = canvas.getContext("2d");
  const colors = entries.map((_, idx) => palette[idx % palette.length]);

  const dataset =
    type === "line"
      ? {
          data: entries.map((entry) => entry.value),
          borderColor: palette[0] || "#4dd4ff",
          backgroundColor: "rgba(77, 212, 255, 0.18)",
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: palette[0] || "#4dd4ff",
        }
      : {
          data: entries.map((entry) => entry.value),
          backgroundColor: colors,
          borderWidth: 0,
          borderRadius: type === "bar" ? 8 : 0,
        };

  const data = {
    labels: entries.map((entry) => entry.label),
    datasets: [
      dataset,
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales:
      type === "bar"
        ? { x: { grid: { color: "rgba(255,255,255,0.05)" } }, y: { grid: { display: false } } }
        : type === "line"
        ? {
            x: { grid: { color: "rgba(255,255,255,0.05)" } },
            y: { grid: { color: "rgba(255,255,255,0.05)" }, beginAtZero: true },
          }
        : {},
    plugins: {
      legend: { display: type !== "bar" },
      tooltip: {
        backgroundColor: "#0f162c",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        padding: 10,
      },
    },
    ...extraOptions,
  };

  if (state.charts[key]) state.charts[key].destroy();
  state.charts[key] = new Chart(ctx, { type, data, options });
}

function applyFilters() {
  const search = elements.search.value.trim().toLowerCase();
  const rarity = elements.rarity.value;
  const feature = elements.feature.value;
  const section = elements.section.value;

  const result = state.cards.filter((card) => {
    const matchesSearch =
      !search ||
      normalizeText(card.name).toLowerCase().includes(search) ||
      normalizeText(card.participating_works).toLowerCase().includes(search);

    const matchesRarity = !rarity || normalizeText(card.rarity) === rarity;
    const matchesFeature = !feature || normalizeText(card.feature) === feature;
    const matchesSection = !section || deriveSet(card) === section;

    return matchesSearch && matchesRarity && matchesFeature && matchesSection;
  });

  state.filtered = result;
  updateStats(result, state.cards);
  drawCharts(result);
}

function registerEvents() {
  [elements.search, elements.rarity, elements.feature, elements.section].forEach((el) =>
    el.addEventListener("input", applyFilters)
  );
  elements.reload.addEventListener("click", fetchCards);
}

registerEvents();
fetchCards();
