'use strict';
const data = window.NPI_DATA,
  boundary = window.NPI_BOUNDARY;
const $ = id => document.getElementById(id),
  fmt = d3.format(',.0f'),
  pct = d3.format('.1f'),
  compact = d3.format('~s');
const industries = [...new Set(data.trends.map(d => d.industry))],
  years = [...new Set(data.trends.map(d => d.year))],
  pollutants = [...new Set(data.mix.map(d => d.pollutant))];
const total = d3.sum(data.facilities, d => d.emissions_tonnes);
let cum = 0;
data.facilities.forEach((d, i) => {
  d.rank = i + 1;
  d.share = d.emissions_tonnes / total * 100;
  cum += d.share;
  d.cumulative = cum;
  d.mapValid = Number.isFinite(d.latitude) && Number.isFinite(d.longitude) && d.latitude >= -
    44 && d.latitude <= -10 && d.longitude >= 112 && d.longitude <= 154;
});
const state = {
  industry: 'All industries',
  year: years.at(-1),
  metric: 'mass',
  selectedTrend: null,
  top: 1,
  facility: null,
  mixIndustry: industries[0],
  pollutant: pollutants[0]
};
const colors = d3.scaleOrdinal(industries, ['#52738f']);

function options(id, values) {
  d3.select('#' + id).selectAll('option').data(values).join('option').attr('value', d =>
    typeof d === 'string' ? d : d.value).text(d => typeof d === 'string' ? d : d.label);
}
options('industry', ['All industries', ...industries]);
options('year', years);
options('mix-industry', industries);
options('pollutant', pollutants);
$('year').value = state.year;

function tip(e, text) {
  const t = $('tooltip');
  t.textContent = text;
  t.hidden = false;
  t.style.left = Math.min(e.clientX + 12, window.innerWidth - t.offsetWidth - 12) + 'px';
  t.style.top = Math.max(8, Math.min(e.clientY + 12, window.innerHeight - t.offsetHeight - 12)) +
    'px';
}

function hideTip() {
  $('tooltip').hidden = true;
}

function interactive(sel, text, action) {
  sel.on('pointermove', (e, d) => tip(e, text(d))).on('pointerleave', hideTip);
  if (action) sel.attr('tabindex', 0).attr('role', 'button').attr('aria-label', text).on('click', (
    e, d) => {
    e.stopPropagation();
    hideTip();
    action(d);
  }).on('keydown', (e, d) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      action(d);
    }
  });
  sel.append('title').text(text);
}

function svgAt(id, w, h, label) {
  const host = d3.select('#' + id);
  host.selectAll('*').remove();
  return host.append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('role', 'img').attr('aria-label',
    label);
}

function line(svg, x1, y1, x2, y2, stroke, dash) {
  return svg.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2).attr(
    'stroke', stroke).attr('stroke-dasharray', dash || null);
}

function trendValue(d) {
  if (state.metric === 'mass') return d.emissions_tonnes;
  const base = data.trends.find(x => x.industry === d.industry && x.year === years[0])
    .emissions_tonnes;
  return base > 0 ? 100 * d.emissions_tonnes / base : null;
}

function renderTrends() {
  // Week 9: define dimensions and margins, then map data to the drawing area.
  const focused = state.industry !== 'All industries';
  const width = focused ? Math.max(315, $('trend-grid').clientWidth - 40) : 315;
  const height = focused ? 320 : 195;
  const left = 50,
    right = width - 35,
    top = 15,
    bottom = height - 35;
  const chosen = focused ? [state.industry] : industries;
  const visibleTrends = data.trends.filter(function(row) {
    return !focused || row.industry === state.industry;
  });
  let maximum = d3.max(visibleTrends, trendValue);
  // Keep the 2007/08 reference line visible in relative ratio mode.
  if (state.metric === 'relative-ratio') maximum = Math.max(100, maximum || 0);
  const x = d3.scalePoint(years, [left, right]);
  const y = d3.scaleLinear([0, maximum || 1], [bottom, top]).nice();
  $('trend-label').textContent = state.metric === 'mass'
    ? 'REPORTED AIR VALUES · TONNES' + (focused ? ' · INDUSTRY SCALE' : ' · SHARED SCALE')
    : 'Relative ratio = selected-year emissions ÷ 2007/08 emissions × 100';
  const grid = d3.select('#trend-grid').classed('focused', focused);
  grid.selectAll('*').remove();
  chosen.forEach(ind => {
    const ds = data.trends.filter(d => d.industry === ind),
      current = ds.find(d => d.year === state.year),
      v = trendValue(current);
    const card = grid.append('article').attr('class', 'trend-card' + (state.industry === ind ?
      ' selected' : '')).style('--industry-color', colors(ind)).attr('tabindex', 0).attr(
      'role', 'button').attr('aria-label', `Focus ${ind}`);
    const focus = () => {
      state.industry = state.industry === ind ? 'All industries' : ind;
      $('industry').value = state.industry;
      renderTrends();
      renderMix();
    };
    card.on('click', focus).on('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        focus();
      }
    });
    card.append('h3').text(ind);
    const value = card.append('div').attr('class', 'trend-value');
    value.append('strong').text(v === null ? 'N/A' : state.metric === 'mass' ? fmt(v) : pct(v));
    value.append('span').attr('class', 'trend-unit').text(state.metric === 'mass' ? 'tonnes' :
      'relative ratio');
    card.append('p').attr('class', 'trend-year').text('Reporting year ' + state.year);
    const svg = card.append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img')
      .attr('aria-label', ind + ' annual trend');
    svg.append('g').attr('transform', `translate(${left},0)`).call(d3.axisLeft(y).ticks(4)
      .tickFormat(d3.format('.2~s')).tickSize(-(right - left))).call(g => g.select('.domain')
      .remove());
    svg.append('g').attr('transform', `translate(0,${bottom})`).call(d3.axisBottom(x)
      .tickValues([years[0], years[8], years.at(-1)]).tickSize(0).tickPadding(12)).call(
      function(axis) {
        axis.selectAll('.tick text').attr('text-anchor', function(year) {
          return year === years[0] ? 'start' : year === years.at(-1) ? 'end' : 'middle';
        });
      });
    if (state.metric === 'relative-ratio') line(svg, left, y(100), right, y(100), '#a8b8c9', '3,3');
    const pointSelected = state.selectedTrend !== null && state.selectedTrend.industry ===
      ind && state.selectedTrend.year === state.year;
    if (pointSelected && v !== null) {
      const selectedX = x(state.year),
        selectedY = y(v);
      line(svg, left, selectedY, selectedX, selectedY, '#bf542d', '4,4');
      line(svg, selectedX, selectedY, selectedX, bottom, '#bf542d', '4,4');
    }

    svg.append('path').datum(ds).attr('fill', 'none').attr('stroke', colors(ind)).attr(
      'stroke-width', 2.5).attr('d', d3.line().defined(d => trendValue(d) !== null).x(d => x(d
      .year)).y(d => y(trendValue(d))));
    interactive(svg.selectAll('circle').data(ds.filter(d => trendValue(d) !== null)).join(
        'circle').attr('cx', d => x(d.year)).attr('cy', d => y(trendValue(d))).attr('r', d =>
        pointSelected && d.year === state.year ? 5 : 3.5).attr('fill', d => pointSelected && d
        .year === state.year ? '#bf542d' : colors(ind)).attr('stroke', d => pointSelected && d
        .year === state.year ? 'white' : 'none').attr('stroke-width', 1.5), d =>
      `${ind} · ${d.year}: ${fmt(d.emissions_tonnes)} tonnes${state.metric==='relative-ratio'?' · relative ratio '+pct(trendValue(d)):''}`,
      d => {
        state.selectedTrend = {
          industry: ind,
          year: d.year
        };
        state.year = d.year;
        $('year').value = state.year;
        renderTrends();
      });
    if (pointSelected && v !== null) {
      const selectedX = x(state.year),
        selectedY = y(v);
      const annotation = state.year + ' · ' + (state.metric === 'mass' ? fmt(v) + ' t' : pct(
        v) + ' relative ratio');
      // Keep the label inside the chart, even at the first/last year or highest point.
      svg.append('text').attr('class', 'point-annotation')
        .attr('x', selectedX).attr('y', selectedY < top + 22 ? selectedY + 22 : selectedY - 12)
        .attr('text-anchor', selectedX > (left + right) / 2 ? 'end' : 'start')
        .attr('pointer-events', 'none').text(annotation);
    }

  });
  const summary = d3.select('#trend-readout');
  summary.selectAll('*').remove();
  summary.append('p').attr('class', 'trend-summary-title').text(state.year +
    ' · Industry comparison');
  const rows = chosen.map(function(industry) {
    const annualRows = data.trends.filter(function(row) {
      return row.industry === industry;
    });
    const current = annualRows.find(function(row) {
      return row.year === state.year;
    });
    const base = annualRows[0].emissions_tonnes;
    const change = base > 0 ? d3.format('+.1f')((current.emissions_tonnes / base - 1) * 100) +
      '%' : 'N/A';
    return [industry, fmt(current.emissions_tonnes), change];
  });
  table(summary.append('div').attr('class', 'scroll'),
    ['Industry', 'Reported mass (tonnes)', 'Change since ' + years[0]], rows);

}

function topN() {
  return Math.ceil(data.facilities.length * state.top / 100);
}
let searchResults = [],
  activeResult = -1,
  focusFacilityOnMap = false;

function matchingFacilities(query) {
  const normalized = query.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const states = ['act', 'nsw', 'nt', 'qld', 'sa', 'tas', 'vic', 'wa'];
  const matches = data.facilities.filter(function(facility) {
    const name = facility.facility.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
    return tokens.every(function(token) {
      return states.includes(token) ? facility.state.toLowerCase() === token : name
        .includes(token);
    });
  });

  function score(facility) {
    const name = facility.facility.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (name === normalized) return 0;
    if (name.startsWith(normalized)) return 1;
    if (name.includes(normalized)) return 2;
    return 3;
  }
  return matches.sort(function(a, b) {
    return score(a) - score(b) || a.rank - b.rank;
  });
}

function closeSuggestions() {
  $('facility-suggestions').hidden = true;
  $('search').setAttribute('aria-expanded', 'false');
  $('search').removeAttribute('aria-activedescendant');
  activeResult = -1;
}

function selectFacility(facility) {
  state.facility = facility;
  $('search').value = facility.facility + ' · ' + facility.state;
  facilityOptions();
  $('facility-select').value = facility.facility_id;
  closeSuggestions();
  focusFacilityOnMap = true;
  renderFacilities();
}

function facilityOptions() {
  const query = $('search').value.trim();
  const matches = matchingFacilities(query);
  searchResults = matches.slice(0, 8);
  activeResult = -1;
  $('search').removeAttribute('aria-activedescendant');
  $('search-clear').disabled = !query;
  $('facility-select').disabled = matches.length === 0;
  options('facility-select', [{
      value: '',
      label: matches.length ? 'Select a facility (' + fmt(matches.length) + ' matches)' :
        'No matching facilities'
    },
    ...matches.map(function(f) {
      return {
        value: f.facility_id,
        label: f.rank + '. ' + f.facility + ' · ' + f.state
      };
    })
  ]);
  if (state.facility && matches.includes(state.facility)) $('facility-select').value = state
    .facility.facility_id;
  $('search-status').textContent = matches.length ? fmt(matches.length) + ' matches. ' + (query ?
      'Showing up to 8 suggestions; Inspect facility lists all matches.' :
      'Type to search, or choose from Inspect facility.') :
    'No matching facilities. Try fewer keywords or a state abbreviation such as TAS.';
  const list = d3.select('#facility-suggestions');
  list.selectAll('*').remove();
  const items = list.selectAll('.search-result').data(query ? searchResults : []).join('div')
    .attr('class', 'search-result').attr('id', function(d, i) {
      return 'facility-result-' + i;
    })
    .attr('role', 'option').attr('aria-selected', 'false')
    .on('pointerdown', function(event) {
      event.preventDefault();
    })
    .on('click', function(event, facility) {
      selectFacility(facility);
    });
  items.append('strong').text(function(f) {
    return f.facility;
  });
  items.append('span').text(function(f) {
    return f.state + ' · ' + f.industry + ' · Rank ' + fmt(f.rank);
  });
  if (query && !matches.length) list.append('p').attr('class', 'search-empty').text(
    'No results. Try a shorter name or a state abbreviation.');
  $('facility-suggestions').hidden = !query;
  $('search').setAttribute('aria-expanded', query ? 'true' : 'false');
}
let mapSvg, mapZoom;

function renderFacilities() {
  const n = topN(),
    threshold = data.facilities[n - 1],
    f = state.facility;
  $('concentration').textContent =
    `Top ${state.top}% = ${fmt(n)} of ${fmt(data.facilities.length)} facilities → ${pct(threshold.cumulative)}% of the national reported sum.`;
  $('selection-status').textContent = f ?
    `${f.facility} · ${f.state} · Rank ${fmt(f.rank)} of ${fmt(data.facilities.length)}. ${f.rank<=10?'Shown in the top-ten ranking.':'Outside the top ten; not shown in the ranking bars.'} ${f.mapValid?'Outlined and labelled on the map.':'Not mapped: coordinates unavailable or outside the map extent.'}` :
    'No facility selected. Choose a facility to highlight its location and inspect its contribution.';
  const svg = svgAt('curve', 490, 290, 'Cumulative facility contribution curve'),
    x = d3.scaleLinear([0, 100], [65, 470]),
    y = d3.scaleLinear([0, 100], [225, 28]);
  svg.append('g').attr('transform', 'translate(0,225)').call(d3.axisBottom(x).ticks(5).tickFormat(
    d => d + '%'));
  svg.append('g').attr('transform', 'translate(65,0)').call(d3.axisLeft(y).ticks(5).tickFormat(d =>
    d + '%'));
  line(svg, 65, 225, 470, 28, '#a8b8c9', '4,4');
  const curve = [{
    rank: 0,
    cumulative: 0
  }, ...data.facilities];
  svg.append('path').datum(curve).attr('d', d3.line().x(d => x(d.rank / data.facilities.length *
    100)).y(d => y(d.cumulative))).attr('fill', 'none').attr('stroke', '#52738f').attr(
    'stroke-width', 2.5);
  svg.append('circle').attr('cx', x(n / data.facilities.length * 100)).attr('cy', y(threshold
    .cumulative)).attr('r', 5).attr('fill', '#bf542d');
  svg.append('text').attr('x', Math.max(80, x(state.top) + 10)).attr('y', y(threshold.cumulative) -
    12).text(`Top ${state.top}% → ${pct(threshold.cumulative)}%`);
  if (f) svg.append('path').attr('d', d3.symbol().type(d3.symbolDiamond).size(80)()).attr(
    'transform', `translate(${x(f.rank/data.facilities.length*100)},${y(f.cumulative)})`).attr(
    'fill', '#23334b');
  svg.append('text').attr('class', 'axis-title').attr('x', 267).attr('y', 270).attr('text-anchor',
    'middle').text('Facilities ranked by emissions (%)');
  svg.append('text').attr('class', 'axis-title').attr('transform', 'translate(16,127) rotate(-90)')
    .attr('text-anchor', 'middle').text('Cumulative reported sum (%)');
  svg.append('rect').attr('x', 65).attr('y', 28).attr('width', 405).attr('height', 197).attr('fill',
    'transparent').on('pointermove', e => {
    const rank = Math.max(1, Math.min(data.facilities.length, Math.round(x.invert(d3.pointer(e)[
      0]) / 100 * data.facilities.length)));
    const d = data.facilities[rank - 1];
    tip(e, `Rank ${rank}: ${d.facility} · cumulative ${pct(d.cumulative)}%`);
  }).on('pointerleave', hideTip).on('click', e => {
    const rank = Math.max(1, Math.min(data.facilities.length, Math.round(x.invert(d3.pointer(e)[
      0]) / 100 * data.facilities.length)));
    selectFacility(data.facilities[rank - 1]);
    hideTip();
  });
  const bar = svgAt('ranking', 490, 365, 'Top ten facility reported tonnes'),
    top = data.facilities.slice(0, 10),
    bx = d3.scaleLinear([0, top[0].emissions_tonnes], [195, 465]),
    by = d3.scaleBand(top.map(d => d.facility_id), [10, 325]).padding(.3);
  bar.append('g').attr('transform', 'translate(0,330)').call(d3.axisBottom(bx).ticks(4).tickFormat(
    compact));
  bar.append('text').attr('x', 330).attr('y', 363).attr('text-anchor', 'middle').text(
    'Reported emissions (tonnes)');
  const labels = bar.selectAll('.bar-label').data(top).join('text').attr('x', 187).attr('y', d =>
    by(d.facility_id) + by.bandwidth() / 2 + 4).attr('text-anchor', 'end').text(d => d.facility
    .length > 28 ? d.facility.slice(0, 26) + '…' : d.facility);
  labels.append('title').text(d => d.facility);
  interactive(bar.selectAll('rect').data(top).join('rect').attr('x', 195).attr('y', d => by(d
      .facility_id)).attr('width', d => bx(d.emissions_tonnes) - 195).attr('height', by
    .bandwidth()).attr('fill', d => d === f ? '#23334b' : d.rank <= n ? '#bf542d' : '#a8b8c9'),
    d => `${d.facility}: ${fmt(d.emissions_tonnes)} t · ${pct(d.share)}%`, selectFacility);
  renderMap();
  renderDetail();
}

function renderMap() {
  const previous = mapSvg ? d3.zoomTransform(mapSvg.node()) : d3.zoomIdentity;
  mapSvg = svgAt('map', 490, 365,
    'Australia reporting facilities; use facility selector for keyboard access');
  const projection = d3.geoMercator().center([133, -27]).scale(560).translate([245, 182]),
    path = d3.geoPath(projection),
    layer = mapSvg.append('g');
  layer.append('path').datum(boundary).attr('d', path).attr('fill', '#e1e5e9').attr('stroke',
    '#a6b4c2').attr('stroke-width', .7);
  const radius = d3.scaleSqrt([0, data.facilities[0].emissions_tonnes], [0, 25]);
  const mapped = data.facilities.filter(d => d.mapValid).slice().reverse();
  interactive(layer.selectAll('circle').data(mapped).join('circle').attr('cx', d => projection([d
      .longitude, d.latitude
    ])[0]).attr('cy', d => projection([d.longitude, d.latitude])[1]).attr('r', d => Math.max(1.6,
      radius(d.emissions_tonnes))).attr('fill', d => d === state.facility ? '#23334b' : d.rank <=
      topN() ? '#bf542d' : '#527fa6').attr('fill-opacity', d => d.rank <= topN() ? .75 : .35)
    .attr('stroke', d => d === state.facility ? '#fffdf7' : 'none').attr('stroke-width', 2), d =>
    `${d.facility} · ${d.state} · ${fmt(d.emissions_tonnes)} t`, selectFacility);
  // Week 8: append SVG primitives and set their attributes.
  // Geographic projection and zoom are existing extensions beyond the class examples.
  const selected = state.facility;
  if (selected && selected.mapValid) {
    const point = projection([selected.longitude, selected.latitude]);
    const marker = layer.append('g').attr('class', 'map-selection').attr('pointer-events', 'none');
    marker.append('circle')
      .attr('cx', point[0]).attr('cy', point[1])
      .attr('r', Math.max(1.6, radius(selected.emissions_tonnes)) + 4)
      .attr('fill', 'none').attr('stroke', '#bf542d').attr('stroke-width', 3);
    marker.append('text')
      .attr('class', 'map-selection-label')
      .attr('x', point[0]).attr('y', point[1] - 12)
      .attr('text-anchor', point[0] > 245 ? 'end' : 'start')
      .attr('paint-order', 'stroke').attr('stroke', '#fff').attr('stroke-width', 3)
      .text(selected.facility);
  }
  mapZoom = d3.zoom().scaleExtent([1, 10])
    .extent([
      [0, 0],
      [490, 365]
    ]).translateExtent([
      [-100, -100],
      [590, 465]
    ])
    .on('zoom', function(event) {
      layer.attr('transform', event.transform);
    });
  let view = previous;
  if (focusFacilityOnMap && selected && selected.mapValid) {
    const point = projection([selected.longitude, selected.latitude]);
    view = d3.zoomIdentity.translate(245, 182).scale(2).translate(-point[0], -point[1]);
  }
  focusFacilityOnMap = false;
  mapSvg.call(mapZoom).call(mapZoom.transform, view);
  $('map-note').textContent =
    `${fmt(mapped.length)} facilities mapped; ${data.facilities.length-mapped.length} outside the coordinate extent remain in the national denominator. Circle sizes: 1,000 t ≈ ${pct(Math.max(1.6,radius(1000)))} px radius; largest = 25 px. Small circles have a minimum radius for visibility.`;
}

function renderDetail() {
  const host = d3.select('#facility-detail');
  host.selectAll('*').remove();
  const f = state.facility;
  if (!f) {
    host.append('h3').text('Follow a facility');
    host.append('p').attr('class', 'fine').text(
      'Select a circle, ranking bar, curve position or search result to see its contribution and substance breakdown.'
      );
    return;
  }
  host.append('div').attr('class', 'eyebrow').text(
    `RANK ${fmt(f.rank)} / ${fmt(data.facilities.length)} · ${f.state}`);
  host.append('div').attr('class', 'facility-title').text(f.facility);
  host.append('p').attr('class', 'fine').text(f.industry + (f.mapValid ? '' :
    ' · Coordinates unavailable or outside map extent'));
  const stats = host.append('div').attr('class', 'detail-stats');
  [{
    v: compact(f.emissions_tonnes) + ' t',
    l: 'Reported sum'
  }, {
    v: pct(f.share) + '%',
    l: 'Individual national share'
  }, {
    v: pct(f.cumulative) + '%',
    l: 'Cumulative through rank'
  }].forEach(d => {
    const el = stats.append('div');
    el.append('strong').text(d.v);
    el.append('span').text(d.l);
  });
  if (/^https?:\/\//i.test(f.report_url)) host.append('a').attr('href', f.report_url).attr('target',
    '_blank').attr('rel', 'noopener').attr('class', 'fine').text('Open original NPI report ↗');
  const det = host.append('details');
  det.append('summary').text(`Substance breakdown (${f.substances.length} reported substances)`);
  table(det.append('div'), ['Substance', 'Tonnes'], f.substances.map(d => [d.name, fmt(d.tonnes)]));
}

function table(host, headers, rows) {
  const t = host.append('table');
  t.append('thead').append('tr').selectAll('th').data(headers).join('th').attr('scope', 'col').text(
    d => d);
  t.append('tbody').selectAll('tr').data(rows).join('tr').selectAll('td').data(d => d).join('td')
    .attr('class', (d, i) => i ? 'num' : null).text(d => d);
}

function renderMix() {
  const svg = svgAt('heatmap', 1000, 420, 'Six-substance share of selected sum by industry'),
    x = d3.scaleBand(pollutants, [250, 980]).padding(.06),
    y = d3.scaleBand(industries, [45, 320]).padding(.08),
    valueToColour = d3.scaleLinear().domain([0, 100]).range([0, 1]),
    color = function(value) {
      return d3.interpolateBlues(valueToColour(value));
    };

  const legend = svg.append('g').attr('transform', 'translate(250,350)');
  legend.append('text').text('Share of six-substance sum');
  const legendValues = [];
  for (let value = 0; value < 100; value += 1) {
    legendValues.push(value);
  }
  legend.selectAll('.legend-step')
    .data(legendValues).join('rect').attr('class', 'legend-step')
    .attr('x', function(value) {
      return value * 3.6;
    })
    .attr('y', 10).attr('width', 3.7).attr('height', 14)
    .attr('fill', function(value) {
      return color(value);
    });
  const legendScale = d3.scaleLinear().domain([0, 100]).range([0, 360]);
  legend.append('g').attr('transform', 'translate(0,24)')
    .call(d3.axisBottom(legendScale).tickValues([0, 25, 50, 75, 100])
      .tickFormat(function(value) {
        return value + '%';
      }));
  legend.append('rect').attr('x', 430).attr('y', 10)
    .attr('width', 22).attr('height', 14).attr('fill', '#e4e5df');
  legend.append('text').attr('x', 462).attr('y', 22).text('N/A · unavailable share');
  pollutants.forEach(p => svg.append('text').attr('x', x(p) + x.bandwidth() / 2).attr('y', 25).attr(
    'text-anchor', 'middle').text(p));
  industries.forEach(ind => svg.append('text').attr('x', 235).attr('y', y(ind) + y.bandwidth() / 2 +
    4).attr('text-anchor', 'end').attr('font-weight', state.industry === ind ? 'bold' :
    'normal').text(ind));
  data.mix.forEach(d => {
    d.denominator = d3.sum(data.mix.filter(m => m.industry === d.industry), m => m
      .emissions_tonnes);
    d.share = d.emissions_tonnes === null || !d.denominator ? null : d.emissions_tonnes / d
      .denominator * 100;
  });
  const cells = svg.selectAll('.cell').data(data.mix).join('g').attr('class', 'cell');
  cells.append('rect').attr('x', d => x(d.pollutant)).attr('y', d => y(d.industry)).attr('width', x
    .bandwidth()).attr('height', y.bandwidth()).attr('fill', d => d.share === null ? '#e4e5df' :
    color(d.share)).attr('stroke', d => d.industry === state.mixIndustry && d.pollutant === state
    .pollutant ? '#bf542d' : d.industry === state.industry ? '#23334b' : 'none').attr(
    'stroke-width', 2.5);
  cells.append('text').attr('x', d => x(d.pollutant) + x.bandwidth() / 2).attr('y', d => y(d
    .industry) + y.bandwidth() / 2 + 4).attr('text-anchor', 'middle').style('fill', d => d.share >
    55 ? 'white' : '#23334b').text(d => d.share === null ? 'N/A' : pct(d.share) + '%');
  interactive(cells, d =>
    `${d.industry} · ${d.name}: ${d.share===null?'N/A':pct(d.share)+'% · '+fmt(d.emissions_tonnes)+' t'}`,
    d => {
      state.mixIndustry = d.industry;
      state.pollutant = d.pollutant;
      $('mix-industry').value = d.industry;
      $('pollutant').value = d.pollutant;
      renderMix();
    });
  const d = data.mix.find(d => d.industry === state.mixIndustry && d.pollutant === state.pollutant);
  $('mix-detail').textContent =
    `${d.industry} / ${d.name}: ${d.share===null?'N/A — no usable records':fmt(d.emissions_tonnes)+' tonnes ÷ '+fmt(d.denominator)+' tonnes across six substances = '+pct(d.share)+'%'}. Usable records: ${fmt(d.usable)}; missing values: ${fmt(d.missing)}.`;
}
$('industry').onchange = e => {
  state.industry = e.target.value;
  renderTrends();
  renderMix();
};
$('metric').onchange = e => {
  state.metric = e.target.value;
  renderTrends();
};
$('year').onchange = e => {
  state.year = e.target.value;
  state.selectedTrend = null;
  renderTrends();
};
$('top').onchange = e => {
  state.top = +e.target.value;
  renderFacilities();
};
$('search').oninput = facilityOptions;
$('search').onfocus = function() {
  if (this.value.trim()) facilityOptions();
};
$('search').onkeydown = function(event) {
  if (event.key === 'Escape') {
    closeSuggestions();
    return;
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if ($('facility-suggestions').hidden) facilityOptions();
    if (!searchResults.length) return;
    activeResult = event.key === 'ArrowDown' ? (activeResult + 1) % searchResults.length : (
      activeResult <= 0 ? searchResults.length - 1 : activeResult - 1);
    d3.select('#facility-suggestions').selectAll('.search-result')
      .classed('active', function(d, i) {
        return i === activeResult;
      })
      .attr('aria-selected', function(d, i) {
        return i === activeResult ? 'true' : 'false';
      });
    $('search').setAttribute('aria-activedescendant', 'facility-result-' + activeResult);
    $('facility-result-' + activeResult).scrollIntoView({
      block: 'nearest'
    });
  } else if (event.key === 'Enter' && !$('facility-suggestions').hidden && searchResults.length) {
    event.preventDefault();
    selectFacility(searchResults[activeResult < 0 ? 0 : activeResult]);
  }
};
$('search').onblur = closeSuggestions;
$('search-clear').onclick = function() {
  $('search').value = '';
  facilityOptions();
  closeSuggestions();
  $('search').focus();
};
$('facility-select').onchange = function(event) {
  const facility = data.facilities.find(d => d.facility_id === event.target.value);
  if (facility) selectFacility(facility);
  else {
    state.facility = null;
    renderFacilities();
  }
};
$('map-reset').onclick = () => mapSvg.call(mapZoom.transform, d3.zoomIdentity);
$('mix-industry').onchange = e => {
  state.mixIndustry = e.target.value;
  renderMix();
};
$('pollutant').onchange = e => {
  state.pollutant = e.target.value;
  renderMix();
};
$('show-trend').onclick = () => {
  state.industry = state.mixIndustry;
  $('industry').value = state.industry;
  renderTrends();
  renderMix();
  $('trends').scrollIntoView();
};
$('reset').onclick = () => {
  Object.assign(state, {
    industry: 'All industries',
    year: years.at(-1),
    metric: 'mass',
    selectedTrend: null,
    top: 1,
    facility: null,
    mixIndustry: industries[0],
    pollutant: pollutants[0]
  });
  for (const [id, v] of Object.entries({
      industry: state.industry,
      year: state.year,
      metric: state.metric,
      top: 1,
      search: '',
      'mix-industry': state.mixIndustry,
      pollutant: state.pollutant
    })) $(id).value = v;
  mapSvg.call(mapZoom.transform, d3.zoomIdentity);
  facilityOptions();
  renderTrends();
  renderFacilities();
  renderMix();
};
$('download').onclick = () => {
  const columns = ['rank', 'facility_id', 'facility', 'industry', 'state', 'latitude',
    'longitude', 'emissions_tonnes', 'share', 'cumulative', 'report_url'
  ];
  const csv = d3.csvFormat(data.facilities.map(d => Object.fromEntries(columns.map(k => [k, d[
    k]]))), columns);
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], {
    type: 'text/csv;charset=utf-8'
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'NPI_facilities_2024-25.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('hero-share').textContent = pct(data.facilities[Math.ceil(data.facilities.length * .01) - 1]
  .cumulative) + '%';
$('hero-count').textContent = fmt(data.facilities.length) + ' facilities · 18 reporting years';
$('checks').textContent =
  `${fmt(data.checks.usable)} usable records from ${fmt(data.checks.raw)} original records. All ${fmt(data.facilities.length)} latest-year facilities remain in national totals.`;
table(d3.select('#coverage'), ['Industry', 'Six substances (t)', 'All reported sum (t)',
  'Coverage'], data.coverage.map(d => [d.industry, fmt(d.selected_tonnes), fmt(d
    .all_reported_tonnes), pct(d.selected_tonnes / d.all_reported_tonnes * 100) + '%']));
facilityOptions();
renderTrends();
renderFacilities();
renderMix();
