const ROUTE_START_LAT = -31.4172;
const ROUTE_START_LNG = -64.1865;

export type RouteCoordinateCustomer<T = Record<string, unknown>> = T & {
  lat: number | string | null;
  lng: number | string | null;
};

export function toNumericCoordinate(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineDistanceKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function squaredDistance(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) {
  const dLat = fromLat - toLat;
  const dLng = fromLng - toLng;
  return dLat * dLat + dLng * dLng;
}

function selectGeoSeeds<T extends RouteCoordinateCustomer>(
  customers: Array<T & { lat: number; lng: number }>,
  clusterCount: number,
) {
  if (customers.length === 0 || clusterCount <= 0) {
    return [] as Array<{ lat: number; lng: number }>;
  }

  const sorted = [...customers].sort((left, right) => left.lat - right.lat || left.lng - right.lng);
  const seeds = [sorted[0]];

  while (seeds.length < clusterCount && seeds.length < sorted.length) {
    let bestCustomer = sorted[0];
    let bestDistance = Number.NEGATIVE_INFINITY;

    for (const customer of sorted) {
      const minDistance = Math.min(
        ...seeds.map((seed) => squaredDistance(customer.lat, customer.lng, seed.lat, seed.lng)),
      );

      if (minDistance > bestDistance) {
        bestDistance = minDistance;
        bestCustomer = customer;
      }
    }

    seeds.push(bestCustomer);
  }

  return seeds.slice(0, clusterCount).map((seed) => ({ lat: seed.lat, lng: seed.lng }));
}

export function orderCustomersByNearestNeighbor<T extends RouteCoordinateCustomer>(customers: T[]) {
  const normalizedCustomers = customers.map((customer) => ({
    ...customer,
    lat: toNumericCoordinate(customer.lat),
    lng: toNumericCoordinate(customer.lng),
  }));

  const customersWithCoords = normalizedCustomers.filter(
    (customer): customer is T & { lat: number; lng: number } =>
      typeof customer.lat === "number" && typeof customer.lng === "number",
  );
  const customersWithoutCoords = normalizedCustomers.filter(
    (customer) => typeof customer.lat !== "number" || typeof customer.lng !== "number",
  );

  if (customersWithCoords.length <= 1) {
    return [...customersWithCoords, ...customersWithoutCoords];
  }

  const pending = [...customersWithCoords];
  const ordered: Array<T & { lat: number | null; lng: number | null }> = [];
  let currentLat = ROUTE_START_LAT;
  let currentLng = ROUTE_START_LNG;

  while (pending.length > 0) {
    let selectedIndex = 0;
    let selectedDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < pending.length; index += 1) {
      const candidate = pending[index];
      const distance = haversineDistanceKm(currentLat, currentLng, candidate.lat, candidate.lng);

      if (distance < selectedDistance) {
        selectedDistance = distance;
        selectedIndex = index;
      }
    }

    const [selectedCustomer] = pending.splice(selectedIndex, 1);
    ordered.push(selectedCustomer);
    currentLat = selectedCustomer.lat;
    currentLng = selectedCustomer.lng;
  }

  return [...ordered, ...customersWithoutCoords];
}

function buildBalancedGeoClusters<T extends RouteCoordinateCustomer>(customers: T[], clusterCount: number) {
  const normalizedCustomers = customers
    .map((customer) => ({
      ...customer,
      lat: toNumericCoordinate(customer.lat),
      lng: toNumericCoordinate(customer.lng),
    }))
    .filter((customer): customer is T & { lat: number; lng: number } =>
      typeof customer.lat === "number" && typeof customer.lng === "number",
    );

  if (normalizedCustomers.length === 0 || clusterCount <= 0) {
    return [] as Array<Array<T & { lat: number; lng: number }>>;
  }

  const effectiveClusterCount = Math.min(clusterCount, normalizedCustomers.length);
  const capacities = Array.from({ length: effectiveClusterCount }, (_, index) => {
    const base = Math.floor(normalizedCustomers.length / effectiveClusterCount);
    const extra = index < normalizedCustomers.length % effectiveClusterCount ? 1 : 0;
    return base + extra;
  });

  let centers = selectGeoSeeds(normalizedCustomers, effectiveClusterCount);

  for (let iteration = 0; iteration < 12; iteration += 1) {
    const rankedCustomers = normalizedCustomers
      .map((customer) => {
        const orderedChoices = centers
          .map((center, index) => ({
            index,
            distance: squaredDistance(customer.lat, customer.lng, center.lat, center.lng),
          }))
          .sort((left, right) => left.distance - right.distance);

        return {
          customer,
          orderedChoices,
          margin:
            (orderedChoices[1]?.distance ?? orderedChoices[0]?.distance ?? 0) -
            (orderedChoices[0]?.distance ?? 0),
        };
      })
      .sort((left, right) => right.margin - left.margin);

    const clusters = Array.from({ length: effectiveClusterCount }, () => [] as Array<T & { lat: number; lng: number }>);

    for (const ranked of rankedCustomers) {
      const choice = ranked.orderedChoices.find((option) => clusters[option.index].length < capacities[option.index]);
      const fallbackChoice = choice ?? ranked.orderedChoices[0];
      clusters[fallbackChoice.index].push(ranked.customer);
    }

    centers = clusters.map((cluster, index) => {
      if (cluster.length === 0) {
        return centers[index];
      }

      return {
        lat: cluster.reduce((sum, customer) => sum + customer.lat, 0) / cluster.length,
        lng: cluster.reduce((sum, customer) => sum + customer.lng, 0) / cluster.length,
      };
    });
  }

  const finalRankedCustomers = normalizedCustomers
    .map((customer) => {
      const orderedChoices = centers
        .map((center, index) => ({
          index,
          distance: squaredDistance(customer.lat, customer.lng, center.lat, center.lng),
        }))
        .sort((left, right) => left.distance - right.distance);

      return {
        customer,
        orderedChoices,
        margin:
          (orderedChoices[1]?.distance ?? orderedChoices[0]?.distance ?? 0) -
          (orderedChoices[0]?.distance ?? 0),
      };
    })
    .sort((left, right) => right.margin - left.margin);

  const clusters = Array.from({ length: effectiveClusterCount }, () => [] as Array<T & { lat: number; lng: number }>);

  for (const ranked of finalRankedCustomers) {
    const choice = ranked.orderedChoices.find((option) => clusters[option.index].length < capacities[option.index]);
    const fallbackChoice = choice ?? ranked.orderedChoices[0];
    clusters[fallbackChoice.index].push(ranked.customer);
  }

  return clusters;
}

export function assignCustomersToDays<T extends RouteCoordinateCustomer>(
  customers: T[],
  dayDates: string[],
  existingDayLoads: number[],
) {
  const customersWithCoords = customers.filter((customer) => {
    const lat = toNumericCoordinate(customer.lat);
    const lng = toNumericCoordinate(customer.lng);
    return lat !== null && lng !== null;
  });
  const customersWithoutCoords = customers.filter((customer) => {
    const lat = toNumericCoordinate(customer.lat);
    const lng = toNumericCoordinate(customer.lng);
    return lat === null || lng === null;
  });

  const clusters = buildBalancedGeoClusters(customersWithCoords, dayDates.length);
  const assignments = new Map<string, T[]>();
  const currentLoads = [...existingDayLoads];

  for (const date of dayDates) {
    assignments.set(date, []);
  }

  const sortedClusters = [...clusters].sort((left, right) => right.length - left.length);

  for (const cluster of sortedClusters) {
    let targetDayIndex = 0;
    let targetDayLoad = Number.POSITIVE_INFINITY;

    for (let index = 0; index < dayDates.length; index += 1) {
      if (currentLoads[index] < targetDayLoad) {
        targetDayLoad = currentLoads[index];
        targetDayIndex = index;
      }
    }

    const visitDate = dayDates[targetDayIndex];
    const list = assignments.get(visitDate) ?? [];
    list.push(...cluster);
    assignments.set(visitDate, list);
    currentLoads[targetDayIndex] += cluster.length;
  }

  for (const customer of customersWithoutCoords) {
    let targetDayIndex = 0;
    let targetDayLoad = Number.POSITIVE_INFINITY;

    for (let index = 0; index < dayDates.length; index += 1) {
      if (currentLoads[index] < targetDayLoad) {
        targetDayLoad = currentLoads[index];
        targetDayIndex = index;
      }
    }

    const visitDate = dayDates[targetDayIndex];
    const list = assignments.get(visitDate) ?? [];
    list.push(customer);
    assignments.set(visitDate, list);
    currentLoads[targetDayIndex] += 1;
  }

  return assignments;
}
