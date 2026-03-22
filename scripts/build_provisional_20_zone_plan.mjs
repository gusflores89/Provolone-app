import fs from "node:fs";
import path from "node:path";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const [header, ...body] = rows;
  return body.map((values) =>
    Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])),
  );
}

function stringifyCsv(rows, headers) {
  const escape = (value) => {
    const text = value == null ? "" : String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escape(row[header] ?? "")).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

function parseMicroZonaLabel(label) {
  const match = /^IN-R(\d+)-C(\d+)$/i.exec(label);
  if (!match) return null;
  return {
    row: Number(match[1]),
    col: Number(match[2]),
  };
}

function distance(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function centroid(cells) {
  const total = cells.length || 1;
  return {
    row: cells.reduce((sum, cell) => sum + cell.row, 0) / total,
    col: cells.reduce((sum, cell) => sum + cell.col, 0) / total,
  };
}

function neighbors(cell) {
  return [
    { row: cell.row - 1, col: cell.col },
    { row: cell.row + 1, col: cell.col },
    { row: cell.row, col: cell.col - 1 },
    { row: cell.row, col: cell.col + 1 },
  ];
}

function zoneCellKey(cell) {
  return `${cell.row},${cell.col}`;
}

function isConnected(cells) {
  if (cells.length <= 1) return true;
  const byKey = new Map(cells.map((cell) => [zoneCellKey(cell), cell]));
  const visited = new Set();
  const stack = [cells[0]];
  visited.add(zoneCellKey(cells[0]));

  while (stack.length > 0) {
    const current = stack.pop();
    for (const next of neighbors(current)) {
      const key = `${next.row},${next.col}`;
      if (!byKey.has(key) || visited.has(key)) continue;
      visited.add(key);
      stack.push(byKey.get(key));
    }
  }

  return visited.size === cells.length;
}

function areAdjacentToZone(cell, zone) {
  return zone.cells.some((zoneCell) => distance(zoneCell, cell) === 1);
}

function buildComponents(cells) {
  const byKey = new Map(cells.map((cell) => [cell.micro_zona, cell]));
  const visited = new Set();
  const components = [];

  for (const cell of cells) {
    if (visited.has(cell.micro_zona)) continue;

    const stack = [cell];
    const component = [];
    visited.add(cell.micro_zona);

    while (stack.length > 0) {
      const current = stack.pop();
      component.push(current);

      for (const next of neighbors(current)) {
        const key = `IN-R${String(next.row).padStart(2, "0")}-C${String(next.col).padStart(2, "0")}`;
        const neighbor = byKey.get(key);
        if (!neighbor || visited.has(key)) continue;
        visited.add(key);
        stack.push(neighbor);
      }
    }

    components.push(component);
  }

  return components.sort(
    (left, right) =>
      right.reduce((sum, cell) => sum + cell.clientes, 0) -
        left.reduce((sum, cell) => sum + cell.clientes, 0) ||
      right.length - left.length,
  );
}

function selectSeeds(cells, zoneCount) {
  const sorted = [...cells].sort((a, b) => b.clientes - a.clientes || a.row - b.row || a.col - b.col);
  const seeds = [];

  for (const cell of sorted) {
    if (seeds.length === 0) {
      seeds.push(cell);
      if (seeds.length === zoneCount) break;
      continue;
    }

    const minDistance = Math.min(...seeds.map((seed) => distance(seed, cell)));
    if (minDistance >= 2) {
      seeds.push(cell);
      if (seeds.length === zoneCount) break;
    }
  }

  for (const cell of sorted) {
    if (seeds.length === zoneCount) break;
    if (!seeds.includes(cell)) {
      seeds.push(cell);
    }
  }

  return seeds.slice(0, zoneCount);
}

function rebalanceZones(zones, target) {
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 1000) {
    changed = false;
    iterations += 1;

    const sorted = [...zones].sort((a, b) => a.totalClientes - b.totalClientes);
    const under = sorted[0];
    const over = sorted[sorted.length - 1];

    if (!under || !over) break;
    if (over.totalClientes - under.totalClientes <= 40) break;

    let bestMove = null;

    for (const source of [...zones].sort((a, b) => b.totalClientes - a.totalClientes)) {
      if (source.totalClientes <= target) continue;

      for (const targetZone of [...zones].sort((a, b) => a.totalClientes - b.totalClientes)) {
        if (source.zoneCode === targetZone.zoneCode) continue;
        if (targetZone.totalClientes >= target) continue;

        const boundaryCells = source.cells.filter((cell) => areAdjacentToZone(cell, targetZone));

        for (const cell of boundaryCells) {
          const remaining = source.cells.filter((item) => item.micro_zona !== cell.micro_zona);
          if (!isConnected(remaining)) continue;

          const sourceAfter = source.totalClientes - cell.clientes;
          const targetAfter = targetZone.totalClientes + cell.clientes;
          const beforeGap =
            Math.abs(source.totalClientes - target) + Math.abs(targetZone.totalClientes - target);
          const afterGap = Math.abs(sourceAfter - target) + Math.abs(targetAfter - target);
          const improvement = beforeGap - afterGap;

          if (improvement <= 0) continue;

          const candidate = {
            source,
            targetZone,
            cell,
            improvement,
            targetGap: Math.abs(targetAfter - target),
          };

          if (
            !bestMove ||
            candidate.improvement > bestMove.improvement ||
            (candidate.improvement === bestMove.improvement &&
              candidate.targetGap < bestMove.targetGap)
          ) {
            bestMove = candidate;
          }
        }
      }
    }

    if (!bestMove) break;

    bestMove.source.cells = bestMove.source.cells.filter(
      (cell) => cell.micro_zona !== bestMove.cell.micro_zona,
    );
    bestMove.targetZone.cells.push(bestMove.cell);
    bestMove.source.totalClientes -= bestMove.cell.clientes;
    bestMove.targetZone.totalClientes += bestMove.cell.clientes;
    changed = true;
  }

  return zones;
}

function clusterInternal(okCells, zoneCount, prefix) {
  const components = buildComponents(okCells);
  const primaryComponent = components[0] ?? [];
  const isolatedCells = components.slice(1).flat();
  const totalClientes = primaryComponent.reduce((sum, cell) => sum + cell.clientes, 0);
  const target = totalClientes / zoneCount;
  const pending = new Map(primaryComponent.map((cell) => [cell.micro_zona, cell]));
  const seeds = selectSeeds(primaryComponent, zoneCount);

  const zones = seeds.map((seed, index) => {
    pending.delete(seed.micro_zona);
    return {
      zoneCode: `${prefix}${String(index + 1).padStart(2, "0")}`,
      cells: [seed],
      totalClientes: seed.clientes,
      tipo: "INTERNA",
    };
  });

  while (pending.size > 0) {
    let progressed = false;
    const zonesByLoad = [...zones].sort((a, b) => a.totalClientes - b.totalClientes);

    for (const zone of zonesByLoad) {
      const center = centroid(zone.cells);
      const frontierKeys = new Set();
      const candidates = [];

      for (const cell of zone.cells) {
        for (const next of neighbors(cell)) {
          const key = `IN-R${String(next.row).padStart(2, "0")}-C${String(next.col).padStart(2, "0")}`;
          if (frontierKeys.has(key)) continue;
          const candidate = pending.get(key);
          if (!candidate) continue;
          frontierKeys.add(key);
          candidates.push(candidate);
        }
      }

      if (candidates.length === 0) continue;

      candidates.sort((left, right) => {
        const leftTargetGap = Math.abs(target - (zone.totalClientes + left.clientes));
        const rightTargetGap = Math.abs(target - (zone.totalClientes + right.clientes));
        if (leftTargetGap !== rightTargetGap) return leftTargetGap - rightTargetGap;

        const leftCenter = Math.abs(center.row - left.row) + Math.abs(center.col - left.col);
        const rightCenter = Math.abs(center.row - right.row) + Math.abs(center.col - right.col);
        if (leftCenter !== rightCenter) return leftCenter - rightCenter;

        if (left.clientes !== right.clientes) return right.clientes - left.clientes;
        return left.micro_zona.localeCompare(right.micro_zona, "es");
      });

      const selected = candidates[0];
      zone.cells.push(selected);
      zone.totalClientes += selected.clientes;
      pending.delete(selected.micro_zona);
      progressed = true;

      if (pending.size === 0) break;
    }

    if (!progressed) {
      throw new Error(`No se pudo asignar ${pending.size} microzonas internas manteniendo contigüidad.`);
    }
  }

  return {
    zones: rebalanceZones(zones, target)
      .map((zone) => ({
        ...zone,
        cells: zone.cells.sort((a, b) => a.row - b.row || a.col - b.col),
      }))
      .sort((a, b) => a.zoneCode.localeCompare(b.zoneCode, "es")),
    isolatedCells,
  };
}

function squaredDistance(a, b) {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

function selectPointSeeds(points, clusterCount) {
  const sorted = [...points].sort((a, b) => a.lat - b.lat || a.lng - b.lng);
  const seeds = [sorted[0]];

  while (seeds.length < clusterCount && seeds.length < sorted.length) {
    let bestPoint = null;
    let bestDistance = -1;
    for (const point of sorted) {
      const minDistance = Math.min(...seeds.map((seed) => squaredDistance(point, seed)));
      if (minDistance > bestDistance) {
        bestDistance = minDistance;
        bestPoint = point;
      }
    }
    seeds.push(bestPoint);
  }

  return seeds.slice(0, clusterCount).map((seed) => ({ lat: seed.lat, lng: seed.lng }));
}

function balancedGeoClusters(points, clusterCount, prefix) {
  const capacities = Array.from({ length: clusterCount }, (_, index) => {
    const base = Math.floor(points.length / clusterCount);
    const extra = index < points.length % clusterCount ? 1 : 0;
    return base + extra;
  });

  let centers = selectPointSeeds(points, clusterCount);

  for (let iteration = 0; iteration < 15; iteration += 1) {
    const distances = points.map((point) => {
      const ordered = centers
        .map((center, index) => ({
          index,
          distance: squaredDistance(point, center),
        }))
        .sort((left, right) => left.distance - right.distance);

      return {
        point,
        choices: ordered,
        margin:
          (ordered[1]?.distance ?? ordered[0]?.distance ?? 0) - (ordered[0]?.distance ?? 0),
      };
    });

    distances.sort((left, right) => right.margin - left.margin);
    const clusters = Array.from({ length: clusterCount }, () => []);

    for (const item of distances) {
      const choice = item.choices.find((entry) => clusters[entry.index].length < capacities[entry.index]);
      const fallback = choice ?? item.choices[0];
      clusters[fallback.index].push(item.point);
    }

    centers = clusters.map((cluster, index) => {
      if (cluster.length === 0) return centers[index];
      return {
        lat: cluster.reduce((sum, point) => sum + point.lat, 0) / cluster.length,
        lng: cluster.reduce((sum, point) => sum + point.lng, 0) / cluster.length,
      };
    });
  }

  const distances = points.map((point) => {
    const ordered = centers
      .map((center, index) => ({
        index,
        distance: squaredDistance(point, center),
      }))
      .sort((left, right) => left.distance - right.distance);

    return {
      point,
      choices: ordered,
      margin:
        (ordered[1]?.distance ?? ordered[0]?.distance ?? 0) - (ordered[0]?.distance ?? 0),
    };
  });

  distances.sort((left, right) => right.margin - left.margin);
  const clusters = Array.from({ length: clusterCount }, () => []);

  for (const item of distances) {
    const choice = item.choices.find((entry) => clusters[entry.index].length < capacities[entry.index]);
    const fallback = choice ?? item.choices[0];
    clusters[fallback.index].push(item.point);
  }

  return clusters
    .map((cluster, index) => ({
      zoneCode: `${prefix}${String(index + 1).padStart(2, "0")}`,
      tipo: "FUERA",
      rows: cluster.sort((a, b) => a.lat - b.lat || a.lng - b.lng),
      totalClientes: cluster.length,
    }))
    .sort((a, b) => a.zoneCode.localeCompare(b.zoneCode, "es"));
}

function balancedBuckets(rows, bucketCount, prefix, tipo) {
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    zoneCode: `${prefix}${String(index + 1).padStart(2, "0")}`,
    tipo,
    rows: [],
    totalClientes: 0,
  }));

  const sorted = [...rows].sort(
    (a, b) =>
      String(a.direccion || "").localeCompare(String(b.direccion || ""), "es") ||
      String(a.cliente_id || "").localeCompare(String(b.cliente_id || ""), "es"),
  );

  for (const row of sorted) {
    buckets.sort((a, b) => a.totalClientes - b.totalClientes || a.zoneCode.localeCompare(b.zoneCode, "es"));
    buckets[0].rows.push(row);
    buckets[0].totalClientes += 1;
  }

  return buckets.sort((a, b) => a.zoneCode.localeCompare(b.zoneCode, "es"));
}

function isPlausibleFuera(lat, lng) {
  return lat >= -35 && lat <= -30 && lng >= -65.5 && lng <= -61.5;
}

function main() {
  const dataDir = process.argv[2] || path.resolve(process.cwd(), "data");
  const clientsPath = path.join(dataDir, "Base_clientes_rutas_provolone - CLIENTES (3).csv");
  const microzonesPath = path.join(dataDir, "Base_clientes_rutas_provolone - Microzonas (1).csv");
  const outClientsPath = path.join(dataDir, "Base_clientes_rutas_provolone - CLIENTES plan20.csv");
  const outZonesPath = path.join(dataDir, "Base_clientes_rutas_provolone - ZONAS_NUEVAS plan20.csv");

  const clients = parseCsv(fs.readFileSync(clientsPath, "utf8"));
  const microzones = parseCsv(fs.readFileSync(microzonesPath, "utf8"));

  const okCells = microzones
    .filter((row) => row.estado === "OK_COORD")
    .map((row) => {
      const parsed = parseMicroZonaLabel(row.micro_zona);
      if (!parsed) return null;
      return {
        micro_zona: row.micro_zona,
        row: parsed.row,
        col: parsed.col,
        clientes: Number(row.clientes || 0),
      };
    })
    .filter(Boolean);

  const { zones: internalZones, isolatedCells } = clusterInternal(okCells, 13, "ZI");
  const internalByMicro = new Map();
  for (const zone of internalZones) {
    for (const cell of zone.cells) {
      internalByMicro.set(cell.micro_zona, zone.zoneCode);
    }
  }

  const isolatedMicroSet = new Set(isolatedCells.map((cell) => cell.micro_zona));

  const validFueraRows = [];
  const reviewRows = [];

  for (const row of clients) {
    const estado = row.estado_zonificacion || "";
    const lat = Number(row.lat);
    const lng = Number(row.lng);

    if (estado === "FUERA") {
      if (Number.isFinite(lat) && Number.isFinite(lng) && isPlausibleFuera(lat, lng)) {
        validFueraRows.push({ ...row, lat, lng });
      } else {
        reviewRows.push({ ...row, review_reason: "FUERA_COORD_DUDOSA" });
      }
      continue;
    }

    if (estado === "SIN_COORD" || estado === "SIN_ZONA") {
      reviewRows.push({ ...row, review_reason: estado });
      continue;
    }

    if (estado === "OK_COORD" && isolatedMicroSet.has(row.micro_zona || "")) {
      reviewRows.push({ ...row, review_reason: "MICROZONA_AISLADA" });
    }
  }

  const outsideZones = balancedGeoClusters(validFueraRows, 4, "ZF");
  const reviewZones = balancedBuckets(reviewRows, 3, "ZR", "REVISION");

  const outsideByClient = new Map();
  for (const zone of outsideZones) {
    for (const row of zone.rows) {
      outsideByClient.set(row.cliente_id, zone.zoneCode);
    }
  }

  const reviewByClient = new Map();
  const reviewReasonByClient = new Map();
  for (const zone of reviewZones) {
    for (const row of zone.rows) {
      reviewByClient.set(row.cliente_id, zone.zoneCode);
      reviewReasonByClient.set(row.cliente_id, row.review_reason || "REVISION");
    }
  }

  const zoneOrder = [
    ...internalZones.map((zone) => zone.zoneCode),
    ...outsideZones.map((zone) => zone.zoneCode),
    ...reviewZones.map((zone) => zone.zoneCode),
  ];
  const vendorByZone = new Map(zoneOrder.map((zoneCode, index) => [zoneCode, `V${String(index + 1).padStart(3, "0")}`]));

  const updatedClients = clients.map((row) => {
    const estado = row.estado_zonificacion || "";
    const micro = row.micro_zona || "";
    let zonaNueva = row.zona_nueva || "";
    let observacion = row.observacion_zonificacion || "";

    if (estado === "OK_COORD" && internalByMicro.has(micro)) {
      zonaNueva = internalByMicro.get(micro);
      observacion = "";
    } else if (outsideByClient.has(row.cliente_id)) {
      zonaNueva = outsideByClient.get(row.cliente_id);
      observacion = "";
    } else if (reviewByClient.has(row.cliente_id)) {
      zonaNueva = reviewByClient.get(row.cliente_id);
      observacion = reviewReasonByClient.get(row.cliente_id) || observacion;
    }

    const vendorNuevo = zonaNueva ? vendorByZone.get(zonaNueva) || "" : "";

    return {
      ...row,
      zona_nueva: zonaNueva,
      vendor_nuevo: vendorNuevo,
      observacion_zonificacion: observacion,
    };
  });

  const zoneRows = [
    ...internalZones.map((zone) => ({
      zone_code: zone.zoneCode,
      zone_name: zone.zoneCode,
      tipo: "INTERNA",
      clientes_reales: zone.totalClientes,
      vendor_code: vendorByZone.get(zone.zoneCode),
      detalle: zone.cells.map((cell) => cell.micro_zona).join(" | "),
    })),
    ...outsideZones.map((zone) => ({
      zone_code: zone.zoneCode,
      zone_name: zone.zoneCode,
      tipo: "FUERA",
      clientes_reales: zone.totalClientes,
      vendor_code: vendorByZone.get(zone.zoneCode),
      detalle: `cluster_fuera_${zone.zoneCode}`,
    })),
    ...reviewZones.map((zone) => ({
      zone_code: zone.zoneCode,
      zone_name: zone.zoneCode,
      tipo: "REVISION",
      clientes_reales: zone.totalClientes,
      vendor_code: vendorByZone.get(zone.zoneCode),
      detalle: `revision_${zone.zoneCode}`,
    })),
  ];

  fs.writeFileSync(
    outClientsPath,
    stringifyCsv(updatedClients, Object.keys(updatedClients[0])),
    "utf8",
  );
  fs.writeFileSync(
    outZonesPath,
    stringifyCsv(zoneRows, ["zone_code", "zone_name", "tipo", "clientes_reales", "vendor_code", "detalle"]),
    "utf8",
  );

  console.log("Plan provisional de 20 zonas generado.");
  for (const row of zoneRows) {
    console.log(`${row.zone_code} [${row.tipo}] -> ${row.clientes_reales} -> ${row.vendor_code}`);
  }
  console.log(`Clientes exportados: ${outClientsPath}`);
  console.log(`Resumen zonas: ${outZonesPath}`);
}

main();
