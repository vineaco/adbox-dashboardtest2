'use client';

import { useMemo, useState } from 'react';
import { Modal } from './ui';
import {
  BuildingIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  GlobeIcon,
  MapPinIcon,
  SearchIcon,
  TrashIcon
} from './Icon';

function parseBoundaryLocation(b) {
  const classifications = Array.isArray(b.classifications) ? b.classifications : [];

  const country = classifications.find((c) => c.type === 'country')?.label || 'Nigeria';
  let state = classifications.find((c) => c.type === 'state' || c.type === 'region')?.label;
  const lga = classifications.find(
    (c) => c.type === 'local-government-area' || c.type === 'county' || c.type === 'state_district'
  )?.label;
  const city = classifications.find(
    (c) => c.type === 'city' || c.type === 'town' || c.type === 'municipality'
  )?.label;

  // Infer state if not explicitly classified as state
  if (!state) {
    if (city === 'Lagos' || b.name.toLowerCase().includes('lagos')) {
      state = 'Lagos';
    } else if (b.name.toLowerCase().includes('ibadan') || city === 'Ìbàdàn') {
      state = 'Oyo';
    } else if (lga === 'Ifo' || city === 'Isheri') {
      state = 'Ogun';
    } else {
      state = 'Other Region';
    }
  }

  const cityOrDistrict = city || lga || 'General Area';
  return { country, state, city: cityOrDistrict, lga, raw: classifications };
}

export default function BoundaryPickerModal({ boundaries, selectedIds = [], onConfirm, onClose }) {
  const [selected, setSelected] = useState(() => new Set(selectedIds));
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [collapsedStates, setCollapsedStates] = useState(() => new Set());

  // Enrich each boundary with its parsed geographic hierarchy
  const enrichedBoundaries = useMemo(() => {
    return boundaries.map((b) => ({
      ...b,
      geo: parseBoundaryLocation(b)
    }));
  }, [boundaries]);

  // Extract distinct Countries, States, Cities for cascading dropdowns
  const availableCountries = useMemo(() => {
    const set = new Set();
    enrichedBoundaries.forEach((b) => set.add(b.geo.country));
    return Array.from(set).sort();
  }, [enrichedBoundaries]);

  const availableStates = useMemo(() => {
    const set = new Set();
    enrichedBoundaries.forEach((b) => {
      if (countryFilter === 'all' || b.geo.country === countryFilter) {
        set.add(b.geo.state);
      }
    });
    return Array.from(set).sort();
  }, [enrichedBoundaries, countryFilter]);

  const availableCities = useMemo(() => {
    const set = new Set();
    enrichedBoundaries.forEach((b) => {
      const matchCountry = countryFilter === 'all' || b.geo.country === countryFilter;
      const matchState = stateFilter === 'all' || b.geo.state === stateFilter;
      if (matchCountry && matchState) {
        set.add(b.geo.city);
      }
    });
    return Array.from(set).sort();
  }, [enrichedBoundaries, countryFilter, stateFilter]);

  // Filter boundaries by search and cascading selects
  const term = search.trim().toLowerCase();
  const filteredBoundaries = useMemo(() => {
    return enrichedBoundaries.filter((b) => {
      if (countryFilter !== 'all' && b.geo.country !== countryFilter) return false;
      if (stateFilter !== 'all' && b.geo.state !== stateFilter) return false;
      if (cityFilter !== 'all' && b.geo.city !== cityFilter) return false;
      if (!term) return true;
      const classLabels = Array.isArray(b.classifications) ? b.classifications.map((c) => c.label).join(' ') : '';
      return `${b.name} ${b.geo.country} ${b.geo.state} ${b.geo.city} ${classLabels} ${b.type}`
        .toLowerCase()
        .includes(term);
    });
  }, [enrichedBoundaries, countryFilter, stateFilter, cityFilter, term]);

  // Build hierarchical grouping: Country -> State -> City -> [Boundaries]
  const hierarchyTree = useMemo(() => {
    const tree = new Map();

    for (const b of filteredBoundaries) {
      const { country, state, city } = b.geo;
      if (!tree.has(country)) tree.set(country, new Map());
      const statesMap = tree.get(country);

      if (!statesMap.has(state)) statesMap.set(state, new Map());
      const citiesMap = statesMap.get(state);

      if (!citiesMap.has(city)) citiesMap.set(city, []);
      citiesMap.get(city).push(b);
    }

    return tree;
  }, [filteredBoundaries]);

  // Toggle single boundary
  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle all boundaries in a state ("if all state" drilldown shortcut)
  const toggleStateBoundaries = (stateBoundaries) => {
    const allSelected = stateBoundaries.every((b) => selected.has(b.id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const b of stateBoundaries) {
        if (allSelected) next.delete(b.id);
        else next.add(b.id);
      }
      return next;
    });
  };

  // Toggle all boundaries in a city
  const toggleCityBoundaries = (cityBoundaries) => {
    const allSelected = cityBoundaries.every((b) => selected.has(b.id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const b of cityBoundaries) {
        if (allSelected) next.delete(b.id);
        else next.add(b.id);
      }
      return next;
    });
  };

  // Select/Deselect all currently filtered boundaries
  const toggleAllFiltered = () => {
    const allSelected = filteredBoundaries.every((b) => selected.has(b.id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const b of filteredBoundaries) {
        if (allSelected) next.delete(b.id);
        else next.add(b.id);
      }
      return next;
    });
  };

  const toggleStateCollapse = (stateKey) => {
    setCollapsedStates((prev) => {
      const next = new Set(prev);
      if (next.has(stateKey)) next.delete(stateKey);
      else next.add(stateKey);
      return next;
    });
  };

  const save = () => {
    onConfirm(Array.from(selected));
    onClose();
  };

  return (
    <Modal
      wide
      title="Select geographic boundaries"
      description="Drill down from Country to State to City, or pick specific boundary zones to target with this campaign."
      onClose={onClose}
    >
      <div className="picker-modal-inner">
        {/* Cascading Filter Bar */}
        <div className="cascade-toolbar">
          <label className="cascade-field">
            Search
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="search"
                placeholder="Zone, city, or area name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </label>

          <label className="cascade-field">
            Country
            <select
              value={countryFilter}
              onChange={(e) => {
                setCountryFilter(e.target.value);
                setStateFilter('all');
                setCityFilter('all');
              }}
            >
              <option value="all">All Countries</option>
              {availableCountries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="cascade-field">
            State / Region
            <select
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setCityFilter('all');
              }}
            >
              <option value="all">All States</option>
              {availableStates.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="cascade-field">
            City / District
            <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              <option value="all">All Cities / Districts</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end', flexWrap: 'wrap' }}>
            {(countryFilter !== 'all' || stateFilter !== 'all' || cityFilter !== 'all' || search) && (
              <button
                type="button"
                className="btn tiny"
                onClick={() => {
                  setSearch('');
                  setCountryFilter('all');
                  setStateFilter('all');
                  setCityFilter('all');
                }}
              >
                Reset filters
              </button>
            )}
            <button type="button" className="btn tiny" onClick={toggleAllFiltered}>
              {filteredBoundaries.length && filteredBoundaries.every((b) => selected.has(b.id))
                ? 'Deselect all visible'
                : 'Select all visible'}
            </button>
            {selected.size > 0 && (
              <button type="button" className="btn tiny danger" onClick={() => setSelected(new Set())} title="Clear all">
                <TrashIcon />
              </button>
            )}
          </div>
        </div>

        {/* Hierarchical Tree of Boundaries */}
        {filteredBoundaries.length > 0 ? (
          <div className="geo-tree">
            {Array.from(hierarchyTree.entries()).map(([country, statesMap]) => {
              const countryBoundaries = Array.from(statesMap.values()).flatMap((citiesMap) =>
                Array.from(citiesMap.values()).flat()
              );
              const allCountrySelected = countryBoundaries.every((b) => selected.has(b.id));

              return (
                <div key={country} className="geo-country-block">
                  <div className="geo-country-header">
                    <div className="geo-country-title">
                      <GlobeIcon />
                      <span>{country}</span>
                      <span className="geo-state-count">{countryBoundaries.length} zones</span>
                    </div>
                    <button
                      type="button"
                      className={`select-state-btn ${allCountrySelected ? 'active' : ''}`}
                      onClick={() => toggleStateBoundaries(countryBoundaries)}
                    >
                      <CheckIcon />
                      {allCountrySelected ? `Selected all in ${country}` : `Select all in ${country}`}
                    </button>
                  </div>

                  {/* States under Country */}
                  {Array.from(statesMap.entries()).map(([state, citiesMap]) => {
                    const allStateBoundaries = enrichedBoundaries.filter(
                      (b) => b.geo.state === state && b.geo.country === country
                    );
                    const stateBoundaries = Array.from(citiesMap.values()).flat();
                    const stateSelectedCount = allStateBoundaries.filter((b) => selected.has(b.id)).length;
                    const allStateSelected = stateSelectedCount === allStateBoundaries.length;
                    const isCollapsed = collapsedStates.has(state);

                    return (
                      <div
                        key={state}
                        className={`geo-state-card ${stateSelectedCount > 0 ? 'highlight' : ''}`}
                      >
                        <div className="geo-state-header" onClick={() => toggleStateCollapse(state)}>
                          <div className="geo-state-info">
                            <MapPinIcon />
                            <strong>{state}</strong>
                            <span className="geo-state-count">
                              {stateSelectedCount > 0
                                ? `${stateSelectedCount} of ${allStateBoundaries.length} selected`
                                : `${allStateBoundaries.length} zones`}
                            </span>
                          </div>

                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className={`select-state-btn ${allStateSelected ? 'active' : ''}`}
                              onClick={() => toggleStateBoundaries(allStateBoundaries)}
                            >
                              <CheckIcon />
                              {allStateSelected ? `Selected all in ${state}` : `Select all in ${state}`}
                            </button>
                            <button
                              type="button"
                              className="btn tiny"
                              onClick={() => toggleStateCollapse(state)}
                              aria-label={isCollapsed ? 'Expand state' : 'Collapse state'}
                            >
                              {isCollapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
                            </button>
                          </div>
                        </div>

                        {/* Cities and zones inside State */}
                        {!isCollapsed && (
                          <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
                            {Array.from(citiesMap.entries()).map(([city, cityBoundaries]) => {
                              const allCitySelected = cityBoundaries.every((b) => selected.has(b.id));

                              return (
                                <div key={city} className="geo-city-group">
                                  <div className="geo-city-header">
                                    <strong>
                                      <BuildingIcon />
                                      {city}
                                    </strong>
                                    <button
                                      type="button"
                                      className={`select-state-btn ${allCitySelected ? 'active' : ''}`}
                                      onClick={() => toggleCityBoundaries(cityBoundaries)}
                                      style={{ padding: '2px 7px', fontSize: 9 }}
                                    >
                                      {allCitySelected ? `All ${cityBoundaries.length} selected` : `Select all in ${city}`}
                                    </button>
                                  </div>

                                  <div className="geo-zones-grid">
                                    {cityBoundaries.map((b) => {
                                      const isChecked = selected.has(b.id);
                                      const classSummary = Array.isArray(b.classifications) && b.classifications.length
                                        ? b.classifications.map((c) => c.label).join(' · ')
                                        : `${b.geo.country} · ${b.geo.state}`;

                                      return (
                                        <div
                                          key={b.id}
                                          className={`geo-zone-card ${isChecked ? 'selected' : ''}`}
                                          onClick={() => toggle(b.id)}
                                          role="checkbox"
                                          aria-checked={isChecked}
                                          tabIndex={0}
                                          onKeyDown={(e) => {
                                            if (e.key === ' ' || e.key === 'Enter') {
                                              e.preventDefault();
                                              toggle(b.id);
                                            }
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {}}
                                            tabIndex={-1}
                                            aria-label={`Select ${b.name}`}
                                          />
                                          <div className="geo-zone-info">
                                            <strong>{b.name}</strong>
                                            <small>{classSummary}</small>
                                          </div>
                                          {b.avgDailyTraffic && (
                                            <span className="geo-zone-traffic" title="Estimated daily traffic">
                                              ~{Number(b.avgDailyTraffic).toLocaleString()}/day
                                            </span>
                                          )}
                                          <span className="picker-badge">
                                            {b.type === 'circle'
                                              ? `Circle (${Math.round(b.radius)}m)`
                                              : `Polygon (${b.points.length} pts)`}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty" style={{ minHeight: 160 }}>
            <i>
              <SearchIcon />
            </i>
            <strong>No boundaries match your filter</strong>
            <p>Try clearing your search terms or expanding your country and state selections.</p>
          </div>
        )}

        {/* Modal Footer / Actions */}
        <div className="form-actions" style={{ marginTop: 12, paddingTop: 14 }}>
          <div style={{ marginRight: 'auto', alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#008d9f', fontWeight: 700 }}>
              {selected.size} boundary zone(s) selected
            </span>
            <span style={{ fontSize: 11, color: '#7f92a6' }}>
              across {boundaries.length} total available
            </span>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={save}>
            Apply selection
          </button>
        </div>
      </div>
    </Modal>
  );
}
